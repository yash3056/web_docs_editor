# Deployment Guide - Web Docs Editor Standalone

## Overview

This guide explains how to deploy the Web Docs Editor standalone version in different environments where NPM cannot be installed.

## What You Get

The standalone version includes:
- Complete document editor with rich text formatting
- User authentication (stored locally)
- Document management dashboard
- Export functionality (HTML, PDF, RTF, Text)
- Offline operation
- No server or internet required

## Deployment Options

### Option 1: Single Computer Installation

**Steps:**
1. Copy the entire `standalone` folder to the target computer
2. Place it in a permanent location (e.g., `C:\Programs\WebDocsEditor\`)
3. Create a desktop shortcut to `launch.bat` (Windows) or `launch.sh` (Mac/Linux)
4. Double-click the shortcut to run the application

**Pros:**
- Simple setup
- Fast performance
- No network dependencies

**Cons:**
- Documents only available on that computer
- No collaboration features

### Option 2: Network Share Deployment

**Steps:**
1. Copy the `standalone` folder to a shared network drive
2. Each user creates a shortcut on their desktop pointing to the launcher
3. Users run the application from the network share
4. Data is stored locally on each user's computer

**Example paths:**
- Windows: `\\server\shared\WebDocsEditor\launch.bat`
- Mac/Linux: `/mnt/shared/WebDocsEditor/launch.sh`

**Pros:**
- Easy to update (update once, affects all users)
- Centralized application files
- Each user has their own data

**Cons:**
- Requires network access to run
- Slower startup over network

### Option 3: USB/Portable Deployment

**Steps:**
1. Copy the `standalone` folder to a USB drive
2. Run `launch.bat` or `launch.sh` from the USB drive
3. Data is stored on the computer where it's run

**Pros:**
- Completely portable
- No installation required
- Works on any computer

**Cons:**
- Documents stored on the computer, not the USB
- Performance depends on USB speed

## Installation Instructions

### For Windows Users

1. **Download/Copy Files:**
   - Copy the `standalone` folder to `C:\WebDocsEditor\`

2. **Create Desktop Shortcut:**
   - Right-click on desktop → New → Shortcut
   - Browse to `C:\WebDocsEditor\launch.bat`
   - Name it "Web Docs Editor"

3. **Optional - Add to Start Menu:**
   - Copy the shortcut to `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\`

### For Mac Users

1. **Download/Copy Files:**
   - Copy the `standalone` folder to `/Applications/WebDocsEditor/`

2. **Make Launcher Executable:**
   ```bash
   chmod +x /Applications/WebDocsEditor/launch.sh
   ```

3. **Create Desktop Shortcut:**
   - Create a new file on desktop: `WebDocsEditor.command`
   - Contents: `#!/bin/bash\ncd /Applications/WebDocsEditor\n./launch.sh`
   - Make it executable: `chmod +x ~/Desktop/WebDocsEditor.command`

### For Linux Users

1. **Download/Copy Files:**
   - Copy the `standalone` folder to `/opt/webdocseditor/`

2. **Make Launcher Executable:**
   ```bash
   chmod +x /opt/webdocseditor/launch.sh
   ```

3. **Create Desktop Entry:**
   Create file `~/.local/share/applications/webdocseditor.desktop`:
   ```
   [Desktop Entry]
   Name=Web Docs Editor
   Comment=Standalone document editor
   Exec=/opt/webdocseditor/launch.sh
   Icon=/opt/webdocseditor/icon.png
   Terminal=false
   Type=Application
   Categories=Office;
   ```

## Office Environment Setup

### Multi-User Office Setup

1. **IT Admin Setup:**
   - Install on network share: `\\server\apps\WebDocsEditor\`
   - Create GPO to add desktop shortcut for all users
   - Test with a few users first

2. **User Instructions:**
   - Double-click "Web Docs Editor" on desktop
   - Create account or use demo account
   - Start creating documents

3. **Backup Strategy:**
   - Train users to export important documents
   - Set up automated backup of user profile folders (where localStorage is stored)

### Single User Setup

1. **Copy to user's computer**
2. **Create desktop shortcut**
3. **Show user how to:**
   - Start the application
   - Create and edit documents
   - Export documents for backup

## Configuration

### Default Settings

The application comes with these defaults:
- Demo account: demo@example.com / demo123
- Auto-save: Every 30 seconds
- Storage: Browser localStorage (5-10MB limit)

### Customization

You can customize by editing:

1. **Branding:**
   - Edit `index.html` and `dashboard.html` to change titles
   - Modify CSS files for colors and styling

2. **Demo Account:**
   - Edit `js/standalone-auth.js` to change default demo account

3. **Auto-save Interval:**
   - Edit `js/standalone-editor.js` to change auto-save timing

## Troubleshooting

### Common Issues

1. **"Application won't start"**
   - Check if JavaScript is enabled
   - Try different browser
   - Ensure all files are in same folder

2. **"Documents not saving"**
   - Check if localStorage is enabled
   - Not in private/incognito mode
   - Clear browser cache

3. **"Export not working"**
   - Allow pop-ups
   - Check file download permissions
   - Try different browser

### Browser Requirements

**Minimum versions:**
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

### Storage Limitations

- Browser localStorage: 5-10MB typical limit
- Stores user accounts and documents
- Export documents regularly as backup

## Security Considerations

### Data Security

- All data stored locally in browser
- No network transmission
- User passwords stored in plain text locally
- Suitable for non-sensitive documents

### Recommendations

1. **For sensitive documents:**
   - Use additional encryption tools
   - Export and store in secure locations
   - Clear browser data when done

2. **For shared computers:**
   - Use private/incognito mode
   - Log out when finished
   - Clear browser data regularly

## Support and Maintenance

### User Training

Provide users with:
1. How to start the application
2. Basic document creation and editing
3. How to export documents
4. Backup recommendations

### IT Support

Common support tasks:
1. Installing on new computers
2. Troubleshooting browser issues
3. Helping with document export
4. Explaining storage limitations

## Backup and Recovery

### User Backups

Users should:
1. Export important documents regularly
2. Save to network drives or cloud storage
3. Use HTML export for universal compatibility

### IT Backups

Consider:
1. Backup user profile folders (contains localStorage)
2. Backup the application folder
3. Document the installation process

## Testing Before Deployment

1. **Test on target browsers**
2. **Test on different operating systems**
3. **Test network share access**
4. **Test with typical user workflows**
5. **Test export functionality**

Use the included `test.html` file to verify basic functionality.

## Getting Help

Since this is a standalone application:
1. Check the troubleshooting section
2. Test with different browsers
3. Verify all files are present
4. Check browser console for errors

---

**Deployment Checklist:**
- [ ] Files copied to target location
- [ ] Launcher script works
- [ ] Desktop shortcut created
- [ ] Basic functionality tested
- [ ] User training provided
- [ ] Backup strategy explained