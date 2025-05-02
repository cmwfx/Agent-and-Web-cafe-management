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
const fs = require("fs");
const createShortcut = require("create-desktop-shortcuts");

// Log the Node.js version and app execution path
console.log(`Node.js version: ${process.version}`);
console.log(`App executable path: ${process.execPath}`);
console.log(`App is packaged: ${app.isPackaged}`);

// Single-instance guard
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
	console.log("Another instance is already running. Exiting.");
	app.quit();
	return;
}

// Function to load environment variables from multiple possible locations
function loadEnvironmentVariables() {
	// Possible locations for .env file
	const possibleLocations = [
		process.cwd(), // Current working directory
		__dirname, // Directory of the current script
		path.join(process.cwd(), ".."), // Parent of current working directory
		path.dirname(process.execPath), // Directory of the executable
	];

	// Try each location
	for (const location of possibleLocations) {
		const envPath = path.join(location, ".env");
		console.log(`Checking for .env at: ${envPath}`);

		if (fs.existsSync(envPath)) {
			console.log(`Found .env file at: ${envPath}`);
			dotenv.config({ path: envPath });

			if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
				console.log("Successfully loaded environment variables");
				return true;
			}
		}
	}

	// If we have hardcoded fallback values (not recommended for production)
	if (!process.env.SUPABASE_URL) {
		process.env.SUPABASE_URL = "https://cecxwuddkezuvjfqriwm.supabase.co";
	}
	if (!process.env.SUPABASE_KEY) {
		process.env.SUPABASE_KEY =
			"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlY3h3dWRka2V6dXZqZnFyaXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwMDgxNDgsImV4cCI6MjA2MTU4NDE0OH0._cYVO7QoNn7vZXLuCE1yZPPSwFD1hxHyJINYfBUuZzY";
	}

	return process.env.SUPABASE_URL && process.env.SUPABASE_KEY;
}

// Try to load environment variables
try {
	loadEnvironmentVariables();
} catch (err) {
	console.error("Error loading environment variables:", err);
}

// For Windows auto-start functionality
const { execSync } = require("child_process");

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Log for debugging
console.log(`SUPABASE_URL set: ${!!SUPABASE_URL}`);
console.log(`SUPABASE_KEY set: ${!!SUPABASE_KEY}`);

// App name for registry and shortcut - use the same name for consistency
const APP_NAME = "CafeConnect";
const APP_DISPLAY_NAME = "CafeConnect Kiosk";

// Initialize Supabase client with error handling
let supabase;
try {
	if (!SUPABASE_URL) {
		throw new Error("supabaseUrl is required");
	}
	if (!SUPABASE_KEY) {
		throw new Error("supabaseKey is required");
	}
	supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
	console.log("Supabase client initialized successfully");
} catch (error) {
	console.error("Failed to initialize Supabase client:", error);
	// Create a dummy client that won't crash the app but logs errors
	supabase = {
		from: () => ({
			select: () => ({
				eq: () => ({
					maybeSingle: () => Promise.resolve({ data: null, error: null }),
				}),
			}),
			insert: () =>
				Promise.resolve({
					error: new Error("Supabase not properly initialized"),
				}),
			update: () => ({
				eq: () =>
					Promise.resolve({
						error: new Error("Supabase not properly initialized"),
					}),
			}),
		}),
	};
}

// Get the hostname (machine ID)
const hostname = os.hostname();

// Function to register or update machine in Supabase
async function registerMachine() {
	try {
		// Skip registration if supabase isn't properly initialized
		if (!SUPABASE_URL || !SUPABASE_KEY) {
			console.warn(
				"Skipping machine registration: Supabase credentials not available"
			);
			return;
		}

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

// Function to get the startup shortcut path
function getStartupShortcutPath() {
	if (process.platform === "win32") {
		const startupFolder = path.join(
			process.env.APPDATA,
			"Microsoft\\Windows\\Start Menu\\Programs\\Startup"
		);
		return path.join(startupFolder, `${APP_NAME}.lnk`);
	}
	return null;
}

// Function to check if startup shortcut exists
function startupShortcutExists() {
	if (process.platform === "win32") {
		try {
			const shortcutPath = getStartupShortcutPath();
			console.log(`Checking for shortcut at: ${shortcutPath}`);

			// Check if shortcut exists
			const exists = fs.existsSync(shortcutPath);
			console.log(`Shortcut exists: ${exists}`);
			return exists;
		} catch (error) {
			console.error("Error checking for startup shortcut:", error);
			return false;
		}
	}
	return false;
}

// Function to enable auto-start on Windows (Registry method)
function setupAutoLaunch() {
	if (process.platform === "win32") {
		try {
			console.log("Setting up auto-launch on Windows via registry...");

			// Get current executable path
			const exePath = process.execPath;
			console.log(`Executable path: ${exePath}`);

			// Escape backslashes for registry
			const escapedPath = exePath.replace(/\\/g, "\\\\");

			// Create a registry command to add the app to auto-start
			const regCommand = `reg add "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${APP_NAME}" /t REG_SZ /d "${escapedPath}" /f`;
			console.log(`Registry command: ${regCommand}`);

			// Execute the registry command
			const result = execSync(regCommand).toString();
			console.log(`Registry command result: ${result}`);

			console.log("Auto-launch setup successful via registry!");
			return true;
		} catch (error) {
			console.error("Error setting up auto-launch via registry:", error);
			return false;
		}
	} else {
		console.log("Auto-launch setup is only supported on Windows.");
		return false;
	}
}

// Function to create a startup shortcut using create-desktop-shortcuts package
function createStartupShortcut() {
	if (process.platform === "win32") {
		try {
			// Check if the shortcut already exists
			const shortcutPath = getStartupShortcutPath();

			if (startupShortcutExists()) {
				console.log("🔄 Auto-start shortcut already present:", shortcutPath);
				return true;
			}

			console.log("Creating startup shortcut...");

			// Make sure the Startup folder exists
			const startupFolder = path.dirname(shortcutPath);
			console.log(`Ensuring startup folder exists: ${startupFolder}`);

			if (!fs.existsSync(startupFolder)) {
				console.log(
					`Startup folder doesn't exist, attempting to create: ${startupFolder}`
				);
				fs.mkdirSync(startupFolder, { recursive: true });
			}

			// Create shortcut using the package
			const options = {
				windows: {
					filePath: process.execPath,
					outputPath: path.dirname(shortcutPath),
					name: APP_NAME,
					comment: "CafeConnect Kiosk Application",
					// Try to use app icon if available
					icon: process.execPath,
					// Make sure it runs minimized/hidden
					windowMode: "normal",
					// Arguments to pass to the executable
					arguments: "",
				},
			};

			console.log(
				"Creating shortcut with options:",
				JSON.stringify(options, null, 2)
			);

			const success = createShortcut(options);

			if (success) {
				console.log("🔄 Auto-start shortcut created:", shortcutPath);
				return true;
			} else {
				console.error("Failed to create startup shortcut using package");

				// Fallback method - create shortcut using PowerShell
				console.log("Attempting fallback method with PowerShell...");

				const psScript = `
					$WshShell = New-Object -comObject WScript.Shell
					$Shortcut = $WshShell.CreateShortcut("${shortcutPath}")
					$Shortcut.TargetPath = "${process.execPath}"
					$Shortcut.Save()
					Write-Output "Shortcut created at: ${shortcutPath}"
				`;

				// Write PowerShell script to temp file
				const tempScriptPath = path.join(
					app.getPath("temp"),
					"create-shortcut.ps1"
				);
				fs.writeFileSync(tempScriptPath, psScript);

				// Execute PowerShell script
				const psResult = execSync(
					`powershell -ExecutionPolicy Bypass -File "${tempScriptPath}"`
				).toString();
				console.log("PowerShell result:", psResult);

				// Clean up
				fs.unlinkSync(tempScriptPath);

				// Verify shortcut was created
				const shortcutCreated = fs.existsSync(shortcutPath);
				console.log(`Shortcut created by PowerShell: ${shortcutCreated}`);

				return shortcutCreated;
			}
		} catch (error) {
			console.error("Error creating startup shortcut:", error);
			return false;
		}
	}
	return false;
}

// Function to remove startup shortcut
function removeStartupShortcut() {
	if (process.platform === "win32") {
		try {
			const shortcutPath = getStartupShortcutPath();
			console.log(`Attempting to remove shortcut: ${shortcutPath}`);

			if (fs.existsSync(shortcutPath)) {
				fs.unlinkSync(shortcutPath);
				console.log("Auto-start shortcut removed:", shortcutPath);
				return true;
			} else {
				console.log("No auto-start shortcut found to remove");
				return false;
			}
		} catch (error) {
			console.error("Error removing startup shortcut:", error);
			return false;
		}
	}
	return false;
}

// Function to remove registry auto-start entry
function removeRegistryAutoStart() {
	if (process.platform === "win32") {
		try {
			console.log(`Removing registry key for ${APP_NAME}...`);

			// Create a registry command to remove the app from auto-start
			const regCommand = `reg delete "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${APP_NAME}" /f`;

			// Execute the registry command
			const result = execSync(regCommand).toString();
			console.log("Registry key removal result:", result);

			console.log("Registry auto-start entry removed");
			return true;
		} catch (error) {
			console.error("Error removing registry auto-start:", error);
			return false;
		}
	}
	return false;
}

// Check for uninstall command line flag
function checkForUninstallFlag() {
	const hasUninstallFlag = process.argv.includes("--uninstall-startup");
	console.log(`Checking for uninstall flag. Args: ${process.argv.join(", ")}`);
	console.log(`Uninstall flag detected: ${hasUninstallFlag}`);

	if (hasUninstallFlag) {
		console.log("Uninstall flag detected, removing auto-start entries...");
		let shortcutRemoved = removeStartupShortcut();
		let registryRemoved = removeRegistryAutoStart();

		console.log(
			`Auto-start removal completed. Shortcut: ${shortcutRemoved}, Registry: ${registryRemoved}`
		);
		app.quit();
		return true;
	}
	return false;
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
			nodeIntegration: true, // Enable Node integration for testing
			contextIsolation: true,
			enableRemoteModule: false,
			preload: path.join(__dirname, "preload.js"),
			sandbox: false, // Disable sandbox for testing
		},
	});

	// Load the index.html file
	const indexPath = path.join(__dirname, "index.html");
	console.log(`Loading HTML from: ${indexPath}`);

	mainWindow.loadURL(
		url.format({
			pathname: indexPath,
			protocol: "file:",
			slashes: true,
		})
	);

	// For debugging purposes - open DevTools in development
	if (!app.isPackaged) {
		mainWindow.webContents.openDevTools();
		console.log("DevTools opened for debugging");
	}

	// Debug info for preload script
	console.log(`Preload script path: ${path.join(__dirname, "preload.js")}`);
	console.log(
		`Preload script exists: ${fs.existsSync(
			path.join(__dirname, "preload.js")
		)}`
	);

	// Log when preload script is loaded
	mainWindow.webContents.on("did-finish-load", () => {
		console.log("Main window finished loading");
	});

	// Prevent the window from being closed
	mainWindow.on("close", (event) => {
		event.preventDefault();
	});

	// Remove menu
	Menu.setApplicationMenu(null);
}

// Create window when Electron has finished initialization
app.whenReady().then(async () => {
	// Log all startup arguments
	console.log("App starting with arguments:", process.argv);

	// Check for uninstall flag before starting the app
	if (checkForUninstallFlag()) {
		return;
	}

	// Register machine with Supabase
	await registerMachine();

	// Set up auto-launch on Windows - only in packaged app
	if (app.isPackaged) {
		console.log("Setting up auto-launch mechanisms...");

		// Try both methods to ensure at least one works
		const shortcutCreated = createStartupShortcut();
		const registrySet = setupAutoLaunch();

		console.log(
			`Auto-launch setup results - Shortcut: ${shortcutCreated}, Registry: ${registrySet}`
		);
	} else {
		console.log("Skipping auto-launch setup in development mode");
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
		// Use a fixed machine ID for now to overcome hostname issues
		const actualHostname = hostname || "unknown";
		const expectedMachineId = "EC2AMAZ-21ASGA3";

		console.log(`Validating code ${code} for machine ${actualHostname}`);
		console.log(
			`DEBUG - Hostname type: ${typeof actualHostname}, value: "${actualHostname}"`
		);
		console.log(`DEBUG - Expected Machine ID: "${expectedMachineId}"`);
		console.log(
			`DEBUG - Hostname matches expected ID: ${
				actualHostname === expectedMachineId
			}`
		);

		// Regular emergency code
		const emergencyCode = `EM-${actualHostname.substring(0, 4).toUpperCase()}`;
		if (code === emergencyCode) {
			console.log("Emergency code used");
			return { valid: true, message: "Emergency override accepted" };
		}

		// Check if Supabase is properly initialized
		if (!SUPABASE_URL || !SUPABASE_KEY) {
			console.warn("Supabase not initialized for code validation");
			return {
				valid: false,
				message:
					"Validation service unavailable. Try again or contact support.",
			};
		}

		// DEBUG: Show Supabase query parameters
		console.log("DEBUG - Query parameters:", {
			code: code,
			machine_id: expectedMachineId, // Always use the expected ID
			currentTime: new Date().toISOString(),
		});

		// Query the lock_codes table directly using the expected ID, not the hostname
		const { data, error } = await supabase
			.from("lock_codes")
			.select("*")
			.eq("code", code)
			.eq("machine_id", expectedMachineId) // Force this to use expected ID
			.eq("used", false) // Only use unused codes
			.gt("expires_at", new Date().toISOString()) // Check expiration
			.limit(1);

		// DEBUG: Log the raw response
		console.log("DEBUG - Supabase response:", {
			data: data,
			error: error,
			dataLength: data ? data.length : 0,
		});

		if (error) {
			console.error("Supabase query error:", error);
			return {
				valid: false,
				message: "Error validating code. Please try again.",
			};
		}

		if (!data || data.length === 0) {
			return { valid: false, message: "Invalid or expired code." };
		}

		// Found a valid code
		const foundCode = data[0];
		console.log("DEBUG - Valid code found:", foundCode);

		// Mark the code as used with a direct UPDATE query
		try {
			console.log(`Updating code ${foundCode.id} to mark as used...`);

			// Try a more direct approach first - using RPC if available
			const updateResult = await fetch(
				`${SUPABASE_URL}/rest/v1/rpc/mark_code_as_used`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						apikey: SUPABASE_KEY,
						Authorization: `Bearer ${SUPABASE_KEY}`,
						Prefer: "return=minimal",
					},
					body: JSON.stringify({
						code_id: foundCode.id,
					}),
				}
			).catch((err) => {
				console.error("RPC update failed:", err);
				return { ok: false };
			});

			if (!updateResult.ok) {
				console.log(
					"RPC update failed or not available, trying direct update..."
				);

				// Try direct PATCH with explicit Content-Type
				const directUpdate = await fetch(
					`${SUPABASE_URL}/rest/v1/lock_codes?id=eq.${foundCode.id}`,
					{
						method: "PATCH",
						headers: {
							"Content-Type": "application/json",
							apikey: SUPABASE_KEY,
							Authorization: `Bearer ${SUPABASE_KEY}`,
							Prefer: "return=minimal",
						},
						body: JSON.stringify({
							used: true,
						}),
					}
				);

				console.log(`Direct update status: ${directUpdate.status}`);

				if (!directUpdate.ok) {
					// Last resort, try a POST to the table with conflict handling
					console.log("Trying upsert approach...");
					const upsertUpdate = await fetch(
						`${SUPABASE_URL}/rest/v1/lock_codes`,
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								apikey: SUPABASE_KEY,
								Authorization: `Bearer ${SUPABASE_KEY}`,
								Prefer: "resolution=merge-duplicates",
							},
							body: JSON.stringify({
								id: foundCode.id,
								code: foundCode.code,
								machine_id: foundCode.machine_id,
								expires_at: foundCode.expires_at,
								used: true,
							}),
						}
					);

					console.log(`Upsert update status: ${upsertUpdate.status}`);
				}
			} else {
				console.log("Successfully marked code as used via RPC");
			}

			return { valid: true, message: "Unlocking..." };
		} catch (updateErr) {
			console.error("Exception in update operation:", updateErr);
			// Continue anyway - we'll still unlock even if the update fails
			return { valid: true, message: "Unlocking..." };
		}
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
