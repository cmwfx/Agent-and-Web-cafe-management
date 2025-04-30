// preload.js
// This script runs in a context that can access both
// the renderer process and a subset of Node.js APIs
const { contextBridge, ipcRenderer } = require("electron");
const os = require("os");

// Debug: Log the exact hostname
console.log("Hostname is:", os.hostname());

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", {
	// Get the hostname (machine ID)
	getHostname: () => os.hostname(),

	// Send validation request to main process
	validateCode: (code) => ipcRenderer.invoke("validate-code", code),

	// Exit/hide the application when a valid code is provided
	exitApp: () => ipcRenderer.send("exit-app"),
});

window.addEventListener("DOMContentLoaded", () => {
	// We're not passing any functions to the renderer in this simple version
	// If future functionality requires communication with the main process,
	// we can expose specific functionality here via contextBridge
});
