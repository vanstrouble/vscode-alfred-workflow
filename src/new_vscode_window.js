#!/usr/bin/env osascript -l JavaScript

// JXA script to open a new VS Code window.
// Supports: VS Code, VS Code Insiders, and VSCodium.

ObjC.import("Foundation");

const FILE_MANAGER = $.NSFileManager.defaultManager;

/**
 * Checks if an application exists at path
 */
function appExists(path) {
	return FILE_MANAGER.fileExistsAtPath(path);
}

/**
 * Finds the installed VS Code variant
 * @returns {string|null} Application name or null if not found
 */
function findVSCodeVariant() {
	const variants = [
		{ name: "Visual Studio Code", path: "/Applications/Visual Studio Code.app" },
		{ name: "Visual Studio Code - Insiders", path: "/Applications/Visual Studio Code - Insiders.app" },
		{ name: "VSCodium", path: "/Applications/VSCodium.app" },
	];

	for (const variant of variants) {
		if (appExists(variant.path)) {
			return variant.name;
		}
	}
	return null;
}

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

	// --- VS Code Automation ---

	const vscodeWasRunning = VSCode.running();

	// Ensure VS Code is running and activate it
	if (!vscodeWasRunning) {
		VSCode.activate(); // This will open one window
		delay(0.5);
	} else {
		VSCode.activate();
		// Open a new window using keyboard shortcut (Cmd + Shift + N)
		SystemEvents.keystroke("n", {
			using: ["command down", "shift down"],
		});
	}
}
