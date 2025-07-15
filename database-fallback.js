const bcrypt = require('bcryptjs');
const path = require('path');
const crypto = require('crypto');

// Try to load better-sqlite3, fallback to sqlite3 if it fails
let Database;
let db;

try {
    Database = require('better-sqlite3');
    const dbPath = path.join(__dirname, 'app.db');
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    console.log('Using better-sqlite3 for database');
} catch (error) {
    console.log('better-sqlite3 failed, falling back to sqlite3:', error.message);
    Database = require('sqlite3').Database;
    const dbPath = path.join(__dirname, 'app.db');
    db = new Database(dbPath);
    db.run('PRAGMA foreign_keys = ON');
    console.log('Using sqlite3 for database');
}

// Database interface wrapper to handle both better-sqlite3 and sqlite3
class DatabaseWrapper {
    constructor(db) {
        this.db = db;
        this.isBetter = db.constructor.name === 'Database' && typeof db.prepare === 'function';
    }

    exec(sql) {
        if (this.isBetter) {
            return this.db.exec(sql);
        } else {
            return new Promise((resolve, reject) => {
                this.db.exec(sql, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
    }

    prepare(sql) {
        if (this.isBetter) {
            return this.db.prepare(sql);
        } else {
            // Return a wrapper that mimics better-sqlite3's prepared statement interface
            return {
                run: (...params) => {
                    return new Promise((resolve, reject) => {
                        this.db.run(sql, params, function(err) {
                            if (err) reject(err);
                            else resolve({ changes: this.changes, lastInsertRowid: this.lastID });
                        });
                    });
                },
                get: (...params) => {
                    return new Promise((resolve, reject) => {
                        this.db.get(sql, params, (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        });
                    });
                },
                all: (...params) => {
                    return new Promise((resolve, reject) => {
                        this.db.all(sql, params, (err, rows) => {
                            if (err) reject(err);
                            else resolve(rows);
                        });
                    });
                }
            };
        }
    }

    close() {
        this.db.close();
    }
}

const dbWrapper = new DatabaseWrapper(db);

// Create tables
async function initDatabase() {
    const initSQL = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS document_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id TEXT NOT NULL,
            version_number INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER NOT NULL,
            commit_message TEXT,
            FOREIGN KEY (document_id) REFERENCES documents(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        );
    `;

    try {
        if (dbWrapper.isBetter) {
            dbWrapper.exec(initSQL);
        } else {
            await dbWrapper.exec(initSQL);
        }
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    }
}

// User management functions
async function createUser(email, username, password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    
    const stmt = dbWrapper.prepare(`
        INSERT INTO users (email, username, password_hash) 
        VALUES (?, ?, ?)
    `);
    
    try {
        if (dbWrapper.isBetter) {
            const result = stmt.run(email, username, hashedPassword);
            return { id: result.lastInsertRowid, email, username };
        } else {
            await stmt.run(email, username, hashedPassword);
            return { id: userId, email, username };
        }
    } catch (error) {
        throw error;
    }
}

async function validateUser(email, password) {
    const stmt = dbWrapper.prepare(`
        SELECT id, email, username, password_hash 
        FROM users 
        WHERE email = ?
    `);
    
    try {
        const user = dbWrapper.isBetter ? stmt.get(email) : await stmt.get(email);
        
        if (!user) {
            return null;
        }
        
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (isValid) {
            return { id: user.id, email: user.email, username: user.username };
        }
        return null;
    } catch (error) {
        throw error;
    }
}

// Document management functions
async function saveDocument(documentId, title, content, userId) {
    const stmt = dbWrapper.prepare(`
        INSERT OR REPLACE INTO documents (id, title, content, user_id, updated_at) 
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    try {
        if (dbWrapper.isBetter) {
            return stmt.run(documentId, title, content, userId);
        } else {
            return await stmt.run(documentId, title, content, userId);
        }
    } catch (error) {
        throw error;
    }
}

async function getUserDocuments(userId) {
    const stmt = dbWrapper.prepare(`
        SELECT id, title, created_at, updated_at 
        FROM documents 
        WHERE user_id = ? 
        ORDER BY updated_at DESC
    `);
    
    try {
        return dbWrapper.isBetter ? stmt.all(userId) : await stmt.all(userId);
    } catch (error) {
        throw error;
    }
}

async function getUserDocument(documentId, userId) {
    const stmt = dbWrapper.prepare(`
        SELECT id, title, content, created_at, updated_at 
        FROM documents 
        WHERE id = ? AND user_id = ?
    `);
    
    try {
        return dbWrapper.isBetter ? stmt.get(documentId, userId) : await stmt.get(documentId, userId);
    } catch (error) {
        throw error;
    }
}

async function deleteUserDocument(documentId, userId) {
    const stmt = dbWrapper.prepare(`
        DELETE FROM documents 
        WHERE id = ? AND user_id = ?
    `);
    
    try {
        if (dbWrapper.isBetter) {
            return stmt.run(documentId, userId);
        } else {
            return await stmt.run(documentId, userId);
        }
    } catch (error) {
        throw error;
    }
}

// Simplified version management functions
async function saveDocumentWithVersion(documentId, title, content, userId, commitMessage) {
    // For now, just save the document normally
    return await saveDocument(documentId, title, content, userId);
}

async function getDocumentVersionHistory(documentId) {
    return [];
}

async function restoreDocumentVersion(documentId, versionId, userId) {
    return null;
}

async function compareDocumentVersions(documentId, version1, version2) {
    return null;
}

async function createDocumentBranch(documentId, branchName, userId) {
    return null;
}

async function getDocumentBranches(documentId) {
    return [];
}

async function createVersionTag(documentId, tagName, versionId, userId) {
    return null;
}

async function getVersionTags(documentId) {
    return [];
}

module.exports = {
    initDatabase,
    createUser,
    validateUser,
    saveDocument,
    saveDocumentWithVersion,
    getUserDocuments,
    getUserDocument,
    deleteUserDocument,
    getDocumentVersionHistory,
    restoreDocumentVersion,
    compareDocumentVersions,
    createDocumentBranch,
    getDocumentBranches,
    createVersionTag,
    getVersionTags
};