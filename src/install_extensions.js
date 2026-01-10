#!/usr/bin/env osascript -l JavaScript

// JXA script to install a VS Code extension from an Alfred workflow.
// It finds the installed VS Code variant and uses its command-line interface
// to install the extension passed as an argument.

ObjC.import("Foundation");

const FILE_MANAGER = $.NSFileManager.defaultManager;
const app = Application.currentApplication();
app.includeStandardAdditions = true;

/**
 * Checks if an application exists at the given path.
 * @param {string} path - The full path to the application bundle.
 * @returns {boolean} - True if the file exists, false otherwise.
 */
function appExists(path) {
	return FILE_MANAGER.fileExistsAtPath(path);
}

/**
 * Finds which VS Code variant is installed on the system.
 * It checks for "Visual Studio Code", "Visual Studio Code - Insiders", and "VSCodium".
 * @returns {{name: string, path: string, cli: string}|null} An object with variant details or null if none are found.
 */
function findVSCodeVariant() {
	const variants = [
		{ name: "Visual Studio Code", path: "/Applications/Visual Studio Code.app", cli: "code" },
		{ name: "Visual Studio Code - Insiders", path: "/Applications/Visual Studio Code - Insiders.app", cli: "code-insiders" },
		{ name: "VSCodium", path: "/Applications/VSCodium.app", cli: "codium" },
	];

	for (const variant of variants) {
		if (appExists(variant.path)) {
			return variant;
		}
	}
	return null;
}

/**
 * Executes a shell command.
 * @param {string} command - The command to execute.
 * @returns {string|null} The result of the command, or null on error.
 */
function runShell(command) {
	try {
		return app.doShellScript(command);
	} catch (e) {
		console.log(`Error executing command: ${command}`);
		console.log(e.message);
		return null;
	}
}

/**
 * Main entry point for the JXA script.
 * @param {string[]} argv - Arguments passed from the Alfred Run Script action.
 */
function run(argv) {
	"use strict";

	const extensionId = argv?.[0]?.trim();
	if (!extensionId) {
		return "No extension ID provided.";
	}

	const vscode = findVSCodeVariant();
	if (!vscode) {
		return "VS Code application not found.";
	}

	// The `code` command might not be in the default PATH for shell scripts
	// running via osascript. We'll use the full path to the binary inside the app bundle.
	const cliPath = `${vscode.path}/Contents/Resources/app/bin/${vscode.cli}`;

	// Command to install the extension and wait for it to finish.
	// This will also open VS Code if it's not already running.
	const command = `'${cliPath}' --install-extension '${extensionId}' --force`;

	const result = runShell(command);

	if (result === null) {
		return `Failed to install extension: ${extensionId}`;
	}

	// The command outputs a success message on stdout. We can return it.
	// Example: "Extension 'dracula-theme.theme-dracula' v2.25.1 was successfully installed."
	return result;
}
