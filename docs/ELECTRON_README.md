# Web Docs Editor - Electron App

This is the Electron version of the Web Docs Editor application.

## Features

- ✅ **Cross-platform desktop app** - Runs on Windows, macOS, and Linux
- ✅ **Proper database location** - Database stored in user's AppData directory
- ✅ **Native desktop integration** - System menus, keyboard shortcuts, and native dialogs
- ✅ **Offline capability** - Works without internet connection
- ✅ **Auto-updater ready** - Built with Electron Builder for easy updates

## Database Location

The SQLite database is now properly stored in:
- **Windows**: `C:\Users\<username>\AppData\Roaming\WebDocsEditor\app.db`
- **macOS**: `~/Library/Application Support/WebDocsEditor/app.db`
- **Linux**: `~/.config/WebDocsEditor/app.db`

## Development Commands

### Run in Development Mode
```bash
npm run electron
```

### Build for Production
```bash
# Build for Windows
npm run build

# Build for all platforms
npm run build-all
```

### Alternative Development Workflow
```bash
# Run with hot reload (if you have nodemon watching)
npm run electron-dev
```

## Scripts Available

- `npm run electron` - Run the Electron app
- `npm run build` - Build Windows executable
- `npm run build-all` - Build for Windows, macOS, and Linux
- `npm run electron-dev` - Development mode with hot reload
- `npm start` - Run as web app (standalone server)

## Windows Batch Files

For convenience, there are batch files available:
- `run-electron.bat` - Double-click to run the app
- `build-app.bat` - Double-click to build the app

## Build Output

Built applications will be placed in the `dist-windows` directory:
- Installer: `dist-windows/Web Docs Editor Setup 1.0.0.exe`
- Portable: `dist-windows/win-unpacked/Web Docs Editor.exe`

## Key Features

1. **Native Menu Bar** - File, Edit, View, Window, Help menus
2. **Keyboard Shortcuts** - Standard shortcuts like Ctrl+N, Ctrl+O, Ctrl+S
3. **System Integration** - Native file dialogs and notifications
4. **Proper App Icon** - Custom icon for the application
5. **Auto-start Server** - Backend server starts automatically

## Troubleshooting

### Database Issues
- The app automatically creates the database in the user's AppData directory
- If you encounter database issues, delete the `WebDocsEditor` folder from AppData and restart

### Port Conflicts
- The app uses port 3000 by default
- If port 3000 is occupied, the app will show an error
- You can change the port by setting the `PORT` environment variable

### Build Issues
- Make sure Node.js and npm are properly installed
- Run `npm install` to ensure all dependencies are installed
- For Windows builds, you may need Visual Studio Build Tools

## Security Notes

- The app runs a local server on localhost only
- Database is stored locally and encrypted
- No data is sent to external servers unless explicitly configured

## File Structure

```
├── electron/
│   ├── main.js      # Main Electron process
│   ├── preload.js   # Preload script for security
│   └── splash.html  # Splash screen
├── server.js        # Express server (updated for Electron)
├── database.js      # Database layer (updated for AppData)
├── package.json     # Updated with Electron scripts
├── index.html       # Main app interface

└── images/
    └── logo.png     # App icon
```

## Next Steps

1. **Run the app**: `npm run electron`
2. **Test all features**: Document creation, editing, version control
3. **Build for distribution**: `npm run build`
4. **Install and test**: Run the installer from `dist-windows`

The app is now ready for distribution as a standalone desktop application!
