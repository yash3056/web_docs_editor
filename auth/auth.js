const jwt = require('jsonwebtoken');
const { getUserById } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

function generateToken(user) {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email, 
            username: user.username 
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Verify user still exists
    const user = getUserById(decoded.id);
    if (!user) {
        return res.status(403).json({ error: 'User not found' });
    }

    req.user = decoded;
    next();
}

module.exports = {
    generateToken,
    verifyToken,
    authenticateToken
};
