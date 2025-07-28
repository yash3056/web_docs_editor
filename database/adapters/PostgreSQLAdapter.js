/**
 * PostgreSQL Database Adapter
 * Implements the DatabaseAdapter interface using node-postgres (pg)
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const diff = require('diff');
const BaseAdapter = require('./BaseAdapter');
const { ErrorHandler } = require('../errors/DatabaseError');

class PostgreSQLAdapter extends BaseAdapter {
    constructor(config) {
        super(config);
        this.type = 'postgresql';
        this.pool = null;
        this.preparedStatements = new Map();
    }

    /**
     * Connect to PostgreSQL database
     */
    async connect() {
        try {
            await this.retryConnection(async () => {
                this.pool = new Pool({
                    host: this.config.host,
                    port: this.config.port,
                    database: this.config.database,
                    user: this.config.user,
                    password: this.config.password,
                    ssl: this.config.ssl,
                    min: this.config.min,
                    max: this.config.max,
                    idleTimeoutMillis: this.config.idleTimeoutMillis,
                    connectionTimeoutMillis: this.config.connectionTimeoutMillis,
                    application_name: this.config.application_name,
                    statement_timeout: this.config.statement_timeout
                });

                // Test connection
                const client = await this.pool.connect();
                await client.query('SELECT 1');
                client.release();

                this.connected = true;
                console.log(`✅ Connected to PostgreSQL database: ${this.config.database}`);
            });
        } catch (error) {
            this.connected = false;
            throw ErrorHandler.createError(error, 'PostgreSQL connection', {
                host: this.config.host,
                port: this.config.port,
                database: this.config.database
            });
        }
    }

    /**
     * Disconnect from PostgreSQL database
     */
    async disconnect() {
        if (this.pool) {
            try {
                await this.pool.end();
                this.connected = false;
                this.preparedStatements.clear();
                console.log('Disconnected from PostgreSQL database');
            } catch (error) {
                throw ErrorHandler.createError(error, 'PostgreSQL disconnection');
            }
        }
    }

    /**
     * Execute a query
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<Object>} Query result
     */
    async query(sql, params = []) {
        if (!this.connected || !this.pool) {
            throw new Error('Database not connected');
        }

        try {
            const result = await this.pool.query(sql, params);
            
            // Update metadata
            if (result.command === 'INSERT' && result.rowCount > 0) {
                // For INSERT with RETURNING, get the ID from the result
                if (result.rows.length > 0 && result.rows[0].id) {
                    this.lastInsertId = result.rows[0].id;
                }
            }
            this.changes = result.rowCount || 0;

            return result;
        } catch (error) {
            throw ErrorHandler.createError(error, 'PostgreSQL query', { sql, params });
        }
    }

    /**
     * Prepare a statement (PostgreSQL doesn't have explicit prepare, but we can cache)
     * @param {string} sql - SQL query
     * @returns {Object} Prepared statement object
     */
    async prepare(sql) {
        const statementId = crypto.createHash('md5').update(sql).digest('hex');
        
        if (!this.preparedStatements.has(statementId)) {
            this.preparedStatements.set(statementId, {
                sql,
                execute: async (params = []) => {
                    return await this.query(sql, params);
                }
            });
        }

        return this.preparedStatements.get(statementId);
    }

    /**
     * Execute a transaction
     * @param {Function} callback - Transaction callback
     * @returns {Promise<any>} Transaction result
     */
    async transaction(callback) {
        if (!this.connected || !this.pool) {
            throw new Error('Database not connected');
        }

        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Create a transaction context
            const transactionContext = {
                query: async (sql, params = []) => {
                    const result = await client.query(sql, params);
                    if (result.command === 'INSERT' && result.rowCount > 0 && result.rows.length > 0 && result.rows[0].id) {
                        this.lastInsertId = result.rows[0].id;
                    }
                    this.changes = result.rowCount || 0;
                    return result;
                }
            };

            const result = await callback(transactionContext);
            await client.query('COMMIT');
            
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw ErrorHandler.createError(error, 'PostgreSQL transaction');
        } finally {
            client.release();
        }
    }

    /**
     * Create database tables
     */
    async createTables() {
        const createTablesSQL = `
            -- Users table
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Documents table
            CREATE TABLE IF NOT EXISTS documents (
                id VARCHAR(255) PRIMARY KEY,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );

            -- Document versions table for version control
            CREATE TABLE IF NOT EXISTS document_versions (
                id SERIAL PRIMARY KEY,
                document_id VARCHAR(255) NOT NULL,
                version_number INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                commit_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER NOT NULL,
                is_current_version BOOLEAN DEFAULT FALSE,
                content_hash VARCHAR(64),
                FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES users (id),
                UNIQUE(document_id, version_number)
            );

            -- Document branches for advanced version control
            CREATE TABLE IF NOT EXISTS document_branches (
                id SERIAL PRIMARY KEY,
                document_id VARCHAR(255) NOT NULL,
                branch_name VARCHAR(255) NOT NULL,
                base_version_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
                FOREIGN KEY (base_version_id) REFERENCES document_versions (id),
                FOREIGN KEY (created_by) REFERENCES users (id),
                UNIQUE(document_id, branch_name)
            );

            -- Version tags for marking important versions
            CREATE TABLE IF NOT EXISTS version_tags (
                id SERIAL PRIMARY KEY,
                version_id INTEGER NOT NULL,
                tag_name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER NOT NULL,
                FOREIGN KEY (version_id) REFERENCES document_versions (id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES users (id),
                UNIQUE(version_id, tag_name)
            );

            -- Create indexes for better performance
            CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
            CREATE INDEX IF NOT EXISTS idx_document_versions_created_at ON document_versions(created_at);
            CREATE INDEX IF NOT EXISTS idx_document_branches_document_id ON document_branches(document_id);
            CREATE INDEX IF NOT EXISTS idx_version_tags_version_id ON version_tags(version_id);
        `;

        try {
            await this.query(createTablesSQL);
            console.log('PostgreSQL tables created successfully');
        } catch (error) {
            throw ErrorHandler.createError(error, 'PostgreSQL table creation');
        }
    }

    /**
     * Run database migrations
     */
    async migrate() {
        // Placeholder for future migration system
        console.log('PostgreSQL migrations completed');
    }

    // User operations
    async createUser(email, username, password) {
        const passwordHash = await bcrypt.hash(password, 10);

        try {
            const result = await this.query(`
                INSERT INTO users (email, username, password_hash)
                VALUES ($1, $2, $3)
                RETURNING id, email, username
            `, [email, username, passwordHash]);

            return result.rows[0];
        } catch (error) {
            if (error.originalError && error.originalError.code === '23505') {
                throw new Error('Email or username already exists');
            }
            throw error;
        }
    }

    async validateUser(email, password) {
        try {
            const result = await this.query(`
                SELECT id, email, username, password_hash FROM users WHERE email = $1
            `, [email]);

            if (result.rows.length === 0) {
                return null;
            }

            const user = result.rows[0];
            const isValid = await bcrypt.compare(password, user.password_hash);
            
            if (!isValid) {
                return null;
            }

            return { id: user.id, email: user.email, username: user.username };
        } catch (error) {
            throw ErrorHandler.createError(error, 'user validation');
        }
    }

    async getUserById(id) {
        try {
            const result = await this.query(`
                SELECT id, email, username, created_at FROM users WHERE id = $1
            `, [id]);

            return result.rows[0] || null;
        } catch (error) {
            throw ErrorHandler.createError(error, 'get user by ID');
        }
    }

    // Document operations
    async saveDocument(document, userId) {
        try {
            const result = await this.query(`
                INSERT INTO documents (id, user_id, title, content, last_modified)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    content = EXCLUDED.content,
                    last_modified = CURRENT_TIMESTAMP
                RETURNING *
            `, [document.id, userId, document.title, JSON.stringify(document)]);

            return result.rows[0];
        } catch (error) {
            throw ErrorHandler.createError(error, 'save document');
        }
    }

    async getUserDocuments(userId) {
        try {
            const result = await this.query(`
                SELECT * FROM documents WHERE user_id = $1 ORDER BY last_modified DESC
            `, [userId]);

            return result.rows.map(row => {
                const doc = JSON.parse(row.content);
                return {
                    ...doc,
                    id: row.id,
                    title: row.title,
                    createdAt: new Date(row.created_at).getTime(),
                    lastModified: new Date(row.last_modified).getTime()
                };
            });
        } catch (error) {
            throw ErrorHandler.createError(error, 'get user documents');
        }
    }

    async getUserDocument(documentId, userId) {
        try {
            const result = await this.query(`
                SELECT * FROM documents WHERE id = $1 AND user_id = $2
            `, [documentId, userId]);

            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            const doc = JSON.parse(row.content);
            return {
                ...doc,
                id: row.id,
                title: row.title,
                createdAt: new Date(row.created_at).getTime(),
                lastModified: new Date(row.last_modified).getTime()
            };
        } catch (error) {
            throw ErrorHandler.createError(error, 'get user document');
        }
    }

    async deleteUserDocument(documentId, userId) {
        try {
            const result = await this.query(`
                DELETE FROM documents WHERE id = $1 AND user_id = $2
            `, [documentId, userId]);

            return result.rowCount > 0;
        } catch (error) {
            throw ErrorHandler.createError(error, 'delete user document');
        }
    }

    // Version control operations (implementing key methods)
    generateContentHash(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    async saveDocumentWithVersion(document, userId, commitMessage = 'Auto-save') {
        const contentStr = JSON.stringify(document);
        const contentHash = this.generateContentHash(contentStr);

        return await this.transaction(async (tx) => {
            // Save/update the main document
            await tx.query(`
                INSERT INTO documents (id, user_id, title, content, last_modified)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    content = EXCLUDED.content,
                    last_modified = CURRENT_TIMESTAMP
            `, [document.id, userId, document.title, contentStr]);

            // Check if this is a new version (different content)
            const currentVersionResult = await tx.query(`
                SELECT * FROM document_versions WHERE document_id = $1 AND is_current_version = true
            `, [document.id]);

            const currentVersion = currentVersionResult.rows[0];
            
            if (!currentVersion || currentVersion.content_hash !== contentHash) {
                // Get next version number
                const maxVersionResult = await tx.query(`
                    SELECT COALESCE(MAX(version_number), 0) as max_version FROM document_versions WHERE document_id = $1
                `, [document.id]);
                
                const nextVersionNumber = maxVersionResult.rows[0].max_version + 1;

                // Mark all versions as not current
                await tx.query(`
                    UPDATE document_versions SET is_current_version = false WHERE document_id = $1
                `, [document.id]);

                // Create new version
                await tx.query(`
                    INSERT INTO document_versions (document_id, version_number, title, content, commit_message, created_by, is_current_version, content_hash)
                    VALUES ($1, $2, $3, $4, $5, $6, true, $7)
                `, [document.id, nextVersionNumber, document.title, contentStr, commitMessage, userId, contentHash]);
            }
        });
    }

    async getDocumentVersionHistory(documentId, userId) {
        try {
            // First verify user has access to this document
            const docResult = await this.query(`
                SELECT * FROM documents WHERE id = $1 AND user_id = $2
            `, [documentId, userId]);

            if (docResult.rows.length === 0) {
                return null;
            }

            const result = await this.query(`
                SELECT 
                    v.*,
                    u.username as author,
                    STRING_AGG(t.tag_name, ',') as tags
                FROM document_versions v
                LEFT JOIN users u ON v.created_by = u.id
                LEFT JOIN version_tags t ON v.id = t.version_id
                WHERE v.document_id = $1
                GROUP BY v.id, u.username
                ORDER BY v.version_number DESC
            `, [documentId]);

            return result.rows;
        } catch (error) {
            throw ErrorHandler.createError(error, 'get document version history');
        }
    }

    // Placeholder implementations for other version control methods
    async restoreDocumentVersion(documentId, versionId, userId) {
        // Implementation similar to SQLite version but with PostgreSQL syntax
        throw new Error('restoreDocumentVersion not yet implemented for PostgreSQL');
    }

    async compareDocumentVersions(documentId, versionId1, versionId2, userId) {
        // Implementation similar to SQLite version but with PostgreSQL syntax
        throw new Error('compareDocumentVersions not yet implemented for PostgreSQL');
    }

    async createDocumentBranch(documentId, branchName, baseVersionId, userId) {
        // Implementation similar to SQLite version but with PostgreSQL syntax
        throw new Error('createDocumentBranch not yet implemented for PostgreSQL');
    }

    async getDocumentBranches(documentId, userId) {
        // Implementation similar to SQLite version but with PostgreSQL syntax
        throw new Error('getDocumentBranches not yet implemented for PostgreSQL');
    }

    async createVersionTag(versionId, tagName, description, userId) {
        // Implementation similar to SQLite version but with PostgreSQL syntax
        throw new Error('createVersionTag not yet implemented for PostgreSQL');
    }

    async getVersionTags(versionId, userId) {
        // Implementation similar to SQLite version but with PostgreSQL syntax
        throw new Error('getVersionTags not yet implemented for PostgreSQL');
    }

    async getVersionChanges(documentId, versionId, userId) {
        // Implementation similar to SQLite version but with PostgreSQL syntax
        throw new Error('getVersionChanges not yet implemented for PostgreSQL');
    }
}

module.exports = PostgreSQLAdapter;