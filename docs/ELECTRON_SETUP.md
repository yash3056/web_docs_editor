# Web Docs Editor - Electron App

A modern document editor wrapped as an Electron desktop application with proper database initialization in the user's AppData directory.

## Features

✅ **Electron Desktop App** - Native desktop application experience
✅ **Database in AppData** - SQLite database stored in `C:\Users\<username>\AppData\Roaming\WebDocsEditor\app.db`
✅ **Version Control** - Built-in document versioning system
✅ **Document Classification** - AI-powered document security classification
✅ **Export Functionality** - Export documents as PDF, DOCX, etc.
✅ **User Authentication** - Secure login system
✅ **Native Menus** - Electron-style application menus

## Database Location

The application now properly stores the SQLite database in the user's AppData directory:
- **Windows**: `C:\Users\<username>\AppData\Roaming\WebDocsEditor\app.db`
- **Development**: Local directory for development mode

## Running the Application

### Development Mode
```bash
npm run electron
```

### Build for Distribution
```bash
npm run build
```

## Quick Start Scripts

For convenience, use these batch files:
- `run-electron.bat` - Start the app in development mode
- `build-app.bat` - Build the app for distribution

## Application Structure

```
web_docs_editor/
├── electron/
│   ├── main.js          # Electron main process
│   ├── preload.js       # Preload script for secure communication
│   └── splash.html      # Splash screen
├── server.js            # Express server (updated for Electron)
├── database.js          # Database with AppData path handling
├── package.json         # Updated with Electron scripts

├── images/
│   └── logo.png         # Application icon
└── dist-windows/        # Build output directory
```

## Key Changes Made

1. **Database Path**: Updated `database.js` to use AppData directory in production
2. **Electron Main**: Created `main.js` with proper window management
3. **Preload Script**: Added secure communication between main and renderer
4. **Server Integration**: Modified `server.js` to work with Electron environment
5. **Build Configuration**: Added Electron Builder configuration
6. **Development Scripts**: Added convenient npm scripts for development and building

## Build Output

The built application will be in the `dist-windows` folder and can be installed on any Windows machine.

## Troubleshooting

- If the app doesn't start, check that port 3000 is available
- Database location: `C:\Users\<username>\AppData\Roaming\WebDocsEditor\app.db`
- For development issues, check the console output in the terminal

## Next Steps

- The app is ready for distribution
- Consider code signing for production releases
- Add auto-updater functionality if needed
