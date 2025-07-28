/**
 * SQLite Adapter Tests
 * Tests for SQLite database adapter functionality
 */

const SQLiteAdapter = require('../adapters/SQLiteAdapter');
const { DatabaseError } = require('../errors/DatabaseError');

// Mock the existing database module
jest.mock('../database', () => ({
    initializeDatabaseAsync: jest.fn(),
    initDatabase: jest.fn(),
    createUser: jest.fn(),
    validateUser: jest.fn(),
    getUserById: jest.fn(),
    saveDocument: jest.fn(),
    getUserDocuments: jest.fn(),
    getUserDocument: jest.fn(),
    deleteUserDocument: jest.fn(),
    saveDocumentWithVersion: jest.fn(),
    getDocumentVersionHistory: jest.fn(),
    restoreDocumentVersion: jest.fn(),
    compareDocumentVersions: jest.fn(),
    createDocumentBranch: jest.fn(),
    getDocumentBranches: jest.fn(),
    createVersionTag: jest.fn(),
    getVersionTags: jest.fn(),
    getVersionChanges: jest.fn()
}));

const sqliteDb = require('../database');

describe('SQLiteAdapter', () => {
    let adapter;
    let mockDb;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Setup mock database
        mockDb = {
            prepare: jest.fn(),
            close: jest.fn(),
            transaction: jest.fn()
        };

        sqliteDb.initializeDatabaseAsync.mockResolvedValue(mockDb);

        // Create adapter with test config
        const config = {
            useExistingImplementation: true,
            enableEncryption: true,
            enableForeignKeys: true
        };

        adapter = new SQLiteAdapter(config);
    });

    describe('Connection Management', () => {
        test('should connect successfully', async () => {
            await adapter.connect();

            expect(sqliteDb.initializeDatabaseAsync).toHaveBeenCalled();
            expect(adapter.isConnected()).toBe(true);
            expect(adapter.getType()).toBe('sqlite');
        });

        test('should handle connection failure', async () => {
            const connectionError = new Error('Failed to initialize database');
            sqliteDb.initializeDatabaseAsync.mockRejectedValue(connectionError);

            await expect(adapter.connect()).rejects.toThrow(DatabaseError);
            expect(adapter.isConnected()).toBe(false);
        });

        test('should disconnect successfully', async () => {
            await adapter.connect();
            await adapter.disconnect();

            expect(mockDb.close).toHaveBeenCalled();
            expect(adapter.isConnected()).toBe(false);
        });
    });

    describe('Query Execution', () => {
        beforeEach(async () => {
            await adapter.connect();
        });

        test('should execute SELECT query successfully', async () => {
            const mockStmt = {
                all: jest.fn().mockReturnValue([{ id: 1, name: 'test' }])
            };
            mockDb.prepare.mockReturnValue(mockStmt);

            const result = await adapter.query('SELECT * FROM users WHERE id = ?', [1]);

            expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?');
            expect(mockStmt.all).toHaveBeenCalledWith(1);
            expect(result.rows).toEqual([{ id: 1, name: 'test' }]);
            expect(result.command).toBe('SELECT');
        });

        test('should execute INSERT query successfully', async () => {
            const mockStmt = {
                run: jest.fn().mockReturnValue({ lastInsertRowid: 123, changes: 1 })
            };
            mockDb.prepare.mockReturnValue(mockStmt);

            const result = await adapter.query('INSERT INTO users (name) VALUES (?)', ['test']);

            expect(mockDb.prepare).toHaveBeenCalledWith('INSERT INTO users (name) VALUES (?)');
            expect(mockStmt.run).toHaveBeenCalledWith('test');
            expect(result.rowCount).toBe(1);
            expect(result.command).toBe('INSERT');
            expect(adapter.getLastInsertId()).toBe(123);
        });

        test('should handle query errors', async () => {
            const queryError = new Error('SQL syntax error');
            mockDb.prepare.mockImplementation(() => {
                throw queryError;
            });

            await expect(adapter.query('INVALID SQL')).rejects.toThrow(DatabaseError);
        });
    });

    describe('Prepared Statements', () => {
        beforeEach(async () => {
            await adapter.connect();
        });

        test('should create prepared statement for SELECT', async () => {
            const mockStmt = {
                all: jest.fn().mockReturnValue([{ id: 1, name: 'test' }])
            };
            mockDb.prepare.mockReturnValue(mockStmt);

            const stmt = await adapter.prepare('SELECT * FROM users WHERE id = ?');
            const result = await stmt.execute([1]);

            expect(stmt.sql).toBe('SELECT * FROM users WHERE id = ?');
            expect(result.rows).toEqual([{ id: 1, name: 'test' }]);
        });

        test('should create prepared statement for INSERT', async () => {
            const mockStmt = {
                run: jest.fn().mockReturnValue({ lastInsertRowid: 123, changes: 1 })
            };
            mockDb.prepare.mockReturnValue(mockStmt);

            const stmt = await adapter.prepare('INSERT INTO users (name) VALUES (?)');
            const result = await stmt.execute(['test']);

            expect(result.rowCount).toBe(1);
            expect(result.lastInsertRowid).toBe(123);
        });
    });

    describe('Transactions', () => {
        beforeEach(async () => {
            await adapter.connect();
        });

        test('should execute transaction successfully', async () => {
            const mockTransaction = jest.fn().mockImplementation((callback) => {
                return callback();
            });
            mockDb.transaction.mockReturnValue(mockTransaction);

            const result = await adapter.transaction(async (tx) => {
                // Mock query execution within transaction
                return 'success';
            });

            expect(mockDb.transaction).toHaveBeenCalled();
            expect(result).toBe('success');
        });

        test('should handle transaction errors', async () => {
            const transactionError = new Error('Transaction failed');
            const mockTransaction = jest.fn().mockImplementation(() => {
                throw transactionError;
            });
            mockDb.transaction.mockReturnValue(mockTransaction);

            await expect(adapter.transaction(async (tx) => {
                throw transactionError;
            })).rejects.toThrow(DatabaseError);
        });
    });

    describe('Table Creation', () => {
        beforeEach(async () => {
            await adapter.connect();
        });

        test('should create tables successfully', async () => {
            await adapter.createTables();

            expect(sqliteDb.initDatabase).toHaveBeenCalled();
        });
    });

    describe('User Operations', () => {
        beforeEach(async () => {
            await adapter.connect();
        });

        test('should create user successfully', async () => {
            const mockUser = { id: 1, email: 'test@test.com', username: 'testuser' };
            sqliteDb.createUser.mockResolvedValue(mockUser);

            const result = await adapter.createUser('test@test.com', 'testuser', 'password');

            expect(sqliteDb.createUser).toHaveBeenCalledWith('test@test.com', 'testuser', 'password');
            expect(result).toEqual(mockUser);
        });

        test('should validate user successfully', async () => {
            const mockUser = { id: 1, email: 'test@test.com', username: 'testuser' };
            sqliteDb.validateUser.mockResolvedValue(mockUser);

            const result = await adapter.validateUser('test@test.com', 'password');

            expect(sqliteDb.validateUser).toHaveBeenCalledWith('test@test.com', 'password');
            expect(result).toEqual(mockUser);
        });

        test('should get user by ID successfully', async () => {
            const mockUser = { id: 1, email: 'test@test.com', username: 'testuser' };
            sqliteDb.getUserById.mockReturnValue(mockUser);

            const result = await adapter.getUserById(1);

            expect(sqliteDb.getUserById).toHaveBeenCalledWith(1);
            expect(result).toEqual(mockUser);
        });

        test('should handle user operation errors', async () => {
            const userError = new Error('User creation failed');
            sqliteDb.createUser.mockRejectedValue(userError);

            await expect(adapter.createUser('test@test.com', 'testuser', 'password'))
                .rejects.toThrow(DatabaseError);
        });
    });

    describe('Document Operations', () => {
        beforeEach(async () => {
            await adapter.connect();
        });

        test('should save document successfully', async () => {
            const document = { id: 'doc1', title: 'Test Doc', content: 'Test content' };
            const mockResult = { id: 'doc1', title: 'Test Doc' };
            sqliteDb.saveDocument.mockReturnValue(mockResult);

            const result = await adapter.saveDocument(document, 1);

            expect(sqliteDb.saveDocument).toHaveBeenCalledWith(document, 1);
            expect(result).toEqual(mockResult);
        });

        test('should get user documents successfully', async () => {
            const mockDocuments = [
                { id: 'doc1', title: 'Test Doc 1' },
                { id: 'doc2', title: 'Test Doc 2' }
            ];
            sqliteDb.getUserDocuments.mockReturnValue(mockDocuments);

            const result = await adapter.getUserDocuments(1);

            expect(sqliteDb.getUserDocuments).toHaveBeenCalledWith(1);
            expect(result).toEqual(mockDocuments);
        });

        test('should get user document successfully', async () => {
            const mockDocument = { id: 'doc1', title: 'Test Doc', content: 'Test content' };
            sqliteDb.getUserDocument.mockReturnValue(mockDocument);

            const result = await adapter.getUserDocument('doc1', 1);

            expect(sqliteDb.getUserDocument).toHaveBeenCalledWith('doc1', 1);
            expect(result).toEqual(mockDocument);
        });

        test('should delete user document successfully', async () => {
            sqliteDb.deleteUserDocument.mockReturnValue(true);

            const result = await adapter.deleteUserDocument('doc1', 1);

            expect(sqliteDb.deleteUserDocument).toHaveBeenCalledWith('doc1', 1);
            expect(result).toBe(true);
        });
    });

    describe('Version Control Operations', () => {
        beforeEach(async () => {
            await adapter.connect();
        });

        test('should save document with version successfully', async () => {
            const document = { id: 'doc1', title: 'Test Doc', content: 'Test content' };
            sqliteDb.saveDocumentWithVersion.mockReturnValue(undefined);

            await adapter.saveDocumentWithVersion(document, 1, 'Test commit');

            expect(sqliteDb.saveDocumentWithVersion).toHaveBeenCalledWith(document, 1, 'Test commit');
        });

        test('should get document version history successfully', async () => {
            const mockHistory = [
                { id: 1, version_number: 2, title: 'Test Doc v2' },
                { id: 2, version_number: 1, title: 'Test Doc v1' }
            ];
            sqliteDb.getDocumentVersionHistory.mockReturnValue(mockHistory);

            const result = await adapter.getDocumentVersionHistory('doc1', 1);

            expect(sqliteDb.getDocumentVersionHistory).toHaveBeenCalledWith('doc1', 1);
            expect(result).toEqual(mockHistory);
        });

        test('should restore document version successfully', async () => {
            sqliteDb.restoreDocumentVersion.mockReturnValue(undefined);

            await adapter.restoreDocumentVersion('doc1', 1, 1);

            expect(sqliteDb.restoreDocumentVersion).toHaveBeenCalledWith('doc1', 1, 1);
        });

        test('should compare document versions successfully', async () => {
            const mockComparison = {
                version1: { id: 1, content: 'Old content' },
                version2: { id: 2, content: 'New content' },
                diff: { words: [] }
            };
            sqliteDb.compareDocumentVersions.mockReturnValue(mockComparison);

            const result = await adapter.compareDocumentVersions('doc1', 1, 2, 1);

            expect(sqliteDb.compareDocumentVersions).toHaveBeenCalledWith('doc1', 1, 2, 1);
            expect(result).toEqual(mockComparison);
        });
    });

    describe('Utility Methods', () => {
        test('should identify as encrypted database', () => {
            expect(adapter.isEncrypted()).toBe(true);
        });

        test('should return SQLite database instance', async () => {
            await adapter.connect();
            
            const db = adapter.getSQLiteDb();
            expect(db).toBe(mockDb);
        });

        test('should generate content hash', () => {
            const content = 'test content';
            const hash = adapter.generateContentHash(content);
            
            expect(typeof hash).toBe('string');
            expect(hash.length).toBe(64); // SHA-256 hex string length
        });
    });
});