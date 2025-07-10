const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// Initialize database
const dbPath = path.join(__dirname, 'app.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
function initDatabase() {
    // Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Documents table
    db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    `);

    console.log('Database initialized successfully');
    
    // Prepare queries after tables are created
    prepareQueries();
}

// User operations
let userQueries = {};
let documentQueries = {};

function prepareQueries() {
    userQueries = {
        create: db.prepare(`
            INSERT INTO users (email, username, password_hash)
            VALUES (?, ?, ?)
        `),
        
        findByEmail: db.prepare(`
            SELECT * FROM users WHERE email = ?
        `),
        
        findByUsername: db.prepare(`
            SELECT * FROM users WHERE username = ?
        `),
        
        findById: db.prepare(`
            SELECT id, email, username, created_at FROM users WHERE id = ?
        `)
    };

    // Document operations
    documentQueries = {
        create: db.prepare(`
            INSERT OR REPLACE INTO documents (id, user_id, title, content, last_modified)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `),
        
        findByUserId: db.prepare(`
            SELECT * FROM documents WHERE user_id = ? ORDER BY last_modified DESC
        `),
        
        findByIdAndUserId: db.prepare(`
            SELECT * FROM documents WHERE id = ? AND user_id = ?
        `),
        
        deleteByIdAndUserId: db.prepare(`
            DELETE FROM documents WHERE id = ? AND user_id = ?
        `)
    };
}

// User functions
async function createUser(email, username, password) {
    const passwordHash = await bcrypt.hash(password, 10);
    
    try {
        const result = userQueries.create.run(email, username, passwordHash);
        return { id: result.lastInsertRowid, email, username };
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            throw new Error('Email or username already exists');
        }
        throw error;
    }
}

async function validateUser(email, password) {
    const user = userQueries.findByEmail.get(email);
    if (!user) {
        return null;
    }
    
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
        return null;
    }
    
    return { id: user.id, email: user.email, username: user.username };
}

function getUserById(id) {
    return userQueries.findById.get(id);
}

// Document functions
function saveDocument(document, userId) {
    return documentQueries.create.run(
        document.id,
        userId,
        document.title,
        JSON.stringify(document)
    );
}

function getUserDocuments(userId) {
    const rows = documentQueries.findByUserId.all(userId);
    return rows.map(row => {
        const doc = JSON.parse(row.content);
        return {
            ...doc,
            id: row.id,
            title: row.title,
            createdAt: new Date(row.created_at).getTime(),
            lastModified: new Date(row.last_modified).getTime()
        };
    });
}

function getUserDocument(documentId, userId) {
    const row = documentQueries.findByIdAndUserId.get(documentId, userId);
    if (!row) {
        return null;
    }
    
    const doc = JSON.parse(row.content);
    return {
        ...doc,
        id: row.id,
        title: row.title,
        createdAt: new Date(row.created_at).getTime(),
        lastModified: new Date(row.last_modified).getTime()
    };
}

function deleteUserDocument(documentId, userId) {
    const result = documentQueries.deleteByIdAndUserId.run(documentId, userId);
    return result.changes > 0;
}

module.exports = {
    initDatabase,
    createUser,
    validateUser,
    getUserById,
    saveDocument,
    getUserDocuments,
    getUserDocument,
    deleteUserDocument,
    db
};
