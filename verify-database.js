const { initializeDatabaseAsync } = require('./database/database');
// Keytar removed - using file-based key storage

async function verifyDatabase() {
    console.log('=== Database Verification Tool ===');
    console.log('Process:', process.execPath);
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Electron User Data:', process.env.ELECTRON_USER_DATA || 'not set');
    
    try {
        // Check encryption key file
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const keyPath = path.join(os.homedir(), 'AppData', 'Roaming', 'WebDocsEditor', '.dbkey');
        const keyExists = fs.existsSync(keyPath);
        console.log('Encryption key found in file:', keyExists ? 'YES' : 'NO');
        
        // Initialize database
        const db = await initializeDatabaseAsync();
        console.log('Database initialization:', 'SUCCESS');
        
        // Test database access
        const result = db.prepare('SELECT COUNT(*) as count FROM users').get();
        console.log('Database access test:', 'SUCCESS');
        console.log('Users table count:', result.count);
        
        console.log('=== Verification Complete ===');
    } catch (error) {
        console.error('Verification failed:', error.message);
    }
}

verifyDatabase();
