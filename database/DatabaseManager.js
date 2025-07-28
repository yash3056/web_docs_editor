/**
 * Database Manager
 * Handles database connection attempts and fallback logic
 * Provides unified access to either PostgreSQL or SQLite
 */

const ConfigManager = require('./config');
const EnvSetup = require('./env-setup');
const PostgreSQLAdapter = require('./adapters/PostgreSQLAdapter');
const SQLiteAdapter = require('./adapters/SQLiteAdapter');
const { ConnectionError, ErrorHandler } = require('./errors/DatabaseError');

class DatabaseManager {
    constructor(config = {}) {
        this.config = config;
        this.adapter = null;
        this.databaseType = null;
        this.connectionAttempts = [];
        this.initialized = false;
    }

    /**
     * Initialize database connection with fallback logic
     * @returns {Promise<DatabaseAdapter>} Connected database adapter
     */
    async initialize() {
        if (this.initialized && this.adapter && this.adapter.isConnected()) {
            return this.adapter;
        }

        // Initialize environment setup
        EnvSetup.initialize();

        // Get preferred database type
        const preferredType = ConfigManager.getPreferredDatabaseType();
        
        console.log(`🔄 Initializing database connection (preferred: ${preferredType})`);

        // Try PostgreSQL first (unless explicitly set to SQLite)
        if (preferredType !== 'sqlite') {
            try {
                await this.connectToPostgreSQL();
                this.initialized = true;
                return this.adapter;
            } catch (error) {
                this.logConnectionAttempt('postgresql', false, error.message);
                console.warn('⚠️  PostgreSQL connection failed, falling back to SQLite');
                console.warn(`   Reason: ${error.message}`);
            }
        }

        // Fallback to SQLite
        try {
            await this.connectToSQLite();
            this.initialized = true;
            return this.adapter;
        } catch (error) {
            this.logConnectionAttempt('sqlite', false, error.message);
            throw new ConnectionError(
                'Failed to connect to both PostgreSQL and SQLite databases',
                error,
                { attempts: this.connectionAttempts }
            );
        }
    }

    /**
     * Attempt to connect to PostgreSQL
     * @private
     */
    async connectToPostgreSQL() {
        const config = ConfigManager.getPostgreSQLConfig();
        const validation = ConfigManager.validatePostgreSQLConfig(config);

        if (!validation.isValid) {
            throw new ConnectionError(
                `PostgreSQL configuration invalid: ${validation.errors.join(', ')}`,
                null,
                { config: ConfigManager.getConnectionString(config) }
            );
        }

        console.log(`🔗 Attempting PostgreSQL connection to ${ConfigManager.getConnectionString(config)}`);

        this.adapter = new PostgreSQLAdapter(config);
        await this.adapter.connect();
        await this.adapter.createTables();
        
        this.databaseType = 'postgresql';
        this.logConnectionAttempt('postgresql', true, 'Connected successfully');
        
        console.log(`✅ PostgreSQL connection established`);
        console.log(`   Database: ${config.database}`);
        console.log(`   Host: ${config.host}:${config.port}`);
        console.log(`   Pool: ${config.min}-${config.max} connections`);
    }

    /**
     * Attempt to connect to SQLite
     * @private
     */
    async connectToSQLite() {
        const config = ConfigManager.getSQLiteConfig();
        
        console.log('🔗 Attempting SQLite connection with encryption');

        this.adapter = new SQLiteAdapter(config);
        await this.adapter.connect();
        await this.adapter.createTables();
        
        this.databaseType = 'sqlite';
        this.logConnectionAttempt('sqlite', true, 'Connected successfully with encryption');
        
        console.log('✅ SQLite connection established with keytar encryption');
    }

    /**
     * Log connection attempt for debugging and monitoring
     * @private
     */
    logConnectionAttempt(type, success, message) {
        const attempt = {
            type,
            success,
            message,
            timestamp: new Date().toISOString()
        };
        
        this.connectionAttempts.push(attempt);
        
        // Log to console in development
        if (process.env.NODE_ENV === 'development' || process.env.DB_DEBUG === 'true') {
            const status = success ? '✅' : '❌';
            console.log(`[DB] ${status} ${type.toUpperCase()}: ${message}`);
        }
    }

    /**
     * Get the active database adapter
     * @returns {DatabaseAdapter} Active database adapter
     * @throws {Error} If not initialized
     */
    getAdapter() {
        if (!this.adapter) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.adapter;
    }

    /**
     * Get the current database type
     * @returns {string} 'postgresql' or 'sqlite'
     */
    getDatabaseType() {
        return this.databaseType;
    }

    /**
     * Check if using PostgreSQL
     * @returns {boolean} True if using PostgreSQL
     */
    isPostgreSQL() {
        return this.databaseType === 'postgresql';
    }

    /**
     * Check if using SQLite
     * @returns {boolean} True if using SQLite
     */
    isSQLite() {
        return this.databaseType === 'sqlite';
    }

    /**
     * Check if database is connected
     * @returns {boolean} True if connected
     */
    isConnected() {
        return this.adapter && this.adapter.isConnected();
    }

    /**
     * Disconnect from database
     */
    async disconnect() {
        if (this.adapter) {
            try {
                await this.adapter.disconnect();
                console.log(`🔌 Disconnected from ${this.databaseType} database`);
            } catch (error) {
                console.error(`Error disconnecting from ${this.databaseType}:`, error.message);
            } finally {
                this.adapter = null;
                this.databaseType = null;
                this.initialized = false;
            }
        }
    }

    /**
     * Reconnect to database (useful for connection recovery)
     */
    async reconnect() {
        console.log('🔄 Reconnecting to database...');
        
        if (this.adapter) {
            try {
                await this.adapter.disconnect();
            } catch (error) {
                console.warn('Error during disconnect before reconnect:', error.message);
            }
        }

        this.adapter = null;
        this.databaseType = null;
        this.initialized = false;
        this.connectionAttempts = [];

        return await this.initialize();
    }

    /**
     * Get connection status and statistics
     * @returns {Object} Connection status information
     */
    getConnectionStatus() {
        return {
            connected: this.isConnected(),
            databaseType: this.databaseType,
            initialized: this.initialized,
            attempts: this.connectionAttempts,
            adapter: this.adapter ? {
                type: this.adapter.getType(),
                connected: this.adapter.isConnected()
            } : null
        };
    }

    /**
     * Test database connection
     * @returns {Promise<Object>} Test results
     */
    async testConnection() {
        if (!this.adapter) {
            throw new Error('Database not initialized');
        }

        const startTime = Date.now();
        
        try {
            // Test basic query
            await this.adapter.query('SELECT 1');
            
            const duration = Date.now() - startTime;
            
            return {
                success: true,
                databaseType: this.databaseType,
                duration,
                message: `Connection test successful (${duration}ms)`
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            
            return {
                success: false,
                databaseType: this.databaseType,
                duration,
                error: error.message,
                message: `Connection test failed after ${duration}ms`
            };
        }
    }

    /**
     * Get database configuration (safe for logging)
     * @returns {Object} Safe configuration object
     */
    getConfiguration() {
        const config = {
            databaseType: this.databaseType,
            initialized: this.initialized,
            connected: this.isConnected()
        };

        if (this.databaseType === 'postgresql') {
            const pgConfig = ConfigManager.getPostgreSQLConfig();
            config.postgresql = {
                host: pgConfig.host,
                port: pgConfig.port,
                database: pgConfig.database,
                user: pgConfig.user,
                ssl: pgConfig.ssl,
                poolMin: pgConfig.min,
                poolMax: pgConfig.max,
                connectionString: ConfigManager.getConnectionString(pgConfig)
            };
        } else if (this.databaseType === 'sqlite') {
            config.sqlite = {
                encrypted: this.adapter ? this.adapter.isEncrypted() : false,
                useExistingImplementation: true
            };
        }

        return config;
    }

    /**
     * Validate current configuration
     * @returns {Object} Validation results
     */
    validateConfiguration() {
        const results = {
            isValid: true,
            errors: [],
            warnings: []
        };

        // Validate environment
        const envValidation = EnvSetup.validateEnvironment();
        results.warnings.push(...envValidation.warnings);
        results.errors.push(...envValidation.errors);

        // Validate PostgreSQL config if attempting to use it
        if (ConfigManager.getPreferredDatabaseType() === 'postgresql') {
            const pgConfig = ConfigManager.getPostgreSQLConfig();
            const pgValidation = ConfigManager.validatePostgreSQLConfig(pgConfig);
            
            if (!pgValidation.isValid) {
                results.warnings.push('PostgreSQL configuration invalid, will fall back to SQLite');
                results.warnings.push(...pgValidation.errors);
            }
        }

        results.isValid = results.errors.length === 0;
        
        return results;
    }
}

// Singleton instance for application use
let instance = null;

/**
 * Get singleton DatabaseManager instance
 * @returns {DatabaseManager} Singleton instance
 */
function getInstance() {
    if (!instance) {
        instance = new DatabaseManager();
    }
    return instance;
}

/**
 * Initialize database connection (convenience function)
 * @returns {Promise<DatabaseAdapter>} Connected database adapter
 */
async function initialize() {
    const manager = getInstance();
    return await manager.initialize();
}

/**
 * Get active database adapter (convenience function)
 * @returns {DatabaseAdapter} Active database adapter
 */
function getAdapter() {
    const manager = getInstance();
    return manager.getAdapter();
}

module.exports = {
    DatabaseManager,
    getInstance,
    initialize,
    getAdapter
};