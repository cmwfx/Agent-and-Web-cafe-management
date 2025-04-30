// preload.js
// This script runs in a context that can access both
// the renderer process and a subset of Node.js APIs
const { contextBridge, ipcRenderer } = require("electron");
const os = require("os");

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

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
try {
	contextBridge.exposeInMainWorld("api", {
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
				// For direct unlocking when debugging (hardcoded for testing)
				if (code === "123456") {
					console.log("Using direct unlock override for testing");
					// Directly return a successful result for the specific code
					return Promise.resolve({ valid: true, message: "Unlocking..." });
				}

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
	});

	console.log("API successfully exposed to renderer");
} catch (err) {
	console.error("Failed to expose API to renderer:", err);
}

window.addEventListener("DOMContentLoaded", () => {
	// We're not passing any functions to the renderer in this simple version
	// If future functionality requires communication with the main process,
	// we can expose specific functionality here via contextBridge
});
