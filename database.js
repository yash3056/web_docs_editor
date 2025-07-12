const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const crypto = require('crypto');

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

    // Document versions table for version control
    db.exec(`
        CREATE TABLE IF NOT EXISTS document_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id TEXT NOT NULL,
            version_number INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            commit_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER NOT NULL,
            is_current_version BOOLEAN DEFAULT 0,
            content_hash TEXT,
            FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users (id),
            UNIQUE(document_id, version_number)
        )
    `);

    // Document branches for advanced version control
    db.exec(`
        CREATE TABLE IF NOT EXISTS document_branches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id TEXT NOT NULL,
            branch_name TEXT NOT NULL,
            base_version_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER NOT NULL,
            is_active BOOLEAN DEFAULT 1,
            FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
            FOREIGN KEY (base_version_id) REFERENCES document_versions (id),
            FOREIGN KEY (created_by) REFERENCES users (id),
            UNIQUE(document_id, branch_name)
        )
    `);

    // Version tags for marking important versions
    db.exec(`
        CREATE TABLE IF NOT EXISTS version_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version_id INTEGER NOT NULL,
            tag_name TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER NOT NULL,
            FOREIGN KEY (version_id) REFERENCES document_versions (id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users (id),
            UNIQUE(version_id, tag_name)
        )
    `);

    // Create indexes for better performance
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
        CREATE INDEX IF NOT EXISTS idx_document_versions_created_at ON document_versions(created_at);
        CREATE INDEX IF NOT EXISTS idx_document_branches_document_id ON document_branches(document_id);
        CREATE INDEX IF NOT EXISTS idx_version_tags_version_id ON version_tags(version_id);
    `);

    console.log('Database initialized successfully');
    
    // Prepare queries after tables are created
    prepareQueries();
}

// User operations
let userQueries = {};
let documentQueries = {};
let versionQueries = {};

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
            INSERT INTO documents (id, user_id, title, content, last_modified)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                content = excluded.content,
                last_modified = CURRENT_TIMESTAMP
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

    // Version control operations
    versionQueries = {
        createVersion: db.prepare(`
            INSERT INTO document_versions (document_id, version_number, title, content, commit_message, created_by, is_current_version, content_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `),
        
        updateCurrentVersion: db.prepare(`
            UPDATE document_versions SET is_current_version = 0 WHERE document_id = ?
        `),
        
        getVersionsByDocumentId: db.prepare(`
            SELECT * FROM document_versions WHERE document_id = ? ORDER BY version_number DESC
        `),
        
        getVersionById: db.prepare(`
            SELECT * FROM document_versions WHERE id = ?
        `),
        
        getCurrentVersion: db.prepare(`
            SELECT * FROM document_versions WHERE document_id = ? AND is_current_version = 1
        `),
        
        getMaxVersionNumber: db.prepare(`
            SELECT MAX(version_number) as max_version FROM document_versions WHERE document_id = ?
        `),
        
        createBranch: db.prepare(`
            INSERT INTO document_branches (document_id, branch_name, base_version_id, created_by)
            VALUES (?, ?, ?, ?)
        `),
        
        getBranchesByDocumentId: db.prepare(`
            SELECT * FROM document_branches WHERE document_id = ? AND is_active = 1
        `),
        
        createTag: db.prepare(`
            INSERT INTO version_tags (version_id, tag_name, description, created_by)
            VALUES (?, ?, ?, ?)
        `),
        
        getTagsByVersionId: db.prepare(`
            SELECT * FROM version_tags WHERE version_id = ?
        `),
        
        getVersionHistory: db.prepare(`
            SELECT 
                v.*,
                u.username as author,
                GROUP_CONCAT(t.tag_name) as tags
            FROM document_versions v
            LEFT JOIN users u ON v.created_by = u.id
            LEFT JOIN version_tags t ON v.id = t.version_id
            WHERE v.document_id = ?
            GROUP BY v.id
            ORDER BY v.version_number DESC
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

// Version Control Functions
function generateContentHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

function saveDocumentWithVersion(document, userId, commitMessage = 'Auto-save') {
    const contentStr = JSON.stringify(document);
    const contentHash = generateContentHash(contentStr);
    
    // Start transaction
    const transaction = db.transaction(() => {
        // Save/update the main document
        documentQueries.create.run(
            document.id,
            userId,
            document.title,
            contentStr
        );
        
        // Check if this is a new version (different content)
        const currentVersion = versionQueries.getCurrentVersion.get(document.id);
        if (!currentVersion || currentVersion.content_hash !== contentHash) {
            // Get next version number
            const maxVersionResult = versionQueries.getMaxVersionNumber.get(document.id);
            const nextVersionNumber = (maxVersionResult.max_version || 0) + 1;
            
            // Mark all versions as not current
            versionQueries.updateCurrentVersion.run(document.id);
            
            // Create new version
            versionQueries.createVersion.run(
                document.id,
                nextVersionNumber,
                document.title,
                contentStr,
                commitMessage,
                userId,
                1, // is_current_version
                contentHash
            );
        }
    });
    
    return transaction();
}

function getDocumentVersionHistory(documentId, userId) {
    // First verify user has access to this document
    const doc = documentQueries.findByIdAndUserId.get(documentId, userId);
    if (!doc) {
        return null;
    }
    
    return versionQueries.getVersionHistory.all(documentId);
}

function restoreDocumentVersion(documentId, versionId, userId) {
    // Verify user has access to this document
    const doc = documentQueries.findByIdAndUserId.get(documentId, userId);
    if (!doc) {
        throw new Error('Document not found or access denied');
    }
    
    // Get the version to restore
    const version = versionQueries.getVersionById.get(versionId);
    if (!version || version.document_id !== documentId) {
        throw new Error('Version not found');
    }
    
    // Parse the document content from the version
    const versionDoc = JSON.parse(version.content);
    
    // Save as new version with restore message
    return saveDocumentWithVersion(
        {
            ...versionDoc,
            id: documentId,
            lastModified: Date.now()
        },
        userId,
        `Restored from version ${version.version_number}`
    );
}

function compareDocumentVersions(documentId, versionId1, versionId2, userId) {
    // Verify user has access to this document
    const doc = documentQueries.findByIdAndUserId.get(documentId, userId);
    if (!doc) {
        throw new Error('Document not found or access denied');
    }
    
    const version1 = versionQueries.getVersionById.get(versionId1);
    const version2 = versionQueries.getVersionById.get(versionId2);
    
    if (!version1 || !version2 || version1.document_id !== documentId || version2.document_id !== documentId) {
        throw new Error('One or both versions not found');
    }
    
    const doc1 = JSON.parse(version1.content);
    const doc2 = JSON.parse(version2.content);
    
    return {
        version1: {
            id: version1.id,
            number: version1.version_number,
            title: version1.title,
            content: doc1.content,
            createdAt: version1.created_at,
            commitMessage: version1.commit_message
        },
        version2: {
            id: version2.id,
            number: version2.version_number,
            title: version2.title,
            content: doc2.content,
            createdAt: version2.created_at,
            commitMessage: version2.commit_message
        }
    };
}

function createDocumentBranch(documentId, branchName, baseVersionId, userId) {
    // Verify user has access to this document
    const doc = documentQueries.findByIdAndUserId.get(documentId, userId);
    if (!doc) {
        throw new Error('Document not found or access denied');
    }
    
    try {
        const result = versionQueries.createBranch.run(documentId, branchName, baseVersionId, userId);
        return { id: result.lastInsertRowid, branchName };
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            throw new Error('Branch name already exists for this document');
        }
        throw error;
    }
}

function getDocumentBranches(documentId, userId) {
    // Verify user has access to this document
    const doc = documentQueries.findByIdAndUserId.get(documentId, userId);
    if (!doc) {
        return null;
    }
    
    return versionQueries.getBranchesByDocumentId.all(documentId);
}

function createVersionTag(versionId, tagName, description, userId) {
    // Verify the version exists and user has access
    const version = versionQueries.getVersionById.get(versionId);
    if (!version) {
        throw new Error('Version not found');
    }
    
    // Check if user has access to the document
    const doc = documentQueries.findByIdAndUserId.get(version.document_id, userId);
    if (!doc) {
        throw new Error('Access denied');
    }
    
    try {
        const result = versionQueries.createTag.run(versionId, tagName, description, userId);
        return { id: result.lastInsertRowid, tagName };
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            throw new Error('Tag name already exists for this version');
        }
        throw error;
    }
}

function getVersionTags(versionId, userId) {
    // Verify the version exists and user has access
    const version = versionQueries.getVersionById.get(versionId);
    if (!version) {
        return null;
    }
    
    // Check if user has access to the document
    const doc = documentQueries.findByIdAndUserId.get(version.document_id, userId);
    if (!doc) {
        return null;
    }
    
    return versionQueries.getTagsByVersionId.all(versionId);
}

module.exports = {
    initDatabase,
    createUser,
    validateUser,
    getUserById,
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
    getVersionTags,
    db
};
