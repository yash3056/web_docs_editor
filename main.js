const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

// Configure app name and paths
const APP_NAME = 'WebDocsEditor';
const isDev = process.env.NODE_ENV === 'development';
const PORT = 3000;

let mainWindow;
let serverProcess;

// Set app name for better integration
app.setName(APP_NAME);

// Get user data directory
const userDataPath = app.getPath('userData');
console.log('User data directory:', userDataPath);

// Ensure user data directory exists
if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
}

// Function to start the Express server
function startServer() {
    return new Promise((resolve, reject) => {
        // Set environment variables for the server
        const env = {
            ...process.env,
            NODE_ENV: isDev ? 'development' : 'production',
            PORT: PORT.toString(),
            ELECTRON_USER_DATA: userDataPath
        };

        // Start the server process
        serverProcess = spawn('node', ['server.js'], {
            cwd: __dirname,
            env: env,
            stdio: 'pipe'
        });

        let serverStarted = false;

        serverProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('Server:', output);
            
            if (output.includes('Server running on') || output.includes('listening on port') || output.includes('server listening')) {
                if (!serverStarted) {
                    serverStarted = true;
                    setTimeout(() => resolve(), 1000); // Give it a moment to fully start
                }
            }
        });

        serverProcess.stderr.on('data', (data) => {
            const error = data.toString();
            console.error('Server Error:', error);
            
            // Don't reject on stderr unless it's a critical error
            if (error.includes('Error: listen EADDRINUSE') || 
                error.includes('port already in use') ||
                error.includes('EADDRINUSE')) {
                reject(new Error(`Port ${PORT} is already in use`));
            }
        });

        serverProcess.on('close', (code) => {
            console.log(`Server process exited with code ${code}`);
            if (!serverStarted) {
                reject(new Error(`Server failed to start (exit code: ${code})`));
            }
        });

        serverProcess.on('error', (error) => {
            console.error('Failed to start server:', error);
            reject(error);
        });

        // Timeout after 15 seconds
        setTimeout(() => {
            if (!serverStarted) {
                reject(new Error('Server startup timeout'));
            }
        }, 15000);
    });
}

// Function to create the main window
function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'images', 'logo.png'),
        show: false,
        titleBarStyle: 'default',
        autoHideMenuBar: false
    });

    // Load the app
    mainWindow.loadURL(`http://localhost:${PORT}/splash.html`);

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        if (isDev) {
            mainWindow.webContents.openDevTools();
        }
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Prevent navigation to external sites
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith(`http://localhost:${PORT}`)) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });
}

// Create application menu
function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Document',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow.webContents.send('menu-new-document');
                    }
                },
                {
                    label: 'Open Document',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => {
                        mainWindow.webContents.send('menu-open-document');
                    }
                },
                {
                    label: 'Save Document',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        mainWindow.webContents.send('menu-save-document');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Export as PDF',
                    accelerator: 'CmdOrCtrl+E',
                    click: () => {
                        mainWindow.webContents.send('menu-export-pdf');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectall' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'actualSize' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'close' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About Web Docs Editor',
                            message: 'Web Docs Editor',
                            detail: 'A modern document editor with version control\n\nVersion: 1.0.0\nAuthor: Yash Prakash Narayan'
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// App event handlers
app.whenReady().then(async () => {
    console.log('App is ready, starting server...');
    
    try {
        await startServer();
        console.log('Server started successfully');
        
        createWindow();
        createMenu();
    } catch (error) {
        console.error('Failed to start server:', error);
        dialog.showErrorBox('Startup Error', `Failed to start the application server: ${error.message}`);
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', () => {
    if (serverProcess) {
        console.log('Stopping server process...');
        serverProcess.kill('SIGTERM');
    }
});

// Handle app quit
app.on('will-quit', (event) => {
    if (serverProcess) {
        event.preventDefault();
        serverProcess.kill('SIGTERM');
        
        setTimeout(() => {
            if (serverProcess) {
                serverProcess.kill('SIGKILL');
            }
            app.quit();
        }, 3000);
    }
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('get-user-data-path', () => {
    return userDataPath;
});

ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    dialog.showErrorBox('Unexpected Error', error.message);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
});
