/**
 * SQLite Database Adapter
 * Wraps the existing SQLite implementation to conform to the DatabaseAdapter interface
 */

const BaseAdapter = require('./BaseAdapter');
const { ErrorHandler } = require('../errors/DatabaseError');

// Import existing SQLite functions
const sqliteDb = require('../database');

class SQLiteAdapter extends BaseAdapter {
    constructor(config) {
        super(config);
        this.type = 'sqlite';
        this.db = null;
    }

    /**
     * Connect to SQLite database (initialize existing implementation)
     */
    async connect() {
        try {
            // Use the existing initialization logic
            this.db = await sqliteDb.initializeDatabaseAsync();
            this.connected = true;
            console.log('✅ Connected to SQLite database with encryption');
        } catch (error) {
            this.connected = false;
            throw ErrorHandler.createError(error, 'SQLite connection');
        }
    }

    /**
     * Disconnect from SQLite database
     */
    async disconnect() {
        if (this.db) {
            try {
                this.db.close();
                this.connected = false;
                console.log('Disconnected from SQLite database');
            } catch (error) {
                throw ErrorHandler.createError(error, 'SQLite disconnection');
            }
        }
    }

    /**
     * Execute a query (wrapper around existing SQLite db)
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<Object>} Query result
     */
    async query(sql, params = []) {
        if (!this.connected || !this.db) {
            throw new Error('Database not connected');
        }

        try {
            // For SQLite, we need to determine if it's a SELECT or modification query
            const isSelect = sql.trim().toLowerCase().startsWith('select');
            
            if (isSelect) {
                const stmt = this.db.prepare(sql);
                const result = params.length > 0 ? stmt.all(...params) : stmt.all();
                return {
                    rows: result,
                    rowCount: result.length,
                    command: 'SELECT'
                };
            } else {
                const stmt = this.db.prepare(sql);
                const result = params.length > 0 ? stmt.run(...params) : stmt.run();
                
                // Update metadata
                this.lastInsertId = result.lastInsertRowid || null;
                this.changes = result.changes || 0;
                
                return {
                    rows: [],
                    rowCount: result.changes || 0,
                    command: sql.trim().split(' ')[0].toUpperCase(),
                    lastInsertRowid: result.lastInsertRowid
                };
            }
        } catch (error) {
            throw ErrorHandler.createError(error, 'SQLite query', { sql, params });
        }
    }

    /**
     * Prepare a statement
     * @param {string} sql - SQL query
     * @returns {Object} Prepared statement object
     */
    async prepare(sql) {
        if (!this.connected || !this.db) {
            throw new Error('Database not connected');
        }

        try {
            const stmt = this.db.prepare(sql);
            return {
                sql,
                execute: async (params = []) => {
                    const isSelect = sql.trim().toLowerCase().startsWith('select');
                    
                    if (isSelect) {
                        const result = params.length > 0 ? stmt.all(...params) : stmt.all();
                        return {
                            rows: result,
                            rowCount: result.length,
                            command: 'SELECT'
                        };
                    } else {
                        const result = params.length > 0 ? stmt.run(...params) : stmt.run();
                        this.lastInsertId = result.lastInsertRowid || null;
                        this.changes = result.changes || 0;
                        return {
                            rows: [],
                            rowCount: result.changes || 0,
                            command: sql.trim().split(' ')[0].toUpperCase(),
                            lastInsertRowid: result.lastInsertRowid
                        };
                    }
                }
            };
        } catch (error) {
            throw ErrorHandler.createError(error, 'SQLite prepare', { sql });
        }
    }

    /**
     * Execute a transaction
     * @param {Function} callback - Transaction callback
     * @returns {Promise<any>} Transaction result
     */
    async transaction(callback) {
        if (!this.connected || !this.db) {
            throw new Error('Database not connected');
        }

        const transaction = this.db.transaction((callback) => {
            // Create a transaction context that mimics the PostgreSQL interface
            const transactionContext = {
                query: async (sql, params = []) => {
                    return await this.query(sql, params);
                }
            };
            
            return callback(transactionContext);
        });

        try {
            return transaction(callback);
        } catch (error) {
            throw ErrorHandler.createError(error, 'SQLite transaction');
        }
    }

    /**
     * Create database tables (use existing implementation)
     */
    async createTables() {
        try {
            // The existing initDatabase function creates all tables
            sqliteDb.initDatabase();
            console.log('SQLite tables created successfully');
        } catch (error) {
            throw ErrorHandler.createError(error, 'SQLite table creation');
        }
    }

    /**
     * Run database migrations
     */
    async migrate() {
        // Placeholder for future migration system
        console.log('SQLite migrations completed');
    }

    // User operations (wrap existing functions)
    async createUser(email, username, password) {
        try {
            return await sqliteDb.createUser(email, username, password);
        } catch (error) {
            throw ErrorHandler.createError(error, 'create user');
        }
    }

    async validateUser(email, password) {
        try {
            return await sqliteDb.validateUser(email, password);
        } catch (error) {
            throw ErrorHandler.createError(error, 'validate user');
        }
    }

    async getUserById(id) {
        try {
            return sqliteDb.getUserById(id);
        } catch (error) {
            throw ErrorHandler.createError(error, 'get user by ID');
        }
    }

    // Document operations (wrap existing functions)
    async saveDocument(document, userId) {
        try {
            const result = sqliteDb.saveDocument(document, userId);
            return result;
        } catch (error) {
            throw ErrorHandler.createError(error, 'save document');
        }
    }

    async getUserDocuments(userId) {
        try {
            return sqliteDb.getUserDocuments(userId);
        } catch (error) {
            throw ErrorHandler.createError(error, 'get user documents');
        }
    }

    async getUserDocument(documentId, userId) {
        try {
            return sqliteDb.getUserDocument(documentId, userId);
        } catch (error) {
            throw ErrorHandler.createError(error, 'get user document');
        }
    }

    async deleteUserDocument(documentId, userId) {
        try {
            return sqliteDb.deleteUserDocument(documentId, userId);
        } catch (error) {
            throw ErrorHandler.createError(error, 'delete user document');
        }
    }

    // Version control operations (wrap existing functions)
    async saveDocumentWithVersion(document, userId, commitMessage = 'Auto-save') {
        try {
            return sqliteDb.saveDocumentWithVersion(document, userId, commitMessage);
        } catch (error) {
            throw ErrorHandler.createError(error, 'save document with version');
        }
    }

    async getDocumentVersionHistory(documentId, userId) {
        try {
            return sqliteDb.getDocumentVersionHistory(documentId, userId);
        } catch (error) {
            throw ErrorHandler.createError(error, 'get document version history');
        }
    }

    async restoreDocumentVersion(documentId, versionId, userId) {
        try {
            return sqliteDb.restoreDocumentVersion(documentId, versionId, userId);
        } catch (error) {
            throw ErrorHandler.createError(error, 'restore document version');
        }
    }

    async compareDocumentVersions(documentId, versionId1, versionId2, userId) {
        try {
            return sqliteDb.compareDocumentVersions(documentId, versionId1, versionId2, userId);
        } catch (error) {
            throw ErrorHandler.createError(error, 'compare document versions');
        }
    }

    async createDocumentBranch(documentId, branchName, baseVersionId, userId) {
        try {
            return sqliteDb.createDocumentBranch(documentId, branchName, baseVersionId, userId);
        } catch (error) {
            throw ErrorHandler.createError(error, 'create document branch');
        }
    }

    async getDocumentBranches(documentId, userId) {
        try {
            return sqliteDb.getDocumentBranches(documentId, userId);
        } catch (error) {
            throw ErrorHandler.createError(error, 'get document branches');
        }
    }

    async createVersionTag(versionId, tagName, description, userId) {
        try {
            return sqliteDb.createVersionTag(versionId, tagName, description, userId);
        } catch (error) {
            throw ErrorHandler.createError(error, 'create version tag');
        }
    }

    async getVersionTags(versionId, userId) {
        try {
            return sqliteDb.getVersionTags(versionId, userId);
        } catch (error) {
            throw ErrorHandler.createError(error, 'get version tags');
        }
    }

    async getVersionChanges(documentId, versionId, userId) {
        try {
            return sqliteDb.getVersionChanges(documentId, versionId, userId);
        } catch (error) {
            throw ErrorHandler.createError(error, 'get version changes');
        }
    }

    // Utility methods specific to SQLite
    generateContentHash(content) {
        return sqliteDb.generateContentHash ? sqliteDb.generateContentHash(content) : 
               require('crypto').createHash('sha256').update(content).digest('hex');
    }

    /**
     * Get the underlying SQLite database instance
     * @returns {Object} SQLite database instance
     */
    getSQLiteDb() {
        return this.db;
    }

    /**
     * Check if the database is encrypted
     * @returns {boolean} True if database uses encryption
     */
    isEncrypted() {
        // SQLite adapter always uses encryption via keytar
        return true;
    }
}

module.exports = SQLiteAdapter;