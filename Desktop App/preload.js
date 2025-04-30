// preload.js
// This script runs in a context that can access both
// the renderer process and a subset of Node.js APIs
const { contextBridge, ipcRenderer } = require("electron");
const os = require("os");

// Debug: Log the exact hostname
const hostname = os.hostname();
console.log("Hostname is:", hostname);
console.log("Expected Hostname for Supabase: EC2AMAZ-21ASGA3");
console.log(
	"Hostname match:",
	hostname === "EC2AMAZ-21ASGA3" ? "YES" : "NO - CASE MISMATCH"
);

// Check for any whitespace or special characters
console.log("Hostname length:", hostname.length);
console.log("Hostname encoded:", encodeURIComponent(hostname));

// For debugging, show character codes
console.log(
	"Hostname character codes:",
	Array.from(hostname).map((char) => char.charCodeAt(0))
);
console.log(
	"Expected ID character codes:",
	Array.from("EC2AMAZ-21ASGA3").map((char) => char.charCodeAt(0))
);

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", {
	// Get the hostname (machine ID)
	getHostname: () => hostname,

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
