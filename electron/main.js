const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Configure app name and paths
const APP_NAME = 'WebDocsEditor';
const isDev = process.env.NODE_ENV === 'development';
const PORT = 3000;

let mainWindow;

// Set app name for better integration
app.setName(APP_NAME);

// Get user data directory - ensure consistency with server
const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'WebDocsEditor');
console.log('User data directory:', userDataPath);

// Ensure user data directory exists
if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
}

// Helper function to stop server
function stopServer() {
    return new Promise((resolve) => {
        // Since we're running the server in the same process,
        // we don't need to kill a separate process
        console.log('Server will be stopped when app exits...');
        resolve();
    });
}

// Function to start the Express server
function startServer() {
    return new Promise((resolve, reject) => {
        try {
            // Set environment variables for the server
            process.env.NODE_ENV = isDev ? 'development' : 'production';
            process.env.PORT = PORT.toString();
            process.env.ELECTRON_USER_DATA = userDataPath;
            
            console.log('Starting server in same process...');
            console.log('Current working directory:', process.cwd());
            console.log('__dirname:', __dirname);
            console.log('process.resourcesPath:', process.resourcesPath);
            console.log('app.getAppPath():', app.getAppPath());
            
            // For packaged apps, we need to handle module resolution differently
            if (!isDev) {
                // In packaged environment, modules are in the asar archive
                const originalModuleLoad = require('module')._load;
                require('module')._load = function(id, parent) {
                    // First try normal resolution
                    try {
                        return originalModuleLoad.apply(this, arguments);
                    } catch (error) {
                        // If that fails and we're looking for a local module
                        if (error.code === 'MODULE_NOT_FOUND' && id.startsWith('./')) {
                            // Try resolving relative to app path
                            const appPath = app.getAppPath();
                            const fullPath = path.resolve(appPath, id);
                            try {
                                return originalModuleLoad.call(this, fullPath, parent);
                            } catch (innerError) {
                                throw error; // Throw original error
                            }
                        }
                        throw error;
                    }
                };
            }
            
            // Determine server path
            let serverPath;
            if (isDev) {
                serverPath = path.join(__dirname, '../server.js');
            } else {
                serverPath = path.join(app.getAppPath(), 'server.js');
            }
            
            console.log('Server path:', serverPath);
            
            // Verify server file exists
            if (!fs.existsSync(serverPath)) {
                throw new Error(`Server file not found at: ${serverPath}`);
            }
            
            // Clear require cache to ensure fresh start
            const resolvedServerPath = require.resolve(serverPath);
            delete require.cache[resolvedServerPath];
            
            // Set up error capture
            let serverError = null;
            const originalProcessOn = process.on;
            
            const errorHandler = (error) => {
                serverError = error;
                console.error('Server error:', error);
            };
            
            process.on('uncaughtException', errorHandler);
            process.on('unhandledRejection', errorHandler);
            
            // Try to require the server
            try {
                console.log('Loading server module...');
                require(serverPath);
                console.log('Server module loaded successfully');
                
                // Remove error handlers
                process.removeListener('uncaughtException', errorHandler);
                process.removeListener('unhandledRejection', errorHandler);
                
                if (serverError) {
                    throw serverError;
                }
                
            } catch (error) {
                // Remove error handlers
                process.removeListener('uncaughtException', errorHandler);
                process.removeListener('unhandledRejection', errorHandler);
                
                console.error('Error loading server module:', error);
                throw error;
            }
            
            // Wait for server to be ready by checking if it responds
            let checkCount = 0;
            const maxChecks = 60; // 30 seconds maximum wait time
            
            const checkServer = () => {
                if (checkCount >= maxChecks) {
                    reject(new Error('Server startup timeout - server did not respond within 30 seconds'));
                    return;
                }
                
                checkCount++;
                const http = require('http');
                const options = {
                    hostname: 'localhost',
                    port: PORT,
                    path: '/',
                    method: 'GET',
                    timeout: 1000
                };
                
                const req = http.request(options, (res) => {
                    if (res.statusCode === 200 || res.statusCode === 404) {
                        console.log('Server is ready and responding');
                        resolve();
                    } else {
                        setTimeout(checkServer, 500);
                    }
                });
                
                req.on('error', () => {
                    setTimeout(checkServer, 500);
                });
                
                req.on('timeout', () => {
                    req.destroy();
                    setTimeout(checkServer, 500);
                });
                
                req.end();
            };
            
            // Start checking after a short delay
            setTimeout(checkServer, 2000);
            
        } catch (error) {
            console.error('Error starting server:', error);
            reject(error);
        }
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

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        if (isDev) {
            mainWindow.webContents.openDevTools();
        }
    });

    // Handle window closed
    mainWindow.on('closed', async () => {
        console.log('Main window closed');
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
    
    // Create window first with a loading message
    createWindow();
    createMenu();
    
    // Load a simple loading page first
    mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Loading...</title>
            <style>
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    height: 100vh; 
                    margin: 0; 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .loading {
                    text-align: center;
                }
                .spinner {
                    border: 4px solid rgba(255,255,255,0.3);
                    border-top: 4px solid white;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                    margin: 20px auto;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <div class="loading">
                <div class="spinner"></div>
                <h2>Web Docs Editor</h2>
                <p>Starting server...</p>
            </div>
        </body>
        </html>
    `));
    
    try {
        await startServer();
        console.log('Server started successfully, loading main application...');
        
        // Now load the actual application
        mainWindow.loadURL(`http://localhost:${PORT}/splash.html`);
        
    } catch (error) {
        console.error('Failed to start server:', error);
        
        // Show error page
        mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Error</title>
                <style>
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        height: 100vh; 
                        margin: 0; 
                        background: #f44336;
                        color: white;
                    }
                    .error { text-align: center; }
                    .error h2 { margin-bottom: 20px; }
                    .error p { margin: 10px 0; }
                </style>
            </head>
            <body>
                <div class="error">
                    <h2>Startup Error</h2>
                    <p>Failed to start the application server:</p>
                    <p><strong>${error.message}</strong></p>
                    <p>Please restart the application or contact support.</p>
                </div>
            </body>
            </html>
        `));
        
        // Don't quit immediately, let user see the error
        setTimeout(() => {
            app.quit();
        }, 5000);
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
    console.log('App is quitting...');
});

// Handle app quit
app.on('will-quit', () => {
    console.log('App will quit...');
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
