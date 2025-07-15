# Web Docs Editor - Standalone Version

## Overview

This is a standalone version of the Web Docs Editor that runs entirely in your web browser without requiring Node.js, NPM, or any server installation. It's perfect for office environments where NPM cannot be installed and works completely offline.

## Features

- ✅ **No Installation Required**: Just open index.html in any modern web browser
- ✅ **Offline Capable**: Works without internet connection
- ✅ **User Authentication**: Simple login/register system using browser localStorage
- ✅ **Rich Text Editing**: Full-featured document editor with formatting options
- ✅ **Document Management**: Create, edit, save, and delete documents
- ✅ **Export Options**: Export to HTML, PDF, RTF, and plain text formats
- ✅ **Auto-save**: Automatically saves documents every 30 seconds
- ✅ **Responsive Design**: Works on desktop and mobile devices

## Quick Start

### Option 1: Using the Launcher (Recommended)

**Windows:**
1. Double-click `launch.bat`
2. Follow the on-screen instructions

**Mac/Linux:**
1. Open terminal in the standalone folder
2. Run: `./launch.sh`
3. Follow the on-screen instructions

### Option 2: Manual Launch

1. Open `index.html` in any modern web browser
2. Login with demo account or create a new account
3. Start creating documents!

## Demo Account

For quick testing, use the pre-created demo account:
- **Email**: demo@example.com
- **Password**: demo123

## System Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- JavaScript enabled
- Local storage support (all modern browsers)

## File Structure

```
standalone/
├── index.html              # Main application entry point
├── dashboard.html          # Document management dashboard
├── launch.bat             # Windows launcher
├── launch.sh              # Mac/Linux launcher
├── README.md              # This file
├── css/
│   └── font-awesome-minimal.css  # Icon fonts
├── js/
│   ├── standalone-auth.js         # Authentication system
│   ├── standalone-storage.js      # Document storage
│   ├── standalone-exporter.js     # Export functionality
│   └── standalone-editor.js       # Main editor
└── [parent folder files]  # CSS and other assets from main app
```

## Usage Guide

### Getting Started

1. **First Time Setup**:
   - Open the application
   - Create a new account or use the demo account
   - You'll be taken to the dashboard

2. **Creating Documents**:
   - Click "Blank Document" or choose a template
   - Start typing in the editor
   - Use the toolbar for formatting
   - Documents auto-save every 30 seconds

3. **Managing Documents**:
   - Use the dashboard to view all your documents
   - Click on a document to open it
   - Right-click for options (rename, delete, export)

### Keyboard Shortcuts

- `Ctrl+S` (or `Cmd+S` on Mac): Save document
- `Ctrl+Z` (or `Cmd+Z` on Mac): Undo
- `Ctrl+Y` (or `Cmd+Y` on Mac): Redo
- `Ctrl+B` (or `Cmd+B` on Mac): Bold
- `Ctrl+I` (or `Cmd+I` on Mac): Italic
- `Ctrl+U` (or `Cmd+U` on Mac): Underline

### Export Options

1. **HTML Export**: Creates a standalone HTML file
2. **PDF Export**: Opens print dialog to save as PDF
3. **RTF Export**: Creates Rich Text Format file (compatible with Word)
4. **Text Export**: Plain text version

## Data Storage

- All data is stored locally in your browser's localStorage
- No data is sent to any server
- Documents persist between browser sessions
- Clearing browser data will remove all documents

## Browser Compatibility

Tested and works on:
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Deployment

To deploy this application in an office environment:

1. **Single Computer**:
   - Copy the `standalone` folder to any location
   - Create a desktop shortcut to `launch.bat` (Windows) or `launch.sh` (Mac/Linux)

2. **Multiple Computers**:
   - Copy the `standalone` folder to a shared network drive
   - Each user can access their own copy or run from the network
   - Each user's data is stored locally on their machine

3. **USB/Portable**:
   - Copy the `standalone` folder to a USB drive
   - Run from the USB drive on any computer
   - Data will be stored on the computer where it's run

## Troubleshooting

### Common Issues

1. **Application won't start**:
   - Ensure JavaScript is enabled in your browser
   - Try a different web browser
   - Check that all files are in the same folder

2. **Documents not saving**:
   - Check browser localStorage quota
   - Ensure you're not in private/incognito mode
   - Clear browser cache and try again

3. **Export not working**:
   - Ensure pop-ups are not blocked
   - Try a different browser
   - Check file download permissions

### Storage Limitations

- Browser localStorage typically has a 5-10MB limit
- Each document and its versions count toward this limit
- Export important documents regularly as backup

## Security Notes

- This is a client-side application - no server security
- User passwords are stored in plain text in localStorage
- Suitable for personal use or trusted environments
- Not recommended for sensitive/classified documents

## Backup and Recovery

Since all data is stored locally:

1. **Regular Backups**:
   - Export important documents regularly
   - Save to cloud storage or external drive

2. **Data Recovery**:
   - If browser data is lost, documents cannot be recovered
   - Only exported files can be restored

## Customization

You can customize the application by editing:
- `css/font-awesome-minimal.css` for icons
- The original CSS files for styling
- JavaScript files for functionality

## Support

This standalone version is designed to be self-contained. For issues:
1. Check the troubleshooting section
2. Try restarting the browser
3. Copy the application files to a new location

## License

This project is open source and available under the MIT License.

---

**Happy Writing!** 📝

*Web Docs Editor - Standalone Version*
*No NPM, No Server, No Internet Required*