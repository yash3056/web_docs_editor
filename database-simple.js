// Simple in-memory database for pkg builds
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class SimpleDatabase {
    constructor() {
        this.users = new Map();
        this.documents = new Map();
        this.dataFile = path.join(__dirname, 'simple-db.json');
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                this.users = new Map(data.users || []);
                this.documents = new Map(data.documents || []);
                console.log('Loaded simple database from file');
            }
        } catch (error) {
            console.log('Creating new simple database');
        }
    }

    save() {
        try {
            const data = {
                users: Array.from(this.users.entries()),
                documents: Array.from(this.documents.entries())
            };
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving database:', error);
        }
    }

    async createUser(email, username, password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = this.users.size + 1;
        
        // Check if user already exists
        for (const [id, user] of this.users) {
            if (user.email === email || user.username === username) {
                throw new Error('User already exists');
            }
        }
        
        const user = {
            id: userId,
            email,
            username,
            password_hash: hashedPassword,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        this.users.set(userId, user);
        this.save();
        return { id: userId, email, username };
    }

    async validateUser(email, password) {
        for (const [id, user] of this.users) {
            if (user.email === email) {
                const isValid = await bcrypt.compare(password, user.password_hash);
                if (isValid) {
                    return { id: user.id, email: user.email, username: user.username };
                }
            }
        }
        return null;
    }

    async saveDocument(documentId, title, content, userId) {
        const document = {
            id: documentId,
            title,
            content,
            user_id: userId,
            created_at: this.documents.has(documentId) ? 
                this.documents.get(documentId).created_at : 
                new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        this.documents.set(documentId, document);
        this.save();
        return { changes: 1 };
    }

    async getUserDocuments(userId) {
        const userDocs = [];
        for (const [id, doc] of this.documents) {
            if (doc.user_id === userId) {
                userDocs.push({
                    id: doc.id,
                    title: doc.title,
                    created_at: doc.created_at,
                    updated_at: doc.updated_at
                });
            }
        }
        return userDocs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    }

    async getUserDocument(documentId, userId) {
        const doc = this.documents.get(documentId);
        if (doc && doc.user_id === userId) {
            return doc;
        }
        return null;
    }

    async deleteUserDocument(documentId, userId) {
        const doc = this.documents.get(documentId);
        if (doc && doc.user_id === userId) {
            this.documents.delete(documentId);
            this.save();
            return { changes: 1 };
        }
        return { changes: 0 };
    }
}

const simpleDB = new SimpleDatabase();

// Initialize database
async function initDatabase() {
    console.log('Simple database initialized');
    return Promise.resolve();
}

// User management functions
async function createUser(email, username, password) {
    return simpleDB.createUser(email, username, password);
}

async function validateUser(email, password) {
    return simpleDB.validateUser(email, password);
}

// Document management functions
async function saveDocument(documentId, title, content, userId) {
    return simpleDB.saveDocument(documentId, title, content, userId);
}

async function getUserDocuments(userId) {
    return simpleDB.getUserDocuments(userId);
}

async function getUserDocument(documentId, userId) {
    return simpleDB.getUserDocument(documentId, userId);
}

async function deleteUserDocument(documentId, userId) {
    return simpleDB.deleteUserDocument(documentId, userId);
}

// Simplified version management functions
async function saveDocumentWithVersion(documentId, title, content, userId, commitMessage) {
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