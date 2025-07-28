/**
 * Test Server Setup
 * Creates a server instance specifically for testing with proper database initialization
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'sqlite'; // Force SQLite for tests

const express = require('express');
const cors = require('cors');
const { initialize: initializeDatabase } = require('../database/DatabaseManager');

// Import routes (we'll need to extract these from server.js)
const { generateToken, authenticateToken } = require('../auth/auth');

let app;
let dbInitialized = false;

async function createTestApp() {
    if (app && dbInitialized) {
        return app;
    }

    app = express();

    // Initialize database first
    try {
        await initializeDatabase();
        dbInitialized = true;
        console.log('Test database initialized successfully');
    } catch (error) {
        console.error('Failed to initialize test database:', error);
        throw error;
    }

    // Middleware
    app.use(cors());
    app.use(express.json({ limit: '50mb' }));

    // Import and add routes after database is initialized
    const { getAdapter } = require('../database/DatabaseManager');

    // Authentication routes
    app.post('/api/register', async (req, res) => {
        try {
            const { email, username, password } = req.body;

            if (!email || !username || !password) {
                return res.status(400).json({ error: 'Email, username, and password are required' });
            }

            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters' });
            }

            const adapter = getAdapter();
            const user = await adapter.createUser(email, username, password);
            const token = generateToken(user);

            res.json({
                success: true,
                user: { id: user.id, email: user.email, username: user.username },
                token
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(400).json({ error: error.message });
        }
    });

    app.post('/api/login', async (req, res) => {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required' });
            }

            const adapter = getAdapter();
            const user = await adapter.validateUser(email, password);
            if (!user) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const token = generateToken(user);

            res.json({
                success: true,
                user: { id: user.id, email: user.email, username: user.username },
                token
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Login failed' });
        }
    });

    // Protected document routes
    app.get('/api/documents', authenticateToken, async (req, res) => {
        try {
            const adapter = getAdapter();
            const documents = await adapter.getUserDocuments(req.user.id);
            res.json(documents);
        } catch (error) {
            console.error('Error fetching documents:', error);
            res.status(500).json({ error: 'Failed to fetch documents' });
        }
    });

    return app;
}

module.exports = createTestApp;