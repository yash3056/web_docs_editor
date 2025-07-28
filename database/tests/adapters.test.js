/**
 * Database Adapter Tests
 * Tests for the database adapter interface and base functionality
 */

const DatabaseAdapter = require('../adapters/DatabaseAdapter');
const BaseAdapter = require('../adapters/BaseAdapter');
const { DatabaseError, ConnectionError, ValidationError, ErrorHandler } = require('../errors/DatabaseError');

describe('DatabaseAdapter Interface', () => {
    let adapter;

    beforeEach(() => {
        adapter = new DatabaseAdapter({});
    });

    test('should throw error for unimplemented connect method', async () => {
        await expect(adapter.connect()).rejects.toThrow('connect() method must be implemented by subclass');
    });

    test('should throw error for unimplemented disconnect method', async () => {
        await expect(adapter.disconnect()).rejects.toThrow('disconnect() method must be implemented by subclass');
    });

    test('should throw error for unimplemented query method', async () => {
        await expect(adapter.query('SELECT 1')).rejects.toThrow('query() method must be implemented by subclass');
    });

    test('should return false for isConnected by default', () => {
        expect(adapter.isConnected()).toBe(false);
    });

    test('should return unknown for getType by default', () => {
        expect(adapter.getType()).toBe('unknown');
    });

    test('should throw error for unimplemented user operations', async () => {
        await expect(adapter.createUser('test@test.com', 'test', 'password')).rejects.toThrow();
        await expect(adapter.validateUser('test@test.com', 'password')).rejects.toThrow();
        await expect(adapter.getUserById(1)).rejects.toThrow();
    });

    test('should throw error for unimplemented document operations', async () => {
        await expect(adapter.saveDocument({}, 1)).rejects.toThrow();
        await expect(adapter.getUserDocuments(1)).rejects.toThrow();
        await expect(adapter.getUserDocument('doc1', 1)).rejects.toThrow();
        await expect(adapter.deleteUserDocument('doc1', 1)).rejects.toThrow();
    });
});

describe('BaseAdapter', () => {
    let adapter;

    beforeEach(() => {
        adapter = new BaseAdapter({});
    });

    test('should initialize with default values', () => {
        expect(adapter.lastInsertId).toBe(null);
        expect(adapter.changes).toBe(0);
        expect(adapter.connectionRetries).toBe(0);
        expect(adapter.maxRetries).toBe(3);
        expect(adapter.retryDelay).toBe(1000);
    });

    test('should return lastInsertId', () => {
        adapter.lastInsertId = 123;
        expect(adapter.getLastInsertId()).toBe(123);
    });

    test('should return changes count', () => {
        adapter.changes = 5;
        expect(adapter.getChanges()).toBe(5);
    });

    test('should validate required parameters', () => {
        const params = { name: 'test', age: 25 };
        
        // Should not throw for valid params
        expect(() => adapter.validateParams(params, ['name', 'age'])).not.toThrow();
        
        // Should throw for missing params
        expect(() => adapter.validateParams(params, ['name', 'email'])).toThrow('Missing required parameters: email');
    });

    test('should sanitize long parameters for logging', () => {
        const longString = 'a'.repeat(150);
        const params = ['short', longString, 123];
        
        const sanitized = adapter.sanitizeParamsForLog(params);
        
        expect(sanitized[0]).toBe('short');
        expect(sanitized[1]).toMatch(/^a{100}\.\.\..*$/);
        expect(sanitized[2]).toBe(123);
    });

    test('should handle errors with context', () => {
        const originalError = new Error('Original error message');
        const handledError = adapter.handleError(originalError, 'test operation', 'SELECT * FROM test');
        
        expect(handledError.message).toContain('unknown test operation failed');
        expect(handledError.originalError).toBe(originalError);
        expect(handledError.operation).toBe('test operation');
        expect(handledError.sql).toBe('SELECT * FROM test');
    });

    test('should sleep for specified duration', async () => {
        const start = Date.now();
        await adapter.sleep(100);
        const duration = Date.now() - start;
        
        expect(duration).toBeGreaterThanOrEqual(90); // Allow some variance
        expect(duration).toBeLessThan(150);
    });
});

describe('ErrorHandler', () => {
    test('should create ConnectionError for connection issues', () => {
        const originalError = new Error('Connection refused');
        originalError.code = 'ECONNREFUSED';
        
        const error = ErrorHandler.createError(originalError, 'connect');
        
        expect(error).toBeInstanceOf(ConnectionError);
        expect(error.message).toContain('connect failed');
    });

    test('should create ValidationError for constraint violations', () => {
        const originalError = new Error('Unique constraint violation');
        originalError.code = '23505';
        
        const error = ErrorHandler.createError(originalError, 'insert');
        
        expect(error).toBeInstanceOf(ValidationError);
    });

    test('should identify retryable errors', () => {
        const connectionError = new ConnectionError('Connection failed');
        const validationError = new ValidationError('Constraint violation');
        
        expect(ErrorHandler.isRetryable(connectionError)).toBe(true);
        expect(ErrorHandler.isRetryable(validationError)).toBe(false);
    });

    test('should create error with context', () => {
        const originalError = new Error('Test error');
        const context = { table: 'users', operation: 'insert' };
        
        const error = ErrorHandler.createError(originalError, 'test', context);
        
        expect(error.context.table).toBe('users');
        expect(error.context.operation).toBe('insert');
    });
});

describe('DatabaseError', () => {
    test('should create error with timestamp', () => {
        const error = new DatabaseError('Test error');
        
        expect(error.name).toBe('DatabaseError');
        expect(error.message).toBe('Test error');
        expect(error.timestamp).toBeDefined();
        expect(new Date(error.timestamp)).toBeInstanceOf(Date);
    });

    test('should serialize to JSON properly', () => {
        const originalError = new Error('Original');
        const context = { test: 'value' };
        const error = new DatabaseError('Test error', originalError, context);
        
        const json = error.toJSON();
        
        expect(json.name).toBe('DatabaseError');
        expect(json.message).toBe('Test error');
        expect(json.context.test).toBe('value');
        expect(json.originalError.message).toBe('Original');
    });
});