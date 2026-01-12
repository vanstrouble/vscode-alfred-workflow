#!/usr/bin/env osascript -l JavaScript

// JXA script to open a new VS Code window.
// Supports: VS Code, VS Code Insiders, and VSCodium.

ObjC.import("Foundation");

const FILE_MANAGER = $.NSFileManager.defaultManager;

// VS Code variants configuration (DRY principle)
const VS_CODE_VARIANTS = [
	{ name: "Visual Studio Code", path: "/Applications/Visual Studio Code.app" },
	{ name: "Visual Studio Code - Insiders", path: "/Applications/Visual Studio Code - Insiders.app" },
	{ name: "VSCodium", path: "/Applications/VSCodium.app" },
];

/**
 * Checks if an application exists at path.
 * @param {string} path - The path to check.
 * @returns {boolean}
 */
function appExists(path) {
	return FILE_MANAGER.fileExistsAtPath(path);
}

/**
 * Finds the installed VS Code variant.
 * Optimized: Uses centralized constant and functional find() method.
 * @returns {string|null} Application name or null if not found.
 */
function findVSCodeVariant() {
	const variant = VS_CODE_VARIANTS.find(v => appExists(v.path));
	return variant?.name || null;
}

/**
 * Main entry point to open a new VS Code window.
 * Optimized: Cleaner logic flow and better variable naming.
 */
function run() {
	"use strict";

	const appName = findVSCodeVariant();

	if (!appName) {
		return "VS Code not found";
	}

	// Initialize applications
	const VSCode = Application(appName);
	const SystemEvents = Application("System Events");
	VSCode.includeStandardAdditions = true;

	// Check if VS Code is already running
	const vscodeWasRunning = VSCode.running();

	// Open a new window
	if (!vscodeWasRunning) {
		VSCode.activate(); // Opens one window automatically
		delay(0.5);
	} else {
		VSCode.activate();
		// Open a new window using keyboard shortcut (Cmd + Shift + N)
		SystemEvents.keystroke("n", {
			using: ["command down", "shift down"],
		});
	}
}
