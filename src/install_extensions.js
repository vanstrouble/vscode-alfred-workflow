#!/usr/bin/env osascript -l JavaScript

// JXA script to install a VS Code extension from an Alfred workflow.
// It finds the installed VS Code variant and uses its command-line interface
// to install the extension passed as an argument.

ObjC.import("Foundation");

const FILE_MANAGER = $.NSFileManager.defaultManager;
const app = Application.currentApplication();
app.includeStandardAdditions = true;

// Consistent VS Code variants configuration
const VS_CODE_VARIANTS = [
	{
		name: "Visual Studio Code",
		path: "/Applications/Visual Studio Code.app",
		cli: "code",
	},
	{
		name: "Visual Studio Code - Insiders",
		path: "/Applications/Visual Studio Code - Insiders.app",
		cli: "code-insiders",
	},
	{ name: "VSCodium", path: "/Applications/VSCodium.app", cli: "codium" },
];

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
 * @returns {{name: string, path: string, cli: string}|null}
 */
function findVSCodeVariant() {
	return VS_CODE_VARIANTS.find(variant => fileExists(variant.path)) || null;
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
		return "No extension ID provided";
	}

	// Get the extension name from environment variable if available
	const env = $.NSProcessInfo.processInfo.environment;
	const extensionName = ObjC.unwrap(env.objectForKey("extension_name")) || extensionId;

	const vscode = findVSCodeVariant();
	if (!vscode) {
		return "Application not detected on this system. Please install VS Code first.";
	}

	// Use the full path to the binary inside the app bundle.
	const cliPath = `${vscode.path}/Contents/Resources/app/bin/${vscode.cli}`;
	const command = `'${cliPath}' --install-extension '${extensionId}' --force`;

	const result = runShell(command);

	if (result === null) {
		return `${extensionName}\nInstallation failed. Please try again.`;
	}

	return `${extensionName}\nInstalled successfully`;
}
