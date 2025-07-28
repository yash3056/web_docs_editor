/**
 * PostgreSQL Adapter Tests
 * Tests for PostgreSQL database adapter functionality
 */

const PostgreSQLAdapter = require('../adapters/PostgreSQLAdapter');
const { ConnectionError, QueryError } = require('../errors/DatabaseError');

// Mock pg module
jest.mock('pg', () => ({
    Pool: jest.fn().mockImplementation(() => ({
        connect: jest.fn(),
        query: jest.fn(),
        end: jest.fn()
    }))
}));

const { Pool } = require('pg');

describe('PostgreSQLAdapter', () => {
    let adapter;
    let mockPool;
    let mockClient;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Setup mock client
        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };

        // Setup mock pool
        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient),
            query: jest.fn(),
            end: jest.fn()
        };

        Pool.mockImplementation(() => mockPool);

        // Create adapter with test config
        const config = {
            host: 'localhost',
            port: 5432,
            database: 'test_db',
            user: 'test_user',
            password: 'test_pass',
            ssl: false,
            min: 2,
            max: 10
        };

        adapter = new PostgreSQLAdapter(config);
    });

    describe('Connection Management', () => {
        test('should connect successfully', async () => {
            mockClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });

            await adapter.connect();

            expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
                host: 'localhost',
                port: 5432,
                database: 'test_db',
                user: 'test_user',
                password: 'test_pass'
            }));
            expect(mockPool.connect).toHaveBeenCalled();
            expect(mockClient.query).toHaveBeenCalledWith('SELECT 1');
            expect(adapter.isConnected()).toBe(true);
        });

        test('should handle connection failure', async () => {
            const connectionError = new Error('Connection refused');
            connectionError.code = 'ECONNREFUSED';
            mockPool.connect.mockRejectedValue(connectionError);

            await expect(adapter.connect()).rejects.toThrow(ConnectionError);
            expect(adapter.isConnected()).toBe(false);
        });

        test('should disconnect successfully', async () => {
            // First connect
            mockClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
            await adapter.connect();

            // Then disconnect
            await adapter.disconnect();

            expect(mockPool.end).toHaveBeenCalled();
            expect(adapter.isConnected()).toBe(false);
        });
    });

    describe('Query Execution', () => {
        beforeEach(async () => {
            mockClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
            await adapter.connect();
        });

        test('should execute query successfully', async () => {
            const mockResult = {
                rows: [{ id: 1, name: 'test' }],
                rowCount: 1,
                command: 'SELECT'
            };
            mockPool.query.mockResolvedValue(mockResult);

            const result = await adapter.query('SELECT * FROM users WHERE id = $1', [1]);

            expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
            expect(result).toBe(mockResult);
        });

        test('should handle query errors', async () => {
            const queryError = new Error('Syntax error');
            mockPool.query.mockRejectedValue(queryError);

            await expect(adapter.query('INVALID SQL')).rejects.toThrow(QueryError);
        });

        test('should update lastInsertId for INSERT queries', async () => {
            const mockResult = {
                rows: [{ id: 123 }],
                rowCount: 1,
                command: 'INSERT'
            };
            mockPool.query.mockResolvedValue(mockResult);

            await adapter.query('INSERT INTO users (name) VALUES ($1) RETURNING id', ['test']);

            expect(adapter.getLastInsertId()).toBe(123);
        });

        test('should update changes count', async () => {
            const mockResult = {
                rows: [],
                rowCount: 3,
                command: 'UPDATE'
            };
            mockPool.query.mockResolvedValue(mockResult);

            await adapter.query('UPDATE users SET name = $1', ['new_name']);

            expect(adapter.getChanges()).toBe(3);
        });
    });

    describe('Prepared Statements', () => {
        beforeEach(async () => {
            mockClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
            await adapter.connect();
        });

        test('should create and cache prepared statement', async () => {
            const sql = 'SELECT * FROM users WHERE id = $1';
            
            const stmt1 = await adapter.prepare(sql);
            const stmt2 = await adapter.prepare(sql);

            expect(stmt1).toBe(stmt2); // Should return cached statement
            expect(stmt1.sql).toBe(sql);
            expect(typeof stmt1.execute).toBe('function');
        });

        test('should execute prepared statement', async () => {
            const sql = 'SELECT * FROM users WHERE id = $1';
            const mockResult = { rows: [{ id: 1, name: 'test' }] };
            mockPool.query.mockResolvedValue(mockResult);

            const stmt = await adapter.prepare(sql);
            const result = await stmt.execute([1]);

            expect(mockPool.query).toHaveBeenCalledWith(sql, [1]);
            expect(result).toBe(mockResult);
        });
    });

    describe('Transactions', () => {
        beforeEach(async () => {
            mockClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
            await adapter.connect();
        });

        test('should execute transaction successfully', async () => {
            const mockResult = { rows: [{ id: 1 }] };
            mockClient.query.mockResolvedValue(mockResult);

            const result = await adapter.transaction(async (tx) => {
                await tx.query('INSERT INTO users (name) VALUES ($1)', ['test']);
                return 'success';
            });

            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(mockClient.query).toHaveBeenCalledWith('INSERT INTO users (name) VALUES ($1)', ['test']);
            expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
            expect(mockClient.release).toHaveBeenCalled();
            expect(result).toBe('success');
        });

        test('should rollback transaction on error', async () => {
            const transactionError = new Error('Transaction failed');
            mockClient.query
                .mockResolvedValueOnce() // BEGIN
                .mockRejectedValueOnce(transactionError); // INSERT fails

            await expect(adapter.transaction(async (tx) => {
                await tx.query('INSERT INTO users (name) VALUES ($1)', ['test']);
            })).rejects.toThrow();

            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
            expect(mockClient.release).toHaveBeenCalled();
        });
    });

    describe('User Operations', () => {
        beforeEach(async () => {
            mockClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
            await adapter.connect();
        });

        test('should create user successfully', async () => {
            const mockResult = {
                rows: [{ id: 1, email: 'test@test.com', username: 'testuser' }]
            };
            mockPool.query.mockResolvedValue(mockResult);

            const result = await adapter.createUser('test@test.com', 'testuser', 'password');

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO users'),
                expect.arrayContaining(['test@test.com', 'testuser', expect.any(String)])
            );
            expect(result).toEqual(mockResult.rows[0]);
        });

        test('should validate user successfully', async () => {
            // Mock bcrypt.compare to return true
            const bcrypt = require('bcryptjs');
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

            const mockResult = {
                rows: [{
                    id: 1,
                    email: 'test@test.com',
                    username: 'testuser',
                    password_hash: 'hashed_password'
                }]
            };
            mockPool.query.mockResolvedValue(mockResult);

            const result = await adapter.validateUser('test@test.com', 'password');

            expect(result).toEqual({
                id: 1,
                email: 'test@test.com',
                username: 'testuser'
            });
        });

        test('should return null for invalid user', async () => {
            mockPool.query.mockResolvedValue({ rows: [] });

            const result = await adapter.validateUser('invalid@test.com', 'password');

            expect(result).toBeNull();
        });
    });

    describe('Document Operations', () => {
        beforeEach(async () => {
            mockClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
            await adapter.connect();
        });

        test('should save document successfully', async () => {
            const document = { id: 'doc1', title: 'Test Doc', content: 'Test content' };
            const mockResult = { rows: [{ id: 'doc1', title: 'Test Doc' }] };
            mockPool.query.mockResolvedValue(mockResult);

            const result = await adapter.saveDocument(document, 1);

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO documents'),
                expect.arrayContaining(['doc1', 1, 'Test Doc', JSON.stringify(document)])
            );
            expect(result).toEqual(mockResult.rows[0]);
        });

        test('should get user documents successfully', async () => {
            const mockResult = {
                rows: [{
                    id: 'doc1',
                    title: 'Test Doc',
                    content: JSON.stringify({ id: 'doc1', title: 'Test Doc' }),
                    created_at: '2023-01-01T00:00:00Z',
                    last_modified: '2023-01-01T00:00:00Z'
                }]
            };
            mockPool.query.mockResolvedValue(mockResult);

            const result = await adapter.getUserDocuments(1);

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM documents WHERE user_id'),
                [1]
            );
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('doc1');
        });
    });

    describe('Table Creation', () => {
        beforeEach(async () => {
            mockClient.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
            await adapter.connect();
        });

        test('should create tables successfully', async () => {
            mockPool.query.mockResolvedValue({});

            await adapter.createTables();

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('CREATE TABLE IF NOT EXISTS users')
            );
        });
    });
});