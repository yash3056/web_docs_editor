/**
 * Database Configuration Manager
 * Handles configuration for both PostgreSQL and SQLite databases
 */

class ConfigManager {
    /**
     * Get PostgreSQL configuration from environment variables
     * @returns {Object} PostgreSQL configuration object
     */
    static getPostgreSQLConfig() {
        // Check if DATABASE_URL is provided (common in Render, Heroku, etc.)
        if (process.env.DATABASE_URL) {
            const url = new URL(process.env.DATABASE_URL);
            return {
                host: url.hostname,
                port: parseInt(url.port) || 5432,
                database: url.pathname.slice(1), // Remove leading slash
                user: url.username,
                password: url.password,
                ssl: process.env.POSTGRES_SSL === 'false' ? false : {
                    rejectUnauthorized: false // Required for Render and most cloud providers
                },
                
                // Connection pool settings
                min: parseInt(process.env.POSTGRES_POOL_MIN) || 2,
                max: parseInt(process.env.POSTGRES_POOL_MAX) || 10,
                idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT) || 30000,
                connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT) || 10000, // Longer for cloud
                
                // Application settings
                application_name: 'WebDocsEditor',
                statement_timeout: parseInt(process.env.POSTGRES_STATEMENT_TIMEOUT) || 30000
            };
        }

        // Fallback to individual environment variables
        return {
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT) || 5432,
            database: process.env.POSTGRES_DB || 'webdocseditor',
            user: process.env.POSTGRES_USER || 'postgres',
            password: process.env.POSTGRES_PASSWORD || '',
            ssl: process.env.POSTGRES_SSL === 'false' ? false : {
                rejectUnauthorized: false // Required for Render and most cloud providers
            },
            
            // Connection pool settings
            min: parseInt(process.env.POSTGRES_POOL_MIN) || 2,
            max: parseInt(process.env.POSTGRES_POOL_MAX) || 10,
            idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT) || 30000,
            connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT) || 10000, // Longer for cloud
            
            // Application settings
            application_name: 'WebDocsEditor',
            statement_timeout: parseInt(process.env.POSTGRES_STATEMENT_TIMEOUT) || 30000
        };
    }

    /**
     * Get SQLite configuration (maintains existing behavior)
     * @returns {Object} SQLite configuration object
     */
    static getSQLiteConfig() {
        return {
            // This will use the existing getDatabasePath() logic
            useExistingImplementation: true,
            enableEncryption: true,
            enableForeignKeys: true
        };
    }

    /**
     * Get preferred database type from environment
     * @returns {string} 'postgresql' or 'sqlite'
     */
    static getPreferredDatabaseType() {
        const dbType = process.env.DB_TYPE?.toLowerCase();
        return dbType === 'sqlite' ? 'sqlite' : 'postgresql';
    }

    /**
     * Validate PostgreSQL configuration
     * @param {Object} config - PostgreSQL configuration object
     * @returns {Object} Validation result with isValid and errors
     */
    static validatePostgreSQLConfig(config) {
        const errors = [];

        if (!config.host) {
            errors.push('PostgreSQL host is required');
        }

        if (!config.database) {
            errors.push('PostgreSQL database name is required');
        }

        if (!config.user) {
            errors.push('PostgreSQL user is required');
        }

        if (config.port && (config.port < 1 || config.port > 65535)) {
            errors.push('PostgreSQL port must be between 1 and 65535');
        }

        if (config.min && config.max && config.min > config.max) {
            errors.push('PostgreSQL pool min cannot be greater than max');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get database configuration based on type
     * @param {string} type - 'postgresql' or 'sqlite'
     * @returns {Object} Database configuration
     */
    static getConfig(type) {
        switch (type) {
            case 'postgresql':
                return this.getPostgreSQLConfig();
            case 'sqlite':
                return this.getSQLiteConfig();
            default:
                throw new Error(`Unsupported database type: ${type}`);
        }
    }

    /**
     * Check if PostgreSQL configuration is provided
     * @returns {boolean} True if basic PostgreSQL config is available
     */
    static hasPostgreSQLConfig() {
        // Check if DATABASE_URL is provided
        if (process.env.DATABASE_URL) {
            try {
                const url = new URL(process.env.DATABASE_URL);
                return !!(url.hostname && url.username && url.pathname);
            } catch (error) {
                console.warn('Invalid DATABASE_URL format:', error.message);
                return false;
            }
        }

        // Check individual environment variables
        return !!(process.env.POSTGRES_HOST || process.env.POSTGRES_USER || process.env.POSTGRES_DB);
    }

    /**
     * Get connection string for PostgreSQL (for logging purposes only)
     * @param {Object} config - PostgreSQL configuration
     * @returns {string} Safe connection string without password
     */
    static getConnectionString(config) {
        return `postgresql://${config.user}@${config.host}:${config.port}/${config.database}`;
    }
}

module.exports = ConfigManager;