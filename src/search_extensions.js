ObjC.import("Foundation");

const app = Application.currentApplication();
app.includeStandardAdditions = true;

const FILE_MANAGER = $.NSFileManager.defaultManager;
const HOME = ObjC.unwrap($.NSProcessInfo.processInfo.environment.objectForKey("HOME"));
const MAX_RESULTS = 20;
const API_URL = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery?api-version=3.0-preview.1";
const MARKETPLACE_URL = "https://marketplace.visualstudio.com/items?itemName=";
const DEFAULT_ICON = "icon.png";

// Consistent VS Code variants configuration
const VS_CODE_VARIANTS = [
    { name: "Code", ext: ".vscode", path: "/Applications/Visual Studio Code.app", scheme: "vscode" },
    { name: "Code - Insiders", ext: ".vscode-insiders", path: "/Applications/Visual Studio Code - Insiders.app", scheme: "vscode-insiders" },
    { name: "VSCodium", ext: ".vscode-oss", path: "/Applications/VSCodium.app", scheme: "vscodium" },
];

// API Flags (combined for performance)
const API_FLAGS = 0x2 | 0x4 | 0x10 | 0x20 | 0x80 | 0x100 | 0x200; // Files, Categories, VersionProps, ExcludeNonValidated, AssetUri, Statistics, LatestOnly

/**
 * Checks if a file or directory exists.
 * @param {string} path - The path to check.
 * @returns {boolean}
 */
function fileExists(path) {
    return FILE_MANAGER.fileExistsAtPath(path);
}

/**
 * Finds the first installed VS Code variant.
 * @returns {{name: string, path: string, cli: string, scheme: string}|null}
 */
function findVSCodeVariant() {
	return VS_CODE_VARIANTS.find(variant => fileExists(variant.path)) || null;
}

/**
 * Executes a shell command
 */
function runShell(command) {
	try {
		return app.doShellScript(command);
	} catch (e) {
		return null;
	}
}

/**
 * Formats number compactly (1.2K, 3.4M)
 */
function compactNumber(num) {
	if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
	if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
	return String(num);
}

/**
 * Reads and parses a JSON file.
 * @param {string} path - Path to the JSON file.
 * @returns {object|null}
 */
function readJson(path) {
	try {
		const content = $.NSString.stringWithContentsOfFileEncodingError(
			path,
			$.NSUTF8StringEncoding,
			null
		);
		return content ? JSON.parse(ObjC.unwrap(content)) : null;
	} catch (e) {
		return null;
	}
}

/**
 * Gets the set of obsolete (pending removal) extension folder names.
 * VS Code marks uninstalled extensions in a .obsolete JSON file.
 * @param {string} extensionsPath - Path to the extensions directory.
 * @returns {Set<string>} Set of obsolete folder names.
 */
function getObsoleteExtensions(extensionsPath) {
	const obsoleteFile = `${extensionsPath}/.obsolete`;
	const obsoleteData = readJson(obsoleteFile);
	return obsoleteData ? new Set(Object.keys(obsoleteData)) : new Set();
}

/**
 * Reads installed extension IDs from all found VS Code variants.
 * @returns {Set<string>} A set of installed extension IDs (lowercase).
 */
function getInstalledExtensions() {
    const ids = new Set();
    if (!HOME) return ids;

    const variantPaths = VS_CODE_VARIANTS
        .map(v => `${HOME}/${v.ext}/extensions`)
        .filter(path => fileExists(path));

    for (const extPath of variantPaths) {
        // Get obsolete extensions to filter them out
        const obsolete = getObsoleteExtensions(extPath);

        const contents = FILE_MANAGER.contentsOfDirectoryAtPathError(extPath, null);
        if (!contents) continue;

        const count = contents.count;
        for (let i = 0; i < count; i++) {
            const dirName = ObjC.unwrap(contents.objectAtIndex(i));

            // Skip obsolete (uninstalled) extensions
            if (obsolete.has(dirName)) continue;

            // Extract ID: "ms-python.python-2.0.1" -> "ms-python.python"
            const match = dirName.match(/^(.+?)-\d/);
            if (match) ids.add(match[1].toLowerCase());
        }
    }
    return ids;
}

/**
 * Fetches extensions from VS Code Marketplace
 */
function fetchExtensions(searchText) {
	const body = JSON.stringify({
		filters: [
			{
				criteria: [
					{ filterType: 8, value: "Microsoft.VisualStudio.Code" },
					{ filterType: 10, value: searchText },
					{ filterType: 12, value: "4096" },
				],
				pageNumber: 1,
				pageSize: MAX_RESULTS,
				sortBy: 0,
				sortOrder: 0,
			},
		],
		assetTypes: [],
		flags: API_FLAGS,
	});

	const command = `curl -s -X POST '${API_URL}' -H 'Content-Type: application/json' --compressed -d '${body}' --max-time 8`;
	const result = runShell(command);

	if (!result) return [];

	try {
		const data = JSON.parse(result);
		return data.results?.[0]?.extensions || [];
	} catch (e) {
		return [];
	}
}

/**
 * Parses extension to Alfred item
 */
function parseExtension(ext, installedIds, vscodeVariant) {
	const id = `${ext.publisher.publisherName}.${ext.extensionName}`;
	const stats = ext.statistics?.find((s) => s.statisticName === "install");
	const version = ext.versions?.[0]?.version || "";
	const isInstalled = installedIds.has(id.toLowerCase());

	const subtitle = [
		isInstalled ? "✓ Installed" : null,
		ext.publisher.displayName,
		stats ? `↓ ${compactNumber(stats.value)}` : null,
		version ? `v${version}` : null,
	]
		.filter(Boolean)
		.join(" • ");

	const vscodeUrl = vscodeVariant ? `${vscodeVariant.scheme}:extension/${id}` : MARKETPLACE_URL + id;

	return {
		uid: ext.extensionId,
		title: ext.displayName,
		subtitle,
		arg: id,
		autocomplete: ext.displayName,
		match: `${ext.displayName} ${id} ${ext.shortDescription || ""}`,
		text: { copy: id, largetype: ext.shortDescription || ext.displayName },
		quicklookurl: MARKETPLACE_URL + id,
		icon: { path: DEFAULT_ICON },
		variables: { extension_name: ext.displayName },
		mods: {
			cmd: {
				subtitle: `⌘ Open in VS Code`,
				arg: vscodeUrl,
			},
		},
	};
}

/**
 * Creates a simple Alfred item
 */
function simpleItem(title, subtitle, valid = false) {
	return { title, subtitle, valid, icon: { path: DEFAULT_ICON } };
}

/**
 * Main entry point
 */
function run(argv) {
	const query = argv?.[0]?.trim() || "";

	if (!query) {
		return JSON.stringify({
			items: [
				simpleItem(
					"Search VS Code Extensions",
					"Type to search the Marketplace"
				),
			],
		});
	}

	const extensions = fetchExtensions(query);

	if (!extensions.length) {
		return JSON.stringify({
			items: [
				simpleItem("No extensions found", `No results for "${query}"`),
			],
		});
	}

	const installedIds = getInstalledExtensions();
	const vscodeVariant = findVSCodeVariant();

	return JSON.stringify({
		cache: { seconds: 5, loosereload: true },
		items: extensions.map((ext) => parseExtension(ext, installedIds, vscodeVariant)),
	});
}
