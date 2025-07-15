const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    
    // Menu event listeners
    onMenuNewDocument: (callback) => ipcRenderer.on('menu-new-document', callback),
    onMenuOpenDocument: (callback) => ipcRenderer.on('menu-open-document', callback),
    onMenuSaveDocument: (callback) => ipcRenderer.on('menu-save-document', callback),
    onMenuExportPDF: (callback) => ipcRenderer.on('menu-export-pdf', callback),
    
    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    
    // Check if running in Electron
    isElectron: true
});

// Add some styling for better native feel
window.addEventListener('DOMContentLoaded', () => {
    // Add Electron-specific styling
    document.body.classList.add('electron-app');
    
    // Prevent drag and drop of files outside the app
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
});
