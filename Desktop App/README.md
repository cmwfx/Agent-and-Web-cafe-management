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
- Auto-start on Windows boot
- Self-registration with Supabase

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd <repository-name>/Desktop\ App

# Set up environment variables
cp .env.example .env
# Edit .env file with your Supabase credentials

# Install dependencies
npm install

# Package the application for Windows
npm run dist
```

## Environment Variables

This application uses environment variables to store sensitive information like API keys. Before running the application:

1. Copy the `.env.example` file to a new file named `.env`
2. Replace the placeholder values with your actual Supabase credentials

**Note:** The `.env` file contains sensitive information and should never be committed to version control.

## Usage

For development:

```bash
# Start the application
npm start
```

For production:

- Install the packaged application
- The app will automatically launch on system startup
- Each machine will automatically register itself with the Supabase backend

## Unlock Mechanism

The application uses a code validation system with the following process:

1. Each computer is identified by its hostname
2. Unlock codes are specific to each machine and have an expiration time
3. Enter a valid code in the input field and click "Unlock" or press Enter
4. The application validates the code against the Supabase database
5. If valid, the application will temporarily hide, allowing access to the desktop
6. After 30 minutes, the lock screen will reappear

## Auto-Start & Registration

- The application automatically registers itself to start when Windows boots:
  - Creates a registry entry in `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`
  - Also creates a backup shortcut in the Windows Startup folder
- On first run, the machine registers itself in the Supabase `machines` table
  - Captures hostname, OS details, and system information
  - Updates its "last seen" timestamp on each launch

## Important Notes

- This application is intended as a security mechanism
- It's designed to be difficult to escape without proper authorization
- Administrators can still terminate the process through Task Manager if needed
- Unlock codes are one-time use only - once used, a code cannot be used again
- Codes are validated against the machine's hostname, so codes from one machine won't work on another

## Development

- Phase 1: Basic lock screen functionality
- Phase 2: Added unlock code validation via Supabase
- Phase 3: Added machine self-registration and auto-start functionality
- Future phases: Additional security features and management interface
