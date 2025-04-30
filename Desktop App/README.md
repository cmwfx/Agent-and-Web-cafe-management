# Kiosk Lock Application

This Electron.js application serves as a kiosk-style lock screen for PCs.

## Features

- Launches in fullscreen kiosk mode
- No window borders or controls (frameless)
- Not closable via normal user actions (Alt+F4, Ctrl+W, Escape, etc.)
- Blocks access to context menus, DevTools, and system shortcuts
- Persistent - prevents closure attempts
- Simple lock screen with lock icon and message
- Code validation using Supabase backend
- Machine-specific unlock codes with expiration

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

## Unlock Mechanism

The application uses a code validation system with the following process:

1. Each computer is identified by its hostname
2. Unlock codes are specific to each machine and have an expiration time
3. Enter a valid code in the input field and click "Unlock" or press Enter
4. The application validates the code against the Supabase database
5. If valid, the application will temporarily hide, allowing access to the desktop
6. After 30 minutes, the lock screen will reappear

## Important Notes

- This application is intended as a security mechanism
- It's designed to be difficult to escape without proper authorization
- Administrators can still terminate the process through Task Manager if needed
- Unlock codes are one-time use only - once used, a code cannot be used again
- Codes are validated against the machine's hostname, so codes from one machine won't work on another

## Development

- Phase 1: Basic lock screen functionality
- Phase 2: Added unlock code validation via Supabase
- Future phases: Additional security features and management interface
