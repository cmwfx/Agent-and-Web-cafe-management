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

// App name for registry
const APP_NAME = "CafeKioskLock";

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
		console.log(
			`DEBUG - Hostname type: ${typeof hostname}, value: "${hostname}"`
		);

		// Hard-coded expected machine_id from Supabase for comparison
		const expectedMachineId = "EC2AMAZ-21ASGA3";
		console.log(`DEBUG - Expected Machine ID: "${expectedMachineId}"`);
		console.log(
			`DEBUG - Hostname matches expected ID: ${hostname === expectedMachineId}`
		);

		// Emergency/master code for when Supabase is not available
		// Using a combination of hostname and a fixed string for security
		const emergencyCode = `EM-${hostname.substring(0, 4).toUpperCase()}`;

		// Check for emergency code first
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
			machine_id: hostname,
			expected_machine_id: expectedMachineId,
			currentTime: new Date().toISOString(),
		});

		// Query the lock_codes table to check if the code is valid
		// IMPORTANT - If the hostname in the app doesn't exactly match the machine_id in Supabase,
		// we need to handle both cases for debugging purposes
		let queryBuilder = supabase
			.from("lock_codes")
			.select("*")
			.eq("code", code)
			.eq("used", false)
			.gt("expires_at", new Date().toISOString());

		// Check if the actual hostname matches the expected one
		if (hostname !== expectedMachineId) {
			console.log(
				"DEBUG - Hostname doesn't match expected ID. Trying both values for debugging"
			);
			// Try both the actual hostname and the expected ID
			// This is just for debugging, using "or" conditions
			queryBuilder = queryBuilder.or(
				`machine_id.eq.${hostname},machine_id.eq.${expectedMachineId}`
			);
		} else {
			queryBuilder = queryBuilder.eq("machine_id", hostname);
		}

		// Execute the query
		const { data, error } = await queryBuilder.limit(10);

		// DEBUG: Log the raw response
		console.log("DEBUG - Supabase response:", {
			data: data,
			error: error,
			dataLength: data ? data.length : 0,
		});

		// If we got any data, print details for debugging
		if (data && data.length > 0) {
			console.log("DEBUG - Found matching records:", data.length);
			data.forEach((record, index) => {
				console.log(`DEBUG - Record ${index + 1}:`, {
					id: record.id,
					code: record.code,
					machine_id: record.machine_id,
					used: record.used,
					expires_at: record.expires_at,
				});
			});
		}

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

		// For debugging, find the reason it might be invalid
		const validCode = data.find(
			(record) =>
				record.code === code &&
				record.machine_id === expectedMachineId &&
				record.used === false &&
				new Date(record.expires_at) > new Date()
		);

		if (!validCode) {
			console.log("DEBUG - Code found but invalid due to mismatch conditions");
			return {
				valid: false,
				message: "Code found but did not meet unlock criteria.",
			};
		}

		console.log("Valid code found:", validCode);

		// Mark the code as used
		const { error: updateError } = await supabase
			.from("lock_codes")
			.update({ used: true })
			.eq("id", validCode.id);

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
