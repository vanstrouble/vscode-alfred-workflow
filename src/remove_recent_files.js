ObjC.import("Foundation");

const FILE_MANAGER = $.NSFileManager.defaultManager;
const HOME = ObjC.unwrap(
	$.NSProcessInfo.processInfo.environment.objectForKey("HOME")
);

/**
 * Executes a shell command and returns the output
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
 * Executes a shell command without returning output
 * @param {string} command - Command to execute
 * @returns {boolean} True if successful
 */
function runShellNoOutput(command) {
	try {
		const task = $.NSTask.alloc.init;

		task.launchPath = "/bin/zsh";
		task.arguments = ["-c", command];
		task.standardOutput = $.NSPipe.pipe;
		task.standardError = $.NSPipe.pipe;

		task.launch;
		task.waitUntilExit;

		return task.terminationStatus === 0;
	} catch (e) {
		return false;
	}
}

/**
 * Finds VS Code database path
 * @returns {{dbPath: string, buildName: string}|null}
 */
function findVSCodeDB() {
	const variants = [
		[
			"Code",
			`${HOME}/Library/Application Support/Code/User/globalStorage/state.vscdb`,
		],
		[
			"Code - Insiders",
			`${HOME}/Library/Application Support/Code - Insiders/User/globalStorage/state.vscdb`,
		],
		[
			"VSCodium",
			`${HOME}/Library/Application Support/VSCodium/User/globalStorage/state.vscdb`,
		],
	];

	for (const [name, path] of variants) {
		if (FILE_MANAGER.fileExistsAtPath(path)) {
			return { dbPath: path, buildName: name };
		}
	}
	return null;
}

/**
 * Reads recent entries from VS Code SQLite database
 * @param {string} dbPath - Path to the database
 * @returns {Object|null} The parsed data object or null
 */
function getRecentData(dbPath) {
	const query = `SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList';`;
	const result = runShell(`/usr/bin/sqlite3 "${dbPath}" "${query}"`);

	if (!result) return null;

	try {
		return JSON.parse(result.trim());
	} catch (e) {
		return null;
	}
}

/**
 * Updates the recent entries in VS Code SQLite database
 * Uses here-doc to pass SQL directly without temp files (faster, no I/O overhead)
 * @param {string} dbPath - Path to the database
 * @param {Object} data - The data object to save
 * @returns {boolean} Success status
 */
function updateRecentData(dbPath, data) {
	const jsonStr = JSON.stringify(data).replace(/'/g, "''");
	const sqlContent = `UPDATE ItemTable SET value = '${jsonStr}' WHERE key = 'history.recentlyOpenedPathsList';`;

	// Use here-doc to pass SQL directly without temp file
	const command = `/usr/bin/sqlite3 "${dbPath}" <<'EOF'
${sqlContent}
EOF`;

	return runShellNoOutput(command);
}

/**
 * Gets the path from an entry (folder, workspace, or file)
 * @param {Object} entry - Entry object
 * @returns {string|null} The path or null
 */
function getEntryPath(entry) {
	const uri = entry.folderUri || entry.workspace?.configPath || entry.fileUri;
	if (!uri) return null;
	return decodeURIComponent(uri.replace("file://", ""));
}

/**
 * Removes a single entry from the recent list
 * @param {string} dbPath - Path to the database
 * @param {string} pathToRemove - Path of the entry to remove
 * @returns {{success: boolean, message: string}}
 */
function removeSingleEntry(dbPath, pathToRemove) {
	const data = getRecentData(dbPath);

	if (!data?.entries) {
		return { success: false, message: "Could not read recent entries" };
	}

	const originalCount = data.entries.length;

	// Filter out the entry that matches the path
	data.entries = data.entries.filter(
		(entry) => getEntryPath(entry) !== pathToRemove
	);

	if (data.entries.length === originalCount) {
		return { success: false, message: "Entry not found in recent list" };
	}

	if (updateRecentData(dbPath, data)) {
		return { success: true, message: "Removed from recent projects" };
	}
	return { success: false, message: "Failed to update database" };
}

/**
 * Removes all entries from the recent list
 * @param {string} dbPath - Path to the database
 * @returns {{success: boolean, message: string}}
 */
function removeAllEntries(dbPath) {
	const data = getRecentData(dbPath);

	if (!data) {
		return { success: false, message: "Could not read recent entries" };
	}

	const count = data.entries?.length || 0;
	data.entries = [];

	if (updateRecentData(dbPath, data)) {
		return { success: true, message: `Removed ${count} recent projects` };
	}
	return { success: false, message: "Failed to update database" };
}

/**
 * Main entry point for Alfred Run Script
 * @param {string[]} argv - Arguments passed from Alfred
 */
function run(argv) {
	const env = $.NSProcessInfo.processInfo.environment;
	const actionStr = ObjC.unwrap(env.objectForKey("action"));
	const pathArg = argv?.[0] || null;

	// Safety check: require action variable from modifier key
	if (!actionStr) {
		return "No action specified. Use Ctrl or Ctrl+Shift modifier.";
	}

	const vsCode = findVSCodeDB();
	if (!vsCode) {
		return "VS Code database not found";
	}

	let result;

	if (actionStr === "0") {
		// Remove single entry
		if (!pathArg || pathArg === "REMOVE_ALL") {
			return "Error: No valid path provided";
		}
		result = removeSingleEntry(vsCode.dbPath, pathArg);
	} else if (actionStr === "1") {
		// Remove all entries
		result = removeAllEntries(vsCode.dbPath);
	} else {
		return `Unknown action: ${actionStr}`;
	}

	return result.message;
}
