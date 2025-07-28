/**
 * Abstract Database Adapter Interface
 * Defines the standard interface that all database adapters must implement
 */

class DatabaseAdapter {
    constructor(config) {
        this.config = config;
        this.connected = false;
        this.type = 'unknown';
    }

    // Connection management
    async connect() {
        throw new Error('connect() method must be implemented by subclass');
    }

    async disconnect() {
        throw new Error('disconnect() method must be implemented by subclass');
    }

    isConnected() {
        return this.connected;
    }

    getType() {
        return this.type;
    }

    // Query execution
    async query(sql, params = []) {
        throw new Error('query() method must be implemented by subclass');
    }

    async prepare(sql) {
        throw new Error('prepare() method must be implemented by subclass');
    }

    async transaction(callback) {
        throw new Error('transaction() method must be implemented by subclass');
    }

    // Schema management
    async createTables() {
        throw new Error('createTables() method must be implemented by subclass');
    }

    async migrate() {
        throw new Error('migrate() method must be implemented by subclass');
    }

    // Utility methods
    getLastInsertId() {
        throw new Error('getLastInsertId() method must be implemented by subclass');
    }

    getChanges() {
        throw new Error('getChanges() method must be implemented by subclass');
    }

    // User operations interface
    async createUser(email, username, password) {
        throw new Error('createUser() method must be implemented by subclass');
    }

    async validateUser(email, password) {
        throw new Error('validateUser() method must be implemented by subclass');
    }

    async getUserById(id) {
        throw new Error('getUserById() method must be implemented by subclass');
    }

    // Document operations interface
    async saveDocument(document, userId) {
        throw new Error('saveDocument() method must be implemented by subclass');
    }

    async getUserDocuments(userId) {
        throw new Error('getUserDocuments() method must be implemented by subclass');
    }

    async getUserDocument(documentId, userId) {
        throw new Error('getUserDocument() method must be implemented by subclass');
    }

    async deleteUserDocument(documentId, userId) {
        throw new Error('deleteUserDocument() method must be implemented by subclass');
    }

    // Version control operations interface
    async saveDocumentWithVersion(document, userId, commitMessage) {
        throw new Error('saveDocumentWithVersion() method must be implemented by subclass');
    }

    async getDocumentVersionHistory(documentId, userId) {
        throw new Error('getDocumentVersionHistory() method must be implemented by subclass');
    }

    async restoreDocumentVersion(documentId, versionId, userId) {
        throw new Error('restoreDocumentVersion() method must be implemented by subclass');
    }

    async compareDocumentVersions(documentId, versionId1, versionId2, userId) {
        throw new Error('compareDocumentVersions() method must be implemented by subclass');
    }

    async createDocumentBranch(documentId, branchName, baseVersionId, userId) {
        throw new Error('createDocumentBranch() method must be implemented by subclass');
    }

    async getDocumentBranches(documentId, userId) {
        throw new Error('getDocumentBranches() method must be implemented by subclass');
    }

    async createVersionTag(versionId, tagName, description, userId) {
        throw new Error('createVersionTag() method must be implemented by subclass');
    }

    async getVersionTags(versionId, userId) {
        throw new Error('getVersionTags() method must be implemented by subclass');
    }

    async getVersionChanges(documentId, versionId, userId) {
        throw new Error('getVersionChanges() method must be implemented by subclass');
    }
}

module.exports = DatabaseAdapter;