/**
 * Environment Setup Utilities
 * Provides utilities for setting up and validating environment variables
 */

const fs = require('fs');
const path = require('path');

class EnvSetup {
    /**
     * Create a sample .env file with database configuration examples
     * @param {string} filePath - Path where to create the .env file
     */
    static createSampleEnvFile(filePath = '.env.example') {
        const envContent = `# Database Configuration
# Set DB_TYPE to 'postgresql' to use PostgreSQL, or 'sqlite' to force SQLite
DB_TYPE=postgresql

# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=webdocseditor
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password_here
POSTGRES_SSL=prefer

# PostgreSQL Connection Pool Settings
POSTGRES_POOL_MIN=2
POSTGRES_POOL_MAX=10
POSTGRES_IDLE_TIMEOUT=30000
POSTGRES_CONNECTION_TIMEOUT=2000
POSTGRES_STATEMENT_TIMEOUT=30000

# SQLite Configuration (automatically used as fallback)
# SQLite will use existing configuration from database.js
`;

        try {
            fs.writeFileSync(filePath, envContent);
            console.log(`Sample environment file created at: ${filePath}`);
            return true;
        } catch (error) {
            console.error(`Failed to create sample env file: ${error.message}`);
            return false;
        }
    }

    /**
     * Load environment variables from .env file if it exists
     */
    static loadEnvFile() {
        const envPath = path.join(process.cwd(), '.env');
        
        if (fs.existsSync(envPath)) {
            try {
                const envContent = fs.readFileSync(envPath, 'utf8');
                const lines = envContent.split('\n');
                
                lines.forEach(line => {
                    const trimmedLine = line.trim();
                    if (trimmedLine && !trimmedLine.startsWith('#')) {
                        const [key, ...valueParts] = trimmedLine.split('=');
                        if (key && valueParts.length > 0) {
                            const value = valueParts.join('=').trim();
                            // Only set if not already defined
                            if (!process.env[key]) {
                                process.env[key] = value;
                            }
                        }
                    }
                });
                
                console.log('Environment variables loaded from .env file');
                return true;
            } catch (error) {
                console.warn(`Failed to load .env file: ${error.message}`);
                return false;
            }
        }
        
        return false;
    }

    /**
     * Validate that required environment variables are set
     * @returns {Object} Validation result
     */
    static validateEnvironment() {
        const warnings = [];
        const errors = [];

        // Check if any PostgreSQL config is provided
        const hasPostgresConfig = !!(
            process.env.DATABASE_URL ||
            process.env.POSTGRES_USER || 
            process.env.POSTGRES_PASSWORD || 
            process.env.POSTGRES_DB
        );

        if (hasPostgresConfig) {
            // If DATABASE_URL is provided, that's sufficient
            if (process.env.DATABASE_URL) {
                try {
                    const url = new URL(process.env.DATABASE_URL);
                    if (!url.hostname || !url.username || !url.pathname) {
                        errors.push('DATABASE_URL is malformed');
                    }
                } catch (error) {
                    errors.push('DATABASE_URL is invalid: ' + error.message);
                }
            } else {
                // Check individual parameters
                if (!process.env.POSTGRES_USER) {
                    warnings.push('POSTGRES_USER not set, using default: postgres');
                }
                if (!process.env.POSTGRES_DB) {
                    warnings.push('POSTGRES_DB not set, using default: webdocseditor');
                }
                if (!process.env.POSTGRES_PASSWORD) {
                    warnings.push('POSTGRES_PASSWORD not set, connection may fail');
                }
            }
        } else {
            warnings.push('No PostgreSQL configuration found, will attempt with defaults and fall back to SQLite');
        }

        return {
            isValid: errors.length === 0,
            hasWarnings: warnings.length > 0,
            errors,
            warnings
        };
    }

    /**
     * Print environment status to console
     */
    static printEnvironmentStatus() {
        const validation = this.validateEnvironment();
        
        console.log('\n=== Database Environment Status ===');
        
        if (validation.errors.length > 0) {
            console.log('❌ Errors:');
            validation.errors.forEach(error => console.log(`  - ${error}`));
        }
        
        if (validation.warnings.length > 0) {
            console.log('⚠️  Warnings:');
            validation.warnings.forEach(warning => console.log(`  - ${warning}`));
        }
        
        if (validation.isValid && !validation.hasWarnings) {
            console.log('✅ Environment configuration looks good');
        }
        
        console.log('=====================================\n');
    }

    /**
     * Initialize environment setup
     * This should be called early in application startup
     */
    static initialize() {
        // Try to load .env file
        this.loadEnvFile();
        
        // Validate environment
        const validation = this.validateEnvironment();
        
        // Print status in development
        if (process.env.NODE_ENV !== 'production') {
            this.printEnvironmentStatus();
        }
        
        return validation;
    }
}

module.exports = EnvSetup;