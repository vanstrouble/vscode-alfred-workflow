ObjC.import("Foundation");

const FILE_MANAGER = $.NSFileManager.defaultManager;
const HOME = ObjC.unwrap(
	$.NSProcessInfo.processInfo.environment.objectForKey("HOME")
);

/**
 * Executes a shell command using NSTask (faster than doShellScript)
 * @param {string} command - Command to execute
 * @returns {string|null} Output or null on error
 */
function runShell(command) {
	try {
		const task = $.NSTask.alloc.init;
		const stdout = $.NSPipe.pipe;

		task.launchPath = "/bin/zsh";
		task.arguments = ["-c", command];
		task.standardOutput = stdout;
		task.standardError = $.NSPipe.pipe;

		task.launch;
		task.waitUntilExit;

		if (task.terminationStatus !== 0) return null;

		const data = stdout.fileHandleForReading.readDataToEndOfFile;
		if (!data || data.length === 0) return null;

		return ObjC.unwrap(
			$.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding)
		);
	} catch (e) {
		return null;
	}
}

/**
 * Checks if a file exists at path
 */
function fileExists(path) {
	return FILE_MANAGER.fileExistsAtPath(path);
}

/**
 * Gets basename from path
 */
function getBasename(path) {
	const parts = path.split("/");
	return parts[parts.length - 1] || parts[parts.length - 2] || path;
}

/**
 * Gets dirname from path
 */
function getDirname(path) {
	const parts = path.split("/");
	parts.pop();
	return parts.join("/") || "/";
}

/**
 * Gets git branches for multiple paths in parallel (much faster)
 * @param {string[]} paths - Array of directory paths
 * @returns {Object} Map of path -> branch name
 */
function getGitBranchesParallel(paths) {
    if (paths.length === 0) return {};

    // Create a script that outputs "path:branch" for each repo
    const script = paths.map(p =>
        `(cd "${p}" 2>/dev/null && echo "${p}:$(git rev-parse --abbrev-ref HEAD 2>/dev/null)")`
    ).join(" & ");

    const result = runShell(`{ ${script}; wait; } 2>/dev/null`);
    if (!result) return {};

    const branches = {};
    result.trim().split("\n").forEach(line => {
        const colonIndex = line.lastIndexOf(":");
        if (colonIndex > 0) {
            const path = line.substring(0, colonIndex);
            const branch = line.substring(colonIndex + 1);
            if (branch && branch !== "HEAD") {
                branches[path] = branch;
            }
        }
    });
    return branches;
}

/**
 * Finds VS Code database path
 */
function findVSCodeDB() {
	const variants = [
		["Code", `${HOME}/Library/Application Support/Code/User/globalStorage/state.vscdb`],
		["Code - Insiders", `${HOME}/Library/Application Support/Code - Insiders/User/globalStorage/state.vscdb`],
		["VSCodium", `${HOME}/Library/Application Support/VSCodium/User/globalStorage/state.vscdb`],
	];

	for (const [name, path] of variants) {
		if (fileExists(path)) {
			return { dbPath: path, buildName: name };
		}
	}
	return null;
}

/**
 * Reads recent entries from VS Code SQLite database
 */
function getRecentEntries(dbPath) {
	const query = `SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList';`;
	const result = runShell(`/usr/bin/sqlite3 "${dbPath}" "${query}"`);

	if (!result) return [];

	try {
		const data = JSON.parse(result.trim());
		return data.entries || [];
	} catch (e) {
		return [];
	}
}

/**
 * Parses a URI string to a local file path
 * @param {string} uri - URI to parse
 * @returns {string|null} Local path or null if remote/invalid
 */
function parseUri(uri) {
	if (!uri || uri.startsWith("vscode-remote://")) return null;
	return decodeURIComponent(uri.replace("file://", ""));
}

/**
 * Extracts path and type from an entry
 * @param {Object} entry - Entry object
 * @returns {{path: string, type: string, name: string}|null}
 */
function extractEntryInfo(entry) {
	if (entry.folderUri) {
		const path = parseUri(entry.folderUri);
		return path ? { path, type: "folder", name: getBasename(path) } : null;
	}

	if (entry.workspace?.configPath) {
		const path = parseUri(entry.workspace.configPath);
		return path ? { path, type: "workspace", name: getBasename(path).replace(".code-workspace", "") } : null;
	}

	if (entry.fileUri) {
		const path = parseUri(entry.fileUri);
		return path ? { path, type: "file", name: getBasename(path) } : null;
	}

	return null;
}

/**
 * Parses a single entry into Alfred item format
 * @param {Object} entry - Entry object
 * @param {Object} branchMap - Map of path -> branch name
 */
function parseEntry(entry, branchMap = {}) {
    const info = extractEntryInfo(entry);
    if (!info || !fileExists(info.path)) return null;

    const { path, type, name } = info;
    const prettyPath = path.replace(HOME, "~");
    const dirPath = getDirname(prettyPath);

    // Get git branch from pre-fetched map (only for folders)
    const branch = type === "folder" ? branchMap[path] : null;
    const subtitle = branch ? `${dirPath} • ${branch}` : dirPath;

    return {
        uid: path,
        title: name,
        subtitle: subtitle,
        arg: path,
        autocomplete: name,
        match: `${name} ${path}`,
        type: "file",
        icon: type === "workspace"
            ? { path: "workspace.png" }
            : { type: "fileicon", path: path },
        mods: {
            ctrl: {
                subtitle: "⌃ Remove from recent projects",
                arg: path,
                variables: { action: "0" },
            },
            "ctrl+shift": {
                subtitle: "⌃⇧ Remove all recent projects",
                arg: "REMOVE_ALL",
                variables: { action: "1" },
            },
        },
    };
}

/**
 * Main entry point for Alfred Script Filter
 */
function run() {
    const vsCode = findVSCodeDB();

    if (!vsCode) {
        return JSON.stringify({
            items: [{
                title: "VS Code not found",
                subtitle: "Could not locate VS Code database",
                valid: false,
                icon: { path: "icon.png" },
            }],
        });
    }

    const entries = getRecentEntries(vsCode.dbPath);

    if (!entries || entries.length === 0) {
        return JSON.stringify({
            items: [{
                title: "No recent projects",
                subtitle: "Open some projects in VS Code first",
                valid: false,
                icon: { path: "icon.png" },
            }],
        });
    }

    // Extract folder paths for parallel git branch fetching
    const folderPaths = entries
        .map(extractEntryInfo)
        .filter(info => info && info.type === "folder" && fileExists(info.path))
        .map(info => info.path);

    // Fetch all git branches in parallel (single shell call)
    const branchMap = getGitBranchesParallel(folderPaths);

    const items = entries
        .map(entry => parseEntry(entry, branchMap))
        .filter((item) => item !== null);

    return JSON.stringify({
        cache: { seconds: 5, loosereload: true },
        items,
    });
}
