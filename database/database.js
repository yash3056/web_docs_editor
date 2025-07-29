const Database = require('better-sqlite3-multiple-ciphers');
const bcrypt = require('bcryptjs');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const diff = require('diff');
// Removed keytar dependency - using file-based key storage

// Initialize database with proper path handling
function getDatabasePath() {
    if (process.env.NODE_ENV === 'test') {
        return ':memory:';
    }

    let dbPath;

    // Always use the same database location for consistency
    // This ensures both npm start and electron .exe use the same database
    const appDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'WebDocsEditor');
    if (!fs.existsSync(appDataPath)) {
        fs.mkdirSync(appDataPath, { recursive: true });
    }
    dbPath = path.join(appDataPath, 'app.db');

    // Override only if explicitly running in Electron with user data set
    if (process.env.ELECTRON_USER_DATA && process.env.ELECTRON_USER_DATA !== appDataPath) {
        console.log('Using Electron user data directory for database');
        dbPath = path.join(process.env.ELECTRON_USER_DATA, 'app.db');
    }

    console.log('Database path:', dbPath);
    return dbPath;
}

// Constants for key storage
const KEY_FILE_NAME = '.dbkey';

// Generate a secure encryption key
function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
}

// Store encryption key in encrypted file
async function storeEncryptionKey(key) {
    try {
        const keyPath = getKeyFilePath();
        const algorithm = 'aes-256-cbc';
        const password = 'WebDocsEditor_Key_Salt_v2';
        const salt = crypto.randomBytes(16);
        const derivedKey = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256');
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipheriv(algorithm, derivedKey, iv);
        let encrypted = cipher.update(key, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Store salt, iv, and encrypted data together
        const combined = salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted;
        fs.writeFileSync(keyPath, combined);
        console.log('Encryption key stored in encrypted file');
        return true;
    } catch (error) {
        console.error('Failed to store encryption key:', error);
        return false;
    }
}

// Retrieve encryption key from encrypted file
async function getEncryptionKey() {
    try {
        const keyPath = getKeyFilePath();
        if (!fs.existsSync(keyPath)) {
            return null;
        }
        
        const combined = fs.readFileSync(keyPath, 'utf8');
        const parts = combined.split(':');
        
        if (parts.length !== 3) {
            console.log('Invalid key file format, will generate new key');
            return null;
        }
        
        const algorithm = 'aes-256-cbc';
        const password = 'WebDocsEditor_Key_Salt_v2';
        const salt = Buffer.from(parts[0], 'hex');
        const iv = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];
        
        const derivedKey = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256');
        const decipher = crypto.createDecipheriv(algorithm, derivedKey, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        console.log('Retrieved encryption key from encrypted file');
        return decrypted;
    } catch (error) {
        console.error('Failed to retrieve encryption key:', error);
        return null;
    }
}

// Get key file path
function getKeyFilePath() {
    const appDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'WebDocsEditor');
    if (!fs.existsSync(appDataPath)) {
        fs.mkdirSync(appDataPath, { recursive: true });
    }
    return path.join(appDataPath, KEY_FILE_NAME);
}

// Initialize database with encryption
async function initializeDatabase() {
    const dbPath = getDatabasePath();
    let db;

    try {
        // Try to get existing encryption key
        let key = await getEncryptionKey();
        
        // Check for old backup file format and migrate if found
        if (!key) {
            try {
                const oldBackupPath = path.join(os.homedir(), 'AppData', 'Roaming', 'WebDocsEditor', '.dbkey');
                if (fs.existsSync(oldBackupPath)) {
                    console.log('Found old backup key file, attempting to use it...');
                    const encrypted = fs.readFileSync(oldBackupPath, 'utf8');
                    try {
                        // Skip old format migration since createCipher is deprecated
                        console.log('Old backup key format no longer supported, will generate new key');
                    } catch (decryptError) {
                        console.log('Could not decrypt old backup key, will generate new key');
                    }
                }
            } catch (error) {
                console.log('No old backup key found or migration failed:', error.message);
            }
        }

        if (key) {
            // Database exists and we have a key, try to open it
            try {
                db = new Database(dbPath);
                // Apply encryption key
                db.pragma(`key = '${key}'`);
                // Test if the key works by running a simple query
                db.prepare('SELECT 1').get();
                console.log('Database opened with existing encryption key');
            } catch (error) {
                // If error, the key might be wrong or database not encrypted yet
                console.log('Could not open database with stored key, creating new database');
                db = new Database(dbPath);
                
                // Try to encrypt existing database with the key
                try {
                    db.pragma(`rekey = '${key}'`);
                    console.log('Existing database encrypted with stored key');
                } catch (rekeyError) {
                    console.log('Could not encrypt existing database, will generate new key');
                    // Generate new key if rekey fails
                    key = generateEncryptionKey();
                    await storeEncryptionKey(key);
                    db.pragma(`rekey = '${key}'`);
                    console.log('Database encrypted with new key');
                }
            }
        } else {
            // No key found, either new database or not encrypted yet
            db = new Database(dbPath);

            // Generate and store a new encryption key
            key = generateEncryptionKey();
            await storeEncryptionKey(key);

            // Encrypt the database (or re-encrypt with new key)
            db.pragma(`rekey = '${key}'`);
            console.log('Database encrypted with new key');
        }
    } catch (error) {
        console.error('Error initializing encrypted database:', error);
        // Fallback to non-encrypted database if encryption fails
        db = new Database(dbPath);
        console.log('Fallback to non-encrypted database');
    }

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    return db;
}

// Initialize database asynchronously
let db;

async function initializeDatabaseAsync() {
    if (process.env.NODE_ENV === 'test') {
        // For tests, use synchronous initialization with in-memory database
        db = new Database(':memory:');
        db.pragma('foreign_keys = ON');
        initDatabase();
        return db;
    } else {
        // For production/development, use encrypted database
        db = await initializeDatabase();
        initDatabase();
        return db;
    }
}

// Database will be initialized explicitly by the server

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
    if (!db) {
        console.error('Database not initialized when preparing queries');
        return;
    }
    
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

    const text1 = extractTextContent(doc1.content);
    const text2 = extractTextContent(doc2.content);

    // Generate sentence-level diff for better readability
    const sentences1 = text1.split(/[.!?]+/).filter(s => s.trim());
    const sentences2 = text2.split(/[.!?]+/).filter(s => s.trim());

    // Generate character-level diff
    const charDiff = diff.diffChars(text1, text2);

    // Generate word-level diff for better readability
    const wordDiff = diff.diffWords(text1, text2);

    // Generate line-level diff
    const lineDiff = diff.diffLines(text1, text2);

    // Generate sentence-level diff
    const sentenceDiff = diff.diffArrays(sentences1, sentences2);

    return {
        version1: {
            id: version1.id,
            number: version1.version_number,
            title: version1.title,
            content: text1,
            createdAt: version1.created_at,
            commitMessage: version1.commit_message
        },
        version2: {
            id: version2.id,
            number: version2.version_number,
            title: version2.title,
            content: text2,
            createdAt: version2.created_at,
            commitMessage: version2.commit_message
        },
        diff: {
            chars: charDiff,
            words: wordDiff,
            lines: lineDiff,
            sentences: sentenceDiff
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

function getVersionChanges(documentId, versionId, userId) {
    // Verify user has access to this document
    const doc = documentQueries.findByIdAndUserId.get(documentId, userId);
    if (!doc) {
        throw new Error('Document not found or access denied');
    }

    const currentVersion = versionQueries.getVersionById.get(versionId);
    if (!currentVersion || currentVersion.document_id !== documentId) {
        throw new Error('Version not found');
    }

    // Get the previous version
    const previousVersion = versionQueries.getVersionsByDocumentId.all(documentId)
        .find(v => v.version_number === currentVersion.version_number - 1);

    if (!previousVersion) {
        // This is the first version, show the entire content as additions
        const doc = JSON.parse(currentVersion.content);
        const text = extractTextContent(doc.content);

        return {
            version: {
                id: currentVersion.id,
                number: currentVersion.version_number,
                title: currentVersion.title,
                createdAt: currentVersion.created_at,
                commitMessage: currentVersion.commit_message
            },
            changes: {
                type: 'initial',
                added: text.split('\n').length,
                removed: 0,
                modified: 0
            },
            diff: {
                lines: [{ added: true, value: text }]
            }
        };
    }

    // Compare with previous version
    const prevDoc = JSON.parse(previousVersion.content);
    const currDoc = JSON.parse(currentVersion.content);

    const prevText = extractTextContent(prevDoc.content);
    const currText = extractTextContent(currDoc.content);

    // Special case: if current text starts with previous text, it's likely just an append
    if (currText.startsWith(prevText)) {
        const appendedText = currText.substring(prevText.length);
        if (appendedText.trim()) {
            const processedDiff = [];

            // Show context if previous text is not too long
            if (prevText.length < 100) {
                processedDiff.push({ value: prevText, added: false, removed: false });
            } else {
                // Show end of previous text as context
                const words = prevText.split(' ');
                const contextText = '... ' + words.slice(-10).join(' ');
                processedDiff.push({ value: contextText, added: false, removed: false });
            }

            // Show the appended text
            processedDiff.push({ value: appendedText, added: true, removed: false });

            return {
                version: {
                    id: currentVersion.id,
                    number: currentVersion.version_number,
                    title: currentVersion.title,
                    createdAt: currentVersion.created_at,
                    commitMessage: currentVersion.commit_message
                },
                previousVersion: {
                    id: previousVersion.id,
                    number: previousVersion.version_number,
                    title: previousVersion.title
                },
                changes: {
                    type: 'append',
                    added: (appendedText.match(/\S+/g) || []).length,
                    removed: 0,
                    modified: 0
                },
                diff: {
                    lines: processedDiff,
                    words: [
                        { value: prevText, added: false, removed: false },
                        { value: appendedText, added: true, removed: false }
                    ]
                }
            };
        }
    }

    // Special case: if previous text starts with current text, it's likely a deletion
    if (prevText.startsWith(currText)) {
        const deletedText = prevText.substring(currText.length);
        if (deletedText.trim()) {
            const processedDiff = [];

            // Show context if current text is not too long
            if (currText.length < 100) {
                processedDiff.push({ value: currText, added: false, removed: false });
            } else {
                // Show end of current text as context
                const words = currText.split(' ');
                const contextText = '... ' + words.slice(-10).join(' ');
                processedDiff.push({ value: contextText, added: false, removed: false });
            }

            // Show the deleted text
            processedDiff.push({ value: deletedText, added: false, removed: true });

            return {
                version: {
                    id: currentVersion.id,
                    number: currentVersion.version_number,
                    title: currentVersion.title,
                    createdAt: currentVersion.created_at,
                    commitMessage: currentVersion.commit_message
                },
                previousVersion: {
                    id: previousVersion.id,
                    number: previousVersion.version_number,
                    title: previousVersion.title
                },
                changes: {
                    type: 'delete',
                    added: 0,
                    removed: (deletedText.match(/\S+/g) || []).length,
                    modified: 0
                },
                diff: {
                    lines: processedDiff,
                    words: [
                        { value: currText, added: false, removed: false },
                        { value: deletedText, added: false, removed: true }
                    ]
                }
            };
        }
    }

    // Fall back to word-level diff for more complex changes
    const wordDiff = diff.diffWords(prevText, currText);

    // Convert word diff to line-like format for display
    const processedDiff = [];
    let currentLine = '';

    wordDiff.forEach(change => {
        if (change.added) {
            if (currentLine.trim()) {
                processedDiff.push({ value: currentLine, added: false, removed: false });
                currentLine = '';
            }
            processedDiff.push({ value: change.value, added: true, removed: false });
        } else if (change.removed) {
            if (currentLine.trim()) {
                processedDiff.push({ value: currentLine, added: false, removed: false });
                currentLine = '';
            }
            processedDiff.push({ value: change.value, added: false, removed: true });
        } else {
            // For unchanged content, only show if it's short or at boundaries
            if (change.value.length < 50) {
                currentLine += change.value;
            } else {
                // Show beginning and end of long unchanged content
                const words = change.value.split(' ');
                if (words.length > 10) {
                    currentLine += words.slice(0, 3).join(' ') + ' ... ' + words.slice(-3).join(' ');
                } else {
                    currentLine += change.value;
                }
            }
        }
    });

    if (currentLine.trim()) {
        processedDiff.push({ value: currentLine, added: false, removed: false });
    }

    // Calculate statistics based on word changes
    let added = 0, removed = 0;

    wordDiff.forEach(change => {
        if (change.added) {
            added += (change.value.match(/\S+/g) || []).length;
        } else if (change.removed) {
            removed += (change.value.match(/\S+/g) || []).length;
        }
    });

    return {
        version: {
            id: currentVersion.id,
            number: currentVersion.version_number,
            title: currentVersion.title,
            createdAt: currentVersion.created_at,
            commitMessage: currentVersion.commit_message
        },
        previousVersion: {
            id: previousVersion.id,
            number: previousVersion.version_number,
            title: previousVersion.title
        },
        changes: {
            type: 'update',
            added: added,
            removed: removed,
            modified: 0
        },
        diff: {
            lines: processedDiff,
            words: wordDiff
        }
    };
}

// Helper function to extract text content from document structure
function extractTextContent(content) {
    if (!content) return '';

    // Function to clean text by removing HTML tags and decoding entities
    function cleanText(text) {
        if (!text) return '';

        // Remove HTML tags
        let cleaned = text.replace(/<[^>]*>/g, '');

        // Decode common HTML entities
        cleaned = cleaned
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");

        return cleaned;
    }

    // If content is an array (blocks), extract text from each block
    if (Array.isArray(content)) {
        return content.map(block => {
            if (typeof block === 'string') {
                return cleanText(block);
            }
            if (block.text) {
                return cleanText(block.text);
            }
            if (block.content) {
                return cleanText(block.content);
            }
            return '';
        }).filter(text => text.trim()).join('\n');
    }

    // If content is a string, return it cleaned
    if (typeof content === 'string') {
        return cleanText(content);
    }

    // If content is an object with text property
    if (content.text) {
        return cleanText(content.text);
    }
    if (content.content) {
        return cleanText(content.content);
    }

    return '';
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
    getVersionChanges,
    createDocumentBranch,
    getDocumentBranches,
    createVersionTag,
    getVersionTags,
    initializeDatabaseAsync,
    get db() { return db; }
};
