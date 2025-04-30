// preload.js
// This script runs in a context that can access both
// the renderer process and a subset of Node.js APIs

window.addEventListener("DOMContentLoaded", () => {
	// We're not passing any functions to the renderer in this simple version
	// If future functionality requires communication with the main process,
	// we can expose specific functionality here via contextBridge
});
