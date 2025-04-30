const { app, BrowserWindow, globalShortcut, Menu, screen } = require('electron');
const path = require('path');
const url = require('url');

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
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the index.html file
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }));

  // Prevent the window from being closed
  mainWindow.on('close', (event) => {
    event.preventDefault();
  });

  // Remove menu
  Menu.setApplicationMenu(null);
}

// Create window when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  // Register global shortcuts to prevent common ways to exit kiosk mode
  globalShortcut.registerAll(['Alt+F4', 'CommandOrControl+W', 'CommandOrControl+Q', 'Escape', 'F11'], () => {
    // Prevent these shortcuts from working
    return false;
  });

  // Register other common shortcuts
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    // Prevent DevTools from being opened
    return false;
  });

  globalShortcut.register('CommandOrControl+R', () => {
    // Prevent refreshing
    return false;
  });

  // Windows-specific Alt+Tab handling can be more complex
  // Ensuring the app stays on top helps mitigate this
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window when the dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle second-instance launch attempts
app.on('second-instance', () => {
  // Focus the locked window if someone tries to open another instance
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Prevent the app from exiting on window close
app.on('before-quit', (event) => {
  event.preventDefault();
}); 