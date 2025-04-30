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
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

// For Windows auto-start functionality
const { execSync } = require("child_process");
const fs = require("fs");

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// App name for registry
const APP_NAME = "CafeKioskLock";

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Get the hostname (machine ID)
const hostname = os.hostname();

// Function to register or update machine in Supabase
async function registerMachine() {
	try {
		console.log(`Checking registration for machine: ${hostname}`);

		// Get machine metadata
		const metadata = {
			platform: os.platform(),
			version: os.version(),
			type: os.type(),
			arch: os.arch(),
			release: os.release(),
			totalMemory: os.totalmem(),
			cpus: os.cpus().length,
			userInfo: os.userInfo().username,
		};

		// Current timestamp
		const now = new Date().toISOString();

		// Check if machine exists in database
		const { data, error } = await supabase
			.from("machines")
			.select("*")
			.eq("machine_id", hostname)
			.maybeSingle();

		if (error) {
			console.error("Error checking machine registration:", error);
			return;
		}

		if (!data) {
			// Machine doesn't exist, register it
			console.log("Machine not registered. Registering now...");

			const { error: insertError } = await supabase.from("machines").insert([
				{
					machine_id: hostname,
					registered_at: now,
					last_seen_at: now,
					metadata: metadata,
				},
			]);

			if (insertError) {
				console.error("Error registering machine:", insertError);
			} else {
				console.log("Machine registered successfully!");
			}
		} else {
			// Machine exists, update last_seen_at and metadata
			console.log("Machine already registered. Updating last_seen_at...");

			const { error: updateError } = await supabase
				.from("machines")
				.update({
					last_seen_at: now,
					metadata: metadata,
				})
				.eq("machine_id", hostname);

			if (updateError) {
				console.error("Error updating machine info:", updateError);
			} else {
				console.log("Machine info updated successfully!");
			}
		}
	} catch (err) {
		console.error("Machine registration error:", err);
	}
}

// Function to enable auto-start on Windows
function setupAutoLaunch() {
	if (process.platform === "win32") {
		try {
			console.log("Setting up auto-launch on Windows...");

			// Get current executable path
			const exePath = process.execPath;
			console.log(`Executable path: ${exePath}`);

			// Escape backslashes for registry
			const escapedPath = exePath.replace(/\\/g, "\\\\");

			// Create a registry command to add the app to auto-start
			const regCommand = `reg add "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${APP_NAME}" /t REG_SZ /d "${escapedPath}" /f`;

			// Execute the registry command
			execSync(regCommand);

			console.log("Auto-launch setup successful!");
		} catch (error) {
			console.error("Error setting up auto-launch:", error);
		}
	} else {
		console.log("Auto-launch setup is only supported on Windows.");
	}
}

// Function to create a startup shortcut (alternative method)
function createStartupShortcut() {
	if (process.platform === "win32") {
		try {
			console.log("Creating startup shortcut...");

			// Get appdata path
			const startupPath = path.join(
				process.env.APPDATA,
				"\\Microsoft\\Windows\\Start Menu\\Programs\\Startup"
			);
			const shortcutPath = path.join(startupPath, `${APP_NAME}.lnk`);

			// Only create if it doesn't exist
			if (!fs.existsSync(shortcutPath)) {
				// Create Windows shortcut using PowerShell
				const exePath = process.execPath;
				const psScript = `
					$WshShell = New-Object -comObject WScript.Shell
					$Shortcut = $WshShell.CreateShortcut("${shortcutPath}")
					$Shortcut.TargetPath = "${exePath}"
					$Shortcut.Save()
				`;

				// Write PowerShell script to temp file
				const tempFile = path.join(app.getPath("temp"), "create-shortcut.ps1");
				fs.writeFileSync(tempFile, psScript);

				// Execute PowerShell script
				execSync(`powershell -ExecutionPolicy Bypass -File "${tempFile}"`);

				// Clean up
				fs.unlinkSync(tempFile);

				console.log("Startup shortcut created successfully!");
			} else {
				console.log("Startup shortcut already exists.");
			}
		} catch (error) {
			console.error("Error creating startup shortcut:", error);
		}
	}
}

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
app.whenReady().then(async () => {
	// Register machine with Supabase
	await registerMachine();

	// Set up auto-launch on Windows
	if (app.isPackaged) {
		// Only set up auto-launch in production, not during development
		setupAutoLaunch();
		// Create shortcut as a backup method
		createStartupShortcut();
	}

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
