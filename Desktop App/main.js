const {
	app,
	BrowserWindow,
	globalShortcut,
	Menu,
	screen,
	ipcMain,
} = require("electron");
const path = require("path");
const url = require("url");
const os = require("os");
const { createClient } = require("@supabase/supabase-js");

// Supabase configuration
const SUPABASE_URL = "https://cecxwuddkezuvjfqriwm.supabase.co";
const SUPABASE_KEY =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlY3h3dWRka2V6dXZqZnFyaXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMDgxNDgsImV4cCI6MjA2MTU4NDE0OH0._cYVO7QoNn7vZXLuCE1yZPPSwFD1hxHyJINYfBUuZzY";

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Get the hostname (machine ID)
const hostname = os.hostname();

// Prevent multiple instances of the app
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
	app.quit();
	return;
}

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

function createWindow() {
	// Get the primary display size
	const { width, height } = screen.getPrimaryDisplay().workAreaSize;

	// Create the browser window
	mainWindow = new BrowserWindow({
		width: width,
		height: height,
		x: 0,
		y: 0,
		fullscreen: true,
		kiosk: true,
		frame: false,
		transparent: false,
		resizable: false,
		movable: false,
		minimizable: false,
		maximizable: false,
		closable: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			enableRemoteModule: false,
			preload: path.join(__dirname, "preload.js"),
		},
	});

	// Load the index.html file
	mainWindow.loadURL(
		url.format({
			pathname: path.join(__dirname, "index.html"),
			protocol: "file:",
			slashes: true,
		})
	);

	// Prevent the window from being closed
	mainWindow.on("close", (event) => {
		event.preventDefault();
	});

	// Remove menu
	Menu.setApplicationMenu(null);
}

// Create window when Electron has finished initialization
app.whenReady().then(() => {
	createWindow();

	// Register global shortcuts to prevent common ways to exit kiosk mode
	globalShortcut.registerAll(
		["Alt+F4", "CommandOrControl+W", "CommandOrControl+Q", "Escape", "F11"],
		() => {
			// Prevent these shortcuts from working
			return false;
		}
	);

	// Register other common shortcuts
	globalShortcut.register("CommandOrControl+Shift+I", () => {
		// Prevent DevTools from being opened
		return false;
	});

	globalShortcut.register("CommandOrControl+R", () => {
		// Prevent refreshing
		return false;
	});

	// Windows-specific Alt+Tab handling can be more complex
	// Ensuring the app stays on top helps mitigate this
});

// IPC handler for code validation
ipcMain.handle("validate-code", async (event, code) => {
	try {
		console.log(`Validating code ${code} for machine ${hostname}`);

		// Query the lock_codes table to check if the code is valid
		const { data, error } = await supabase
			.from("lock_codes")
			.select("*")
			.eq("code", code)
			.eq("machine_id", hostname)
			.eq("used", false)
			.gt("expires_at", new Date().toISOString())
			.limit(1)
			.single();

		if (error) {
			console.error("Supabase query error:", error);
			return {
				valid: false,
				message: "Error validating code. Please try again.",
			};
		}

		if (!data) {
			return { valid: false, message: "Invalid or expired code." };
		}

		console.log("Valid code found:", data);

		// Mark the code as used
		const { error: updateError } = await supabase
			.from("lock_codes")
			.update({ used: true })
			.eq("id", data.id);

		if (updateError) {
			console.error("Error marking code as used:", updateError);
			// Still proceed with unlocking even if updating fails
		}

		return { valid: true, message: "Unlocking..." };
	} catch (err) {
		console.error("Validation error:", err);
		return { valid: false, message: "An error occurred. Please try again." };
	}
});

// IPC handler to exit the app
ipcMain.on("exit-app", () => {
	// Allow the app to be closed temporarily
	if (mainWindow) {
		mainWindow.hide();

		// Re-show the lock screen after 30 minutes (1800000 ms)
		// This ensures the computer is locked again after a period of inactivity
		setTimeout(() => {
			if (mainWindow) {
				mainWindow.show();
				mainWindow.focus();
			}
		}, 1800000);
	}
});

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	// On macOS it's common to re-create a window when the dock icon is clicked
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});

// Handle second-instance launch attempts
app.on("second-instance", () => {
	// Focus the locked window if someone tries to open another instance
	if (mainWindow) {
		if (mainWindow.isMinimized()) mainWindow.restore();
		mainWindow.focus();
	}
});

// Prevent the app from exiting on window close
app.on("before-quit", (event) => {
	event.preventDefault();
});
