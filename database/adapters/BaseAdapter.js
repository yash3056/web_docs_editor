/**
 * Base Database Adapter
 * Provides common functionality for all database adapters
 */

const DatabaseAdapter = require('./DatabaseAdapter');

class BaseAdapter extends DatabaseAdapter {
    constructor(config) {
        super(config);
        this.lastInsertId = null;
        this.changes = 0;
        this.connectionRetries = 0;
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
    }

    /**
     * Retry connection with exponential backoff
     * @param {Function} connectFn - Function to attempt connection
     * @returns {Promise<boolean>} Success status
     */
    async retryConnection(connectFn) {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                await connectFn();
                this.connectionRetries = 0;
                return true;
            } catch (error) {
                this.connectionRetries = attempt;
                
                if (attempt === this.maxRetries) {
                    throw error;
                }
                
                const delay = this.retryDelay * Math.pow(2, attempt - 1);
                console.log(`Connection attempt ${attempt} failed, retrying in ${delay}ms...`);
                await this.sleep(delay);
            }
        }
        return false;
    }

    /**
     * Sleep utility for retry delays
     * @param {number} ms - Milliseconds to sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Log database operations
     * @param {string} operation - Operation name
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @param {number} duration - Execution time in ms
     */
    logQuery(operation, sql, params = [], duration = 0) {
        if (process.env.NODE_ENV === 'development' || process.env.DB_DEBUG === 'true') {
            console.log(`[${this.type.toUpperCase()}] ${operation}: ${sql}`);
            if (params.length > 0) {
                console.log(`[${this.type.toUpperCase()}] Params:`, params);
            }
            if (duration > 0) {
                console.log(`[${this.type.toUpperCase()}] Duration: ${duration}ms`);
            }
        }
    }

    /**
     * Handle database errors with context
     * @param {Error} error - Original error
     * @param {string} operation - Operation that failed
     * @param {string} sql - SQL that caused the error
     * @returns {Error} Enhanced error with context
     */
    handleError(error, operation, sql = '') {
        const enhancedError = new Error(`${this.type} ${operation} failed: ${error.message}`);
        enhancedError.originalError = error;
        enhancedError.operation = operation;
        enhancedError.sql = sql;
        enhancedError.adapter = this.type;
        
        console.error(`[${this.type.toUpperCase()}] Error in ${operation}:`, error.message);
        if (sql) {
            console.error(`[${this.type.toUpperCase()}] SQL:`, sql);
        }
        
        return enhancedError;
    }

    /**
     * Validate required parameters
     * @param {Object} params - Parameters to validate
     * @param {Array} required - Required parameter names
     * @throws {Error} If required parameters are missing
     */
    validateParams(params, required) {
        const missing = required.filter(param => params[param] === undefined || params[param] === null);
        if (missing.length > 0) {
            throw new Error(`Missing required parameters: ${missing.join(', ')}`);
        }
    }

    /**
     * Sanitize parameters for logging
     * @param {Array} params - Parameters to sanitize
     * @returns {Array} Sanitized parameters
     */
    sanitizeParamsForLog(params) {
        return params.map(param => {
            if (typeof param === 'string' && param.length > 100) {
                return param.substring(0, 100) + '...[truncated]';
            }
            return param;
        });
    }

    // Default implementations for utility methods
    getLastInsertId() {
        return this.lastInsertId;
    }

    getChanges() {
        return this.changes;
    }

    /**
     * Execute query with timing and logging
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @param {string} operation - Operation name for logging
     * @returns {Promise<any>} Query result
     */
    async executeWithLogging(sql, params = [], operation = 'query') {
        const startTime = Date.now();
        
        try {
            const result = await this.query(sql, params);
            const duration = Date.now() - startTime;
            
            this.logQuery(operation, sql, this.sanitizeParamsForLog(params), duration);
            
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logQuery(`${operation} (FAILED)`, sql, this.sanitizeParamsForLog(params), duration);
            throw this.handleError(error, operation, sql);
        }
    }
}

module.exports = BaseAdapter;