/**
 * Database Manager Tests
 * Tests for database connection management and fallback logic
 */

const { DatabaseManager, getInstance, initialize, getAdapter } = require('../DatabaseManager');
const ConfigManager = require('../config');
const EnvSetup = require('../env-setup');
const { ConnectionError } = require('../errors/DatabaseError');

// Mock dependencies
jest.mock('../config');
jest.mock('../env-setup');
jest.mock('../adapters/PostgreSQLAdapter');
jest.mock('../adapters/SQLiteAdapter');

const PostgreSQLAdapter = require('../adapters/PostgreSQLAdapter');
const SQLiteAdapter = require('../adapters/SQLiteAdapter');

describe('DatabaseManager', () => {
    let manager;
    let mockPostgreSQLAdapter;
    let mockSQLiteAdapter;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Setup mock adapters
        mockPostgreSQLAdapter = {
            connect: jest.fn(),
            disconnect: jest.fn(),
            createTables: jest.fn(),
            isConnected: jest.fn().mockReturnValue(true),
            getType: jest.fn().mockReturnValue('postgresql'),
            query: jest.fn()
        };

        mockSQLiteAdapter = {
            connect: jest.fn(),
            disconnect: jest.fn(),
            createTables: jest.fn(),
            isConnected: jest.fn().mockReturnValue(true),
            getType: jest.fn().mockReturnValue('sqlite'),
            query: jest.fn(),
            isEncrypted: jest.fn().mockReturnValue(true)
        };

        PostgreSQLAdapter.mockImplementation(() => mockPostgreSQLAdapter);
        SQLiteAdapter.mockImplementation(() => mockSQLiteAdapter);

        // Setup config mocks
        ConfigManager.getPreferredDatabaseType.mockReturnValue('postgresql');
        ConfigManager.getPostgreSQLConfig.mockReturnValue({
            host: 'localhost',
            port: 5432,
            database: 'test_db',
            user: 'test_user',
            password: 'test_pass'
        });
        ConfigManager.validatePostgreSQLConfig.mockReturnValue({ isValid: true, errors: [] });
        ConfigManager.getConnectionString.mockReturnValue('postgresql://test_user@localhost:5432/test_db');
        ConfigManager.getSQLiteConfig.mockReturnValue({ useExistingImplementation: true });

        // Setup env mocks
        EnvSetup.initialize.mockReturnValue({ isValid: true, warnings: [], errors: [] });
        EnvSetup.validateEnvironment.mockReturnValue({ isValid: true, warnings: [], errors: [] });

        manager = new DatabaseManager();
    });

    describe('Initialization', () => {
        test('should initialize with PostgreSQL successfully', async () => {
            const adapter = await manager.initialize();

            expect(EnvSetup.initialize).toHaveBeenCalled();
            expect(ConfigManager.getPreferredDatabaseType).toHaveBeenCalled();
            expect(PostgreSQLAdapter).toHaveBeenCalled();
            expect(mockPostgreSQLAdapter.connect).toHaveBeenCalled();
            expect(mockPostgreSQLAdapter.createTables).toHaveBeenCalled();
            expect(adapter).toBe(mockPostgreSQLAdapter);
            expect(manager.getDatabaseType()).toBe('postgresql');
            expect(manager.isPostgreSQL()).toBe(true);
            expect(manager.isSQLite()).toBe(false);
        });

        test('should fallback to SQLite when PostgreSQL fails', async () => {
            const pgError = new Error('Connection refused');
            mockPostgreSQLAdapter.connect.mockRejectedValue(pgError);

            const adapter = await manager.initialize();

            expect(PostgreSQLAdapter).toHaveBeenCalled();
            expect(mockPostgreSQLAdapter.connect).toHaveBeenCalled();
            expect(SQLiteAdapter).toHaveBeenCalled();
            expect(mockSQLiteAdapter.connect).toHaveBeenCalled();
            expect(mockSQLiteAdapter.createTables).toHaveBeenCalled();
            expect(adapter).toBe(mockSQLiteAdapter);
            expect(manager.getDatabaseType()).toBe('sqlite');
            expect(manager.isPostgreSQL()).toBe(false);
            expect(manager.isSQLite()).toBe(true);
        });

        test('should use SQLite directly when preferred type is sqlite', async () => {
            ConfigManager.getPreferredDatabaseType.mockReturnValue('sqlite');

            const adapter = await manager.initialize();

            expect(PostgreSQLAdapter).not.toHaveBeenCalled();
            expect(SQLiteAdapter).toHaveBeenCalled();
            expect(mockSQLiteAdapter.connect).toHaveBeenCalled();
            expect(adapter).toBe(mockSQLiteAdapter);
            expect(manager.getDatabaseType()).toBe('sqlite');
        });

        test('should throw error when both databases fail', async () => {
            const pgError = new Error('PostgreSQL connection failed');
            const sqliteError = new Error('SQLite connection failed');
            
            mockPostgreSQLAdapter.connect.mockRejectedValue(pgError);
            mockSQLiteAdapter.connect.mockRejectedValue(sqliteError);

            await expect(manager.initialize()).rejects.toThrow(ConnectionError);
            expect(manager.getDatabaseType()).toBeNull();
        });

        test('should return existing adapter if already initialized', async () => {
            // First initialization
            await manager.initialize();
            const firstAdapter = manager.getAdapter();

            // Second initialization should return same adapter
            const secondAdapter = await manager.initialize();

            expect(secondAdapter).toBe(firstAdapter);
            expect(PostgreSQLAdapter).toHaveBeenCalledTimes(1);
        });
    });

    describe('Configuration Validation', () => {
        test('should handle invalid PostgreSQL configuration', async () => {
            ConfigManager.validatePostgreSQLConfig.mockReturnValue({
                isValid: false,
                errors: ['Missing password']
            });

            await expect(manager.initialize()).rejects.toThrow(ConnectionError);
        });

        test('should validate configuration correctly', () => {
            const validation = manager.validateConfiguration();

            expect(EnvSetup.validateEnvironment).toHaveBeenCalled();
            expect(validation.isValid).toBe(true);
            expect(Array.isArray(validation.errors)).toBe(true);
            expect(Array.isArray(validation.warnings)).toBe(true);
        });
    });

    describe('Connection Management', () => {
        beforeEach(async () => {
            await manager.initialize();
        });

        test('should disconnect successfully', async () => {
            await manager.disconnect();

            expect(mockPostgreSQLAdapter.disconnect).toHaveBeenCalled();
            expect(manager.getDatabaseType()).toBeNull();
            expect(manager.isConnected()).toBe(false);
        });

        test('should reconnect successfully', async () => {
            await manager.reconnect();

            expect(mockPostgreSQLAdapter.disconnect).toHaveBeenCalled();
            expect(PostgreSQLAdapter).toHaveBeenCalledTimes(2); // Initial + reconnect
        });

        test('should test connection successfully', async () => {
            mockPostgreSQLAdapter.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });

            const result = await manager.testConnection();

            expect(result.success).toBe(true);
            expect(result.databaseType).toBe('postgresql');
            expect(typeof result.duration).toBe('number');
            expect(mockPostgreSQLAdapter.query).toHaveBeenCalledWith('SELECT 1');
        });

        test('should handle connection test failure', async () => {
            const testError = new Error('Query failed');
            mockPostgreSQLAdapter.query.mockRejectedValue(testError);

            const result = await manager.testConnection();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Query failed');
        });
    });

    describe('Status and Information', () => {
        beforeEach(async () => {
            await manager.initialize();
        });

        test('should return connection status', () => {
            const status = manager.getConnectionStatus();

            expect(status.connected).toBe(true);
            expect(status.databaseType).toBe('postgresql');
            expect(status.initialized).toBe(true);
            expect(Array.isArray(status.attempts)).toBe(true);
            expect(status.adapter).toEqual({
                type: 'postgresql',
                connected: true
            });
        });

        test('should return configuration information', () => {
            const config = manager.getConfiguration();

            expect(config.databaseType).toBe('postgresql');
            expect(config.initialized).toBe(true);
            expect(config.connected).toBe(true);
            expect(config.postgresql).toBeDefined();
            expect(config.postgresql.host).toBe('localhost');
            expect(config.postgresql.database).toBe('test_db');
        });

        test('should return SQLite configuration when using SQLite', async () => {
            // Reinitialize with SQLite
            ConfigManager.getPreferredDatabaseType.mockReturnValue('sqlite');
            const sqliteManager = new DatabaseManager();
            await sqliteManager.initialize();

            const config = sqliteManager.getConfiguration();

            expect(config.databaseType).toBe('sqlite');
            expect(config.sqlite).toBeDefined();
            expect(config.sqlite.encrypted).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should throw error when getting adapter before initialization', () => {
            expect(() => manager.getAdapter()).toThrow('Database not initialized');
        });

        test('should throw error when testing connection before initialization', async () => {
            await expect(manager.testConnection()).rejects.toThrow('Database not initialized');
        });

        test('should handle disconnect errors gracefully', async () => {
            await manager.initialize();
            
            const disconnectError = new Error('Disconnect failed');
            mockPostgreSQLAdapter.disconnect.mockRejectedValue(disconnectError);

            // Should not throw, but log error
            await manager.disconnect();

            expect(manager.getDatabaseType()).toBeNull();
        });
    });

    describe('Singleton Functions', () => {
        test('should return same instance from getInstance', () => {
            const instance1 = getInstance();
            const instance2 = getInstance();

            expect(instance1).toBe(instance2);
            expect(instance1).toBeInstanceOf(DatabaseManager);
        });

        test('should initialize via convenience function', async () => {
            const adapter = await initialize();

            expect(adapter).toBe(mockPostgreSQLAdapter);
        });

        test('should get adapter via convenience function', async () => {
            await initialize();
            const adapter = getAdapter();

            expect(adapter).toBe(mockPostgreSQLAdapter);
        });
    });

    describe('Logging and Monitoring', () => {
        test('should log connection attempts', async () => {
            await manager.initialize();

            const status = manager.getConnectionStatus();
            expect(status.attempts.length).toBeGreaterThan(0);
            
            const attempt = status.attempts[0];
            expect(attempt.type).toBe('postgresql');
            expect(attempt.success).toBe(true);
            expect(attempt.message).toBe('Connected successfully');
            expect(attempt.timestamp).toBeDefined();
        });

        test('should log failed attempts during fallback', async () => {
            const pgError = new Error('Connection refused');
            mockPostgreSQLAdapter.connect.mockRejectedValue(pgError);

            await manager.initialize();

            const status = manager.getConnectionStatus();
            expect(status.attempts.length).toBe(2); // PostgreSQL fail + SQLite success
            
            const failedAttempt = status.attempts.find(a => !a.success);
            expect(failedAttempt.type).toBe('postgresql');
            expect(failedAttempt.success).toBe(false);
        });
    });
});