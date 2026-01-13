ObjC.import("Foundation");

const app = Application.currentApplication();
app.includeStandardAdditions = true;

const MAX_RESULTS = 20;
const API_URL = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery?api-version=3.0-preview.1";
const MARKETPLACE_URL = "https://marketplace.visualstudio.com/items?itemName=";
const DEFAULT_ICON = "icon.png";

// API Flags (combined for performance)
const API_FLAGS = 0x2 | 0x4 | 0x10 | 0x20 | 0x80 | 0x100 | 0x200; // Files, Categories, VersionProps, ExcludeNonValidated, AssetUri, Statistics, LatestOnly

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
 * Reads installed extension IDs directly from VS Code extensions directories.
 * Optimized: Only reads directory names, extracts IDs with regex (no package.json parsing).
 * Performance: O(n) with O(1) lookup using Set, case-insensitive comparison.
 * @returns {Set<string>} Set of installed extension IDs (lowercase).
 */
function getInstalledExtensions() {
	try {
		const ids = new Set();
		const HOME = ObjC.unwrap($.NSProcessInfo.processInfo.environment.objectForKey("HOME"));
		if (!HOME) return ids;

		const fileManager = $.NSFileManager.defaultManager;
		const paths = [
			`${HOME}/.vscode/extensions`,
			`${HOME}/.vscode-insiders/extensions`,
			`${HOME}/.vscode-oss/extensions`
		];

		for (const path of paths) {
			if (!fileManager.fileExistsAtPath(path)) continue;

			const contents = fileManager.contentsOfDirectoryAtPathError(path, null);
			if (!contents) continue;

			const count = contents.count;
			for (let i = 0; i < count; i++) {
				const dirName = ObjC.unwrap(contents.objectAtIndex(i));
				// Extract ID: "ms-python.python-2.0.1" -> "ms-python.python"
				// Lazy match until dash + digit (version start)
				const match = dirName.match(/^(.+?)-\d/);
				if (match) ids.add(match[1].toLowerCase());
			}
		}

		return ids;
	} catch (e) {
		return new Set();
	}
}

/**
 * Fetches extensions from VS Code Marketplace
 */
function fetchExtensions(searchText) {
	const body = JSON.stringify({
		filters: [{
			criteria: [
				{ filterType: 8, value: "Microsoft.VisualStudio.Code" },
				{ filterType: 10, value: searchText },
				{ filterType: 12, value: "4096" },
			],
			pageNumber: 1,
			pageSize: MAX_RESULTS,
			sortBy: 0,
			sortOrder: 0,
		}],
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
function parseExtension(ext, installedIds) {
	const id = `${ext.publisher.publisherName}.${ext.extensionName}`;
	const stats = ext.statistics?.find(s => s.statisticName === "install");
	const version = ext.versions?.[0]?.version || "";
	const isInstalled = installedIds.has(id.toLowerCase());

	const subtitle = [
		isInstalled ? "✓ Installed" : null,
		ext.publisher.displayName,
		stats ? `↓ ${compactNumber(stats.value)}` : null,
		version ? `v${version}` : null,
	].filter(Boolean).join(" • ");

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
		mods: {
			cmd: { subtitle: `Open in browser`, arg: MARKETPLACE_URL + id },
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
			items: [simpleItem("Search VS Code Extensions", "Type to search the Marketplace")],
		});
	}

	const extensions = fetchExtensions(query);

	if (!extensions.length) {
		return JSON.stringify({
			items: [simpleItem("No extensions found", `No results for "${query}"`)],
		});
	}

	const installedIds = getInstalledExtensions();

	return JSON.stringify({
		cache: { seconds: 60, loosereload: true },
		items: extensions.map(ext => parseExtension(ext, installedIds)),
	});
}
