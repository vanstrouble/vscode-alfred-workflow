
ObjC.import("Foundation");

const FILE_MANAGER = $.NSFileManager.defaultManager;
const HOME = ObjC.unwrap($.NSProcessInfo.processInfo.environment.objectForKey("HOME"));

// VS Code variants configuration (DRY principle)
const VS_CODE_VARIANTS = [
    { name: "Code", app: "/Applications/Visual Studio Code.app", ext: ".vscode", scheme: "vscode" },
    { name: "Code - Insiders", app: "/Applications/Visual Studio Code - Insiders.app", ext: ".vscode-insiders", scheme: "vscode-insiders" },
    { name: "VSCodium", app: "/Applications/VSCodium.app", ext: ".vscode-oss", scheme: "vscodium" },
];

// Icon search locations (DRY principle)
const ICON_LOCATIONS = ["icon.png", "images/icon.png", "resources/icon.png", "icon.svg"];

/**
 * Checks if a file or directory exists.
 * @param {string} path - The path to check.
 * @returns {boolean}
 */
function fileExists(path) {
    return FILE_MANAGER.fileExistsAtPath(path);
}

/**
 * Finds installed VS Code variants and their extension directories.
 * Optimized: Only checks paths once, constructs result directly.
 * @returns {{name: string, extensionsPath: string, scheme: string}[]}
 */
function findVSCodeVariants() {
    return VS_CODE_VARIANTS
        .map(v => ({ ...v, extensionsPath: `${HOME}/${v.ext}/extensions` }))
        .filter(v => fileExists(v.extensionsPath));
}

/**
 * Reads and parses a JSON file with caching.
 * Optimized: Single try-catch, early return pattern.
 * @param {string} path - Path to the JSON file.
 * @returns {object|null}
 */
function readJson(path) {
    try {
        const content = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
        return content ? JSON.parse(ObjC.unwrap(content)) : null;
    } catch (e) {
        return null;
    }
}

/**
 * Resolves localization tokens in a string (e.g., %displayName%).
 * Optimized: Early return, lazy loading of NLS file.
 * @param {string} value - Value that may contain localization tokens.
 * @param {string} extPath - Path to the extension directory.
 * @returns {string}
 */
function resolveLocalization(value, extPath) {
    if (!value || typeof value !== 'string' || !value.includes('%')) {
        return value;
    }

    const nls = readJson(`${extPath}/package.nls.json`);
    return nls ? value.replace(/%([^%]+)%/g, (_, token) => nls[token] || `%${token}%`) : value;
}

/**
 * Finds the icon for an extension.
 * Optimized: Direct manifest check, then loop through common locations.
 * @param {string} extPath - Path to the extension directory.
 * @param {object} manifest - The package.json manifest.
 * @returns {object} Icon object for Alfred.
 */
function findExtensionIcon(extPath, manifest) {
    // Check manifest-specified icon first
    if (manifest.icon) {
        const manifestIcon = `${extPath}/${manifest.icon}`;
        if (fileExists(manifestIcon)) return { path: manifestIcon };
    }

    // Check common locations
    for (const loc of ICON_LOCATIONS) {
        const iconPath = `${extPath}/${loc}`;
        if (fileExists(iconPath)) return { path: iconPath };
    }

    return { path: "icon.png" };
}

/**
 * Creates an Alfred item from extension metadata.
 * Optimized: Extracted to separate function for better readability and reusability.
 * @param {string} id - Extension ID.
 * @param {string} displayName - Display name of the extension.
 * @param {string} description - Description of the extension.
 * @param {string} publisher - Publisher name.
 * @param {object} icon - Icon object.
 * @param {object} variant - The VS Code variant this extension belongs to.
 * @returns {object} Alfred item object.
 */
function createAlfredItem(id, displayName, description, publisher, icon, variant) {
    const vscodeUrl = `${variant.scheme}:extension/${id}`;
    return {
        uid: id,
        title: displayName,
        subtitle: description,
        arg: id,
        autocomplete: displayName,
        variables: { vscode_url: vscodeUrl },
        match: `${displayName} ${publisher} ${id}`,
        icon: icon,
        mods: {
            ctrl: {
                subtitle: `⌃ Uninstall "${displayName}"`,
                arg: id,
                variables: { action: "uninstall" }
            },
        },
    };
}

/**
 * Gets locally installed extensions.
 * Optimized: Streamlined logic, reduced nesting, better error handling.
 * @param {object} variant - The VS Code variant object.
 * @returns {object[]}
 */
function getLocalExtensions(variant) {
    const extensionsPath = variant.extensionsPath;
    if (!fileExists(extensionsPath)) return [];

    const contents = FILE_MANAGER.contentsOfDirectoryAtPathError(extensionsPath, null);
    if (!contents) return [];

    const extensions = [];
    const count = contents.count;

    for (let i = 0; i < count; i++) {
        const dirName = ObjC.unwrap(contents.objectAtIndex(i));
        const extPath = `${extensionsPath}/${dirName}`;
        const manifest = readJson(`${extPath}/package.json`);

        if (!manifest?.name || !manifest?.publisher) continue;

        const id = `${manifest.publisher}.${manifest.name}`;
        const displayName = resolveLocalization(manifest.displayName, extPath) || manifest.name;
        const description = resolveLocalization(manifest.description, extPath) || "";
        const icon = findExtensionIcon(extPath, manifest);

        extensions.push(createAlfredItem(id, displayName, description, manifest.publisher, icon, variant));
    }

    return extensions;
}

/**
 * Creates error/info item for Alfred.
 * DRY: Extracted common pattern for error messages.
 * @param {string} title - Title of the message.
 * @param {string} subtitle - Subtitle of the message.
 * @returns {object} Alfred response object.
 */
function createInfoItem(title, subtitle) {
    return {
        items: [{ title, subtitle, valid: false }]
    };
}

/**
 * Main entry point for Alfred Script Filter.
 * Optimized: Reduced complexity, better data flow, single JSON.stringify call.
 */
function run() {
    const variants = findVSCodeVariants();

    if (variants.length === 0) {
        return JSON.stringify(createInfoItem(
            "VS Code installation not found",
            "Could not locate VS Code, Insiders, or VSCodium extensions."
        ));
    }

    // Collect all extensions from all variants
    const allExtensions = variants.flatMap(v => getLocalExtensions(v));

    if (allExtensions.length === 0) {
        return JSON.stringify(createInfoItem(
            "No extensions found",
            "Could not find any installed extensions."
        ));
    }

    // Remove duplicates using Map (O(n) instead of O(n²))
    const uniqueExtensions = Array.from(
        new Map(allExtensions.map(item => [item.uid, item])).values()
    );

    // Sort alphabetically (case-insensitive)
    uniqueExtensions.sort((a, b) => a.title.localeCompare(b.title));

    return JSON.stringify({
        cache: { seconds: 30, loosereload: true },
        items: uniqueExtensions
    });
}
