const { initializeDatabaseAsync } = require('./database/database');
const keytar = require('keytar');

async function verifyDatabase() {
    console.log('=== Database Verification Tool ===');
    console.log('Process:', process.execPath);
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Electron User Data:', process.env.ELECTRON_USER_DATA || 'not set');
    
    try {
        // Check credential vault
        const key = await keytar.getPassword('WebDocsEditor_Database', 'EncryptionKey_v1');
        console.log('Encryption key found in credential vault:', key ? 'YES' : 'NO');
        
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
