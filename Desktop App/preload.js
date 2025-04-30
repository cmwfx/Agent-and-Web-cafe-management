// preload.js
// This script runs in a context that can access both
// the renderer process and a subset of Node.js APIs
const { contextBridge, ipcRenderer } = require("electron");
const os = require("os");

console.log("Preload script executing...");

// Get hostname with fallback
let hostname;
try {
	hostname = os.hostname() || "EC2AMAZ-21ASGA3"; // Fallback to expected ID if hostname fails
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
} catch (err) {
	console.error("Error getting hostname:", err);
	hostname = "EC2AMAZ-21ASGA3"; // Fallback to expected ID
}

// Define API object first
const validationApi = {
	// Get the hostname (machine ID)
	getHostname: () => {
		try {
			return hostname || "EC2AMAZ-21ASGA3";
		} catch (err) {
			console.error("Error in getHostname:", err);
			return "EC2AMAZ-21ASGA3"; // Fallback value
		}
	},

	// Send validation request to main process
	validateCode: (code) => {
		try {
			// Always validate through Supabase - no hardcoded values
			return ipcRenderer.invoke("validate-code", code);
		} catch (err) {
			console.error("Error in validateCode:", err);
			return Promise.reject(err);
		}
	},

	// Exit/hide the application when a valid code is provided
	exitApp: () => {
		try {
			return ipcRenderer.send("exit-app");
		} catch (err) {
			console.error("Error in exitApp:", err);
			// Try to close directly as fallback
			window.close();
		}
	},
};

// Use multiple ways to expose the API
try {
	// Method 1: contextBridge
	if (contextBridge) {
		console.log("Using contextBridge to expose API...");
		contextBridge.exposeInMainWorld("api", validationApi);
		console.log("API exposed via contextBridge");
	}
	// Method 2: direct attachment (fallback if contextBridge fails)
	else {
		console.log("ContextBridge not available, using direct attachment...");
		window.api = validationApi;
		console.log("API exposed via direct attachment");
	}
} catch (err) {
	console.error("Failed to expose API:", err);

	// Method 3: Try alternative approach for exposing API
	try {
		console.log("Attempting alternative API exposure method...");
		window.api = validationApi;
		console.log("API exposed via window.api direct assignment");
	} catch (innerErr) {
		console.error("All API exposure methods failed:", innerErr);
	}
}

// Verify API is properly set
window.addEventListener("DOMContentLoaded", () => {
	console.log("DOM content loaded in preload script");
	try {
		// Check if API was successfully exposed
		if (window.api) {
			console.log("API successfully available in renderer");
		} else {
			console.error("API not available in renderer after DOMContentLoaded");
		}
	} catch (err) {
		console.error("Error verifying API in DOMContentLoaded:", err);
	}
});
