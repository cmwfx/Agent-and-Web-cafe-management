# Cafe Management System

This repository contains a comprehensive solution for cafe management, including multiple components:

## Components

### 1. Kiosk Lock Application (Desktop App)

An Electron.js desktop application that acts as a kiosk-style lock screen to secure cafe computers.

- **Location**: `./Desktop App/`
- **Status**: Phase 3 completed - Lock screen with code validation, machine registration, and auto-start
- **Features**:
  - Fullscreen kiosk mode
  - Prevention of closure via keyboard shortcuts
  - Simple lock screen UI
  - Code validation using Supabase
  - Machine-specific unlock codes with expiration
  - Auto-start on Windows boot
  - Machine self-registration in Supabase database

### Future Components

Additional components for the cafe management system will be added in future updates.

## Getting Started

Each component has its own README with specific instructions for installation and usage.

## Repository Structure

```
.
├── Desktop App/         # Kiosk Lock Application
│   ├── main.js          # Main Electron process
│   ├── index.html       # Lock screen UI
│   ├── preload.js       # Preload script for security
│   └── ...
└── ...                  # Future components
```

## Database Structure

The application uses a Supabase database with the following tables:

### lock_codes Table

| Column     | Type      | Description                                     |
| ---------- | --------- | ----------------------------------------------- |
| id         | uuid      | Primary key                                     |
| code       | string    | Unique unlock code                              |
| machine_id | string    | Computer hostname this code works for           |
| created_at | timestamp | When the code was created                       |
| expires_at | timestamp | When the code expires                           |
| used       | boolean   | Whether the code has been used (default: false) |

### machines Table

| Column        | Type      | Description                            |
| ------------- | --------- | -------------------------------------- |
| id            | uuid      | Primary key                            |
| machine_id    | string    | Computer hostname (unique identifier)  |
| registered_at | timestamp | When the machine was first registered  |
| last_seen_at  | timestamp | Last time the machine launched the app |
| metadata      | jsonb     | System information (OS, specs, etc.)   |

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
