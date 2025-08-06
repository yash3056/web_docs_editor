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
            
            // Ensure database fields take precedence over JSON content fields
            return {
                ...doc,
                id: row.id,
                title: row.title, // Database title takes precedence
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
        try {
            // First verify user has access to this document
            const docResult = await this.query(`
                SELECT * FROM documents WHERE id = $1 AND user_id = $2
            `, [documentId, userId]);

            if (docResult.rows.length === 0) {
                throw new Error('Document not found or access denied');
            }

            // Get the version to restore
            const versionResult = await this.query(`
                SELECT * FROM document_versions WHERE id = $1 AND document_id = $2
            `, [versionId, documentId]);

            if (versionResult.rows.length === 0) {
                throw new Error('Version not found');
            }

            const version = versionResult.rows[0];

            // Parse the document content from the version
            const versionDoc = JSON.parse(version.content);

            // Save as new version with restore message
            return await this.saveDocumentWithVersion(
                {
                    ...versionDoc,
                    id: documentId,
                    lastModified: Date.now()
                },
                userId,
                `Restored from version ${version.version_number}`
            );
        } catch (error) {
            throw ErrorHandler.createError(error, 'restore document version');
        }
    }

    async compareDocumentVersions(documentId, versionId1, versionId2, userId) {
        try {
            // First verify user has access to this document
            const docResult = await this.query(`
                SELECT * FROM documents WHERE id = $1 AND user_id = $2
            `, [documentId, userId]);

            if (docResult.rows.length === 0) {
                throw new Error('Document not found or access denied');
            }

            // Get both versions
            const version1Result = await this.query(`
                SELECT * FROM document_versions WHERE id = $1 AND document_id = $2
            `, [versionId1, documentId]);

            const version2Result = await this.query(`
                SELECT * FROM document_versions WHERE id = $1 AND document_id = $2
            `, [versionId2, documentId]);

            if (version1Result.rows.length === 0 || version2Result.rows.length === 0) {
                throw new Error('One or both versions not found');
            }

            const version1 = version1Result.rows[0];
            const version2 = version2Result.rows[0];

            const doc1 = JSON.parse(version1.content);
            const doc2 = JSON.parse(version2.content);

            const text1 = this.extractTextContent(doc1.content);
            const text2 = this.extractTextContent(doc2.content);

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
        } catch (error) {
            throw ErrorHandler.createError(error, 'compare document versions');
        }
    }

    async createDocumentBranch(documentId, branchName, baseVersionId, userId) {
        try {
            // First verify user has access to this document
            const docResult = await this.query(`
                SELECT * FROM documents WHERE id = $1 AND user_id = $2
            `, [documentId, userId]);

            if (docResult.rows.length === 0) {
                throw new Error('Document not found or access denied');
            }

            const result = await this.query(`
                INSERT INTO document_branches (document_id, branch_name, base_version_id, created_by)
                VALUES ($1, $2, $3, $4)
                RETURNING id, branch_name
            `, [documentId, branchName, baseVersionId, userId]);

            return result.rows[0];
        } catch (error) {
            if (error.originalError && error.originalError.code === '23505') {
                throw new Error('Branch name already exists for this document');
            }
            throw ErrorHandler.createError(error, 'create document branch');
        }
    }

    async getDocumentBranches(documentId, userId) {
        try {
            // First verify user has access to this document
            const docResult = await this.query(`
                SELECT * FROM documents WHERE id = $1 AND user_id = $2
            `, [documentId, userId]);

            if (docResult.rows.length === 0) {
                return null;
            }

            const result = await this.query(`
                SELECT * FROM document_branches WHERE document_id = $1 AND is_active = true
            `, [documentId]);

            return result.rows;
        } catch (error) {
            throw ErrorHandler.createError(error, 'get document branches');
        }
    }

    async createVersionTag(versionId, tagName, description, userId) {
        try {
            // First verify the version exists
            const versionResult = await this.query(`
                SELECT * FROM document_versions WHERE id = $1
            `, [versionId]);

            if (versionResult.rows.length === 0) {
                throw new Error('Version not found');
            }

            const version = versionResult.rows[0];

            // Check if user has access to the document
            const docResult = await this.query(`
                SELECT * FROM documents WHERE id = $1 AND user_id = $2
            `, [version.document_id, userId]);

            if (docResult.rows.length === 0) {
                throw new Error('Access denied');
            }

            const result = await this.query(`
                INSERT INTO version_tags (version_id, tag_name, description, created_by)
                VALUES ($1, $2, $3, $4)
                RETURNING id, tag_name
            `, [versionId, tagName, description, userId]);

            return result.rows[0];
        } catch (error) {
            if (error.originalError && error.originalError.code === '23505') {
                throw new Error('Tag name already exists for this version');
            }
            throw ErrorHandler.createError(error, 'create version tag');
        }
    }

    async getVersionTags(versionId, userId) {
        try {
            // First verify the version exists
            const versionResult = await this.query(`
                SELECT * FROM document_versions WHERE id = $1
            `, [versionId]);

            if (versionResult.rows.length === 0) {
                return null;
            }

            const version = versionResult.rows[0];

            // Check if user has access to the document
            const docResult = await this.query(`
                SELECT * FROM documents WHERE id = $1 AND user_id = $2
            `, [version.document_id, userId]);

            if (docResult.rows.length === 0) {
                return null;
            }

            const result = await this.query(`
                SELECT * FROM version_tags WHERE version_id = $1
            `, [versionId]);

            return result.rows;
        } catch (error) {
            throw ErrorHandler.createError(error, 'get version tags');
        }
    }

    async getVersionChanges(documentId, versionId, userId) {
        try {
            // Verify user has access to this document
            const docResult = await this.query(`
                SELECT * FROM documents WHERE id = $1 AND user_id = $2
            `, [documentId, userId]);

            if (docResult.rows.length === 0) {
                throw new Error('Document not found or access denied');
            }

            const currentVersionResult = await this.query(`
                SELECT * FROM document_versions WHERE id = $1 AND document_id = $2
            `, [versionId, documentId]);

            if (currentVersionResult.rows.length === 0) {
                throw new Error('Version not found');
            }

            const currentVersion = currentVersionResult.rows[0];

            // Get the previous version
            const previousVersionResult = await this.query(`
                SELECT * FROM document_versions 
                WHERE document_id = $1 AND version_number = $2
                ORDER BY version_number DESC
                LIMIT 1
            `, [documentId, currentVersion.version_number - 1]);

            if (previousVersionResult.rows.length === 0) {
                // This is the first version, show the entire content as additions
                const doc = JSON.parse(currentVersion.content);
                const text = this.extractTextContent(doc.content);

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

            const previousVersion = previousVersionResult.rows[0];

            // Compare with previous version
            const prevDoc = JSON.parse(previousVersion.content);
            const currDoc = JSON.parse(currentVersion.content);

            const prevText = this.extractTextContent(prevDoc.content);
            const currText = this.extractTextContent(currDoc.content);

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
                            type: 'deletion',
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

            // General case: use diff library for complex changes
            const lineDiff = diff.diffLines(prevText, currText);
            const wordDiff = diff.diffWords(prevText, currText);

            let added = 0, removed = 0, modified = 0;
            lineDiff.forEach(part => {
                if (part.added) added += part.count || 1;
                else if (part.removed) removed += part.count || 1;
                else modified += part.count || 1;
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
                    type: 'modification',
                    added,
                    removed,
                    modified
                },
                diff: {
                    lines: lineDiff,
                    words: wordDiff
                }
            };

        } catch (error) {
            throw ErrorHandler.createError(error, 'get version changes');
        }
    }

    // Helper function to extract text content from document structure
    extractTextContent(content) {
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
}

module.exports = PostgreSQLAdapter;