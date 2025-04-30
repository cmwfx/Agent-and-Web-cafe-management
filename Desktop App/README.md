# Kiosk Lock Application

This Electron.js application serves as a kiosk-style lock screen for PCs.

## Features

- Launches in fullscreen kiosk mode
- No window borders or controls (frameless)
- Not closable via normal user actions (Alt+F4, Ctrl+W, Escape, etc.)
- Blocks access to context menus, DevTools, and system shortcuts
- Persistent - prevents closure attempts
- Simple lock screen with lock icon and message

## Installation

```bash
# Install dependencies
npm install
```

## Usage

```bash
# Start the application
npm start
```

## Important Notes

- This application is intended as a security mechanism
- It's designed to be difficult to escape without proper authorization
- Administrators can still terminate the process through Task Manager if needed
- Future versions will include authentication mechanisms to unlock

## Development

This is Phase 1 of a PC lock mechanism, displaying a simple lock screen. Subsequent phases will add authentication and additional security features.
