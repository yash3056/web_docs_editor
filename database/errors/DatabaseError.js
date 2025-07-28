/**
 * Database Error Classes
 * Provides specific error types for different database operations
 */

class DatabaseError extends Error {
    constructor(message, originalError = null, context = {}) {
        super(message);
        this.name = 'DatabaseError';
        this.originalError = originalError;
        this.context = context;
        this.timestamp = new Date().toISOString();
        
        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DatabaseError);
        }
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            context: this.context,
            timestamp: this.timestamp,
            originalError: this.originalError ? {
                name: this.originalError.name,
                message: this.originalError.message
            } : null
        };
    }
}

class ConnectionError extends DatabaseError {
    constructor(message, originalError = null, context = {}) {
        super(message, originalError, context);
        this.name = 'ConnectionError';
    }
}

class QueryError extends DatabaseError {
    constructor(message, originalError = null, context = {}) {
        super(message, originalError, context);
        this.name = 'QueryError';
    }
}

class TransactionError extends DatabaseError {
    constructor(message, originalError = null, context = {}) {
        super(message, originalError, context);
        this.name = 'TransactionError';
    }
}

class ValidationError extends DatabaseError {
    constructor(message, originalError = null, context = {}) {
        super(message, originalError, context);
        this.name = 'ValidationError';
    }
}

class MigrationError extends DatabaseError {
    constructor(message, originalError = null, context = {}) {
        super(message, originalError, context);
        this.name = 'MigrationError';
    }
}

/**
 * Error Handler Utility
 */
class ErrorHandler {
    /**
     * Create appropriate error type based on original error
     * @param {Error} originalError - Original error from database
     * @param {string} operation - Operation that failed
     * @param {Object} context - Additional context
     * @returns {DatabaseError} Appropriate error type
     */
    static createError(originalError, operation, context = {}) {
        const message = `${operation} failed: ${originalError.message}`;
        const errorContext = { operation, ...context };

        // PostgreSQL specific error codes
        if (originalError.code) {
            switch (originalError.code) {
                case 'ECONNREFUSED':
                case 'ENOTFOUND':
                case 'ETIMEDOUT':
                case 'ECONNRESET':
                    return new ConnectionError(message, originalError, errorContext);
                
                case '23505': // unique_violation
                case '23503': // foreign_key_violation
                case '23502': // not_null_violation
                case '23514': // check_violation
                    return new ValidationError(message, originalError, errorContext);
                
                case '25P02': // in_failed_sql_transaction
                case '40001': // serialization_failure
                case '40P01': // deadlock_detected
                    return new TransactionError(message, originalError, errorContext);
                
                default:
                    return new QueryError(message, originalError, errorContext);
            }
        }

        // SQLite specific error patterns
        if (originalError.message) {
            const msg = originalError.message.toLowerCase();
            
            if (msg.includes('unique constraint') || msg.includes('foreign key constraint')) {
                return new ValidationError(message, originalError, errorContext);
            }
            
            if (msg.includes('database is locked') || msg.includes('busy')) {
                return new TransactionError(message, originalError, errorContext);
            }
            
            if (msg.includes('no such table') || msg.includes('syntax error')) {
                return new QueryError(message, originalError, errorContext);
            }
        }

        // Default to generic database error
        return new DatabaseError(message, originalError, errorContext);
    }

    /**
     * Log error with appropriate level
     * @param {DatabaseError} error - Error to log
     */
    static logError(error) {
        const logData = {
            error: error.name,
            message: error.message,
            context: error.context,
            timestamp: error.timestamp
        };

        if (error instanceof ConnectionError) {
            console.warn('Database connection error:', logData);
        } else if (error instanceof ValidationError) {
            console.info('Database validation error:', logData);
        } else {
            console.error('Database error:', logData);
        }

        // Log original error in development
        if (process.env.NODE_ENV === 'development' && error.originalError) {
            console.error('Original error:', error.originalError);
        }
    }

    /**
     * Check if error is retryable
     * @param {Error} error - Error to check
     * @returns {boolean} True if error might be resolved by retry
     */
    static isRetryable(error) {
        if (error instanceof ConnectionError) {
            return true;
        }

        if (error instanceof TransactionError) {
            // Some transaction errors are retryable
            const retryableCodes = ['40001', '40P01']; // serialization_failure, deadlock_detected
            return error.originalError && retryableCodes.includes(error.originalError.code);
        }

        return false;
    }
}

module.exports = {
    DatabaseError,
    ConnectionError,
    QueryError,
    TransactionError,
    ValidationError,
    MigrationError,
    ErrorHandler
};