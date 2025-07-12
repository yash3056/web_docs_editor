const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { 
    initDatabase, 
    createUser, 
    validateUser, 
    saveDocument,
    saveDocumentWithVersion,
    getUserDocuments, 
    getUserDocument, 
    deleteUserDocument,
    getDocumentVersionHistory,
    restoreDocumentVersion,
    compareDocumentVersions,
    createDocumentBranch,
    getDocumentBranches,
    createVersionTag,
    getVersionTags
} = require('./database');
const { generateToken, authenticateToken } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initDatabase();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// Create documents directory if it doesn't exist
const DOCUMENTS_DIR = path.join(__dirname, 'documents');
const EXPORTS_DIR = path.join(__dirname, 'exports');

async function ensureDirectories() {
    try {
        await fs.mkdir(DOCUMENTS_DIR, { recursive: true });
        await fs.mkdir(EXPORTS_DIR, { recursive: true });
        console.log('Documents and exports directories ensured');
    } catch (error) {
        console.error('Error creating directories:', error);
    }
}

// Initialize directories on startup
ensureDirectories();

// API Routes

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
        
        const user = await createUser(email, username, password);
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
        
        const user = await validateUser(email, password);
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

// Protected document routes (require authentication)

// Get all documents for authenticated user
app.get('/api/documents', authenticateToken, async (req, res) => {
    try {
        const documents = getUserDocuments(req.user.id);
        res.json(documents);
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// Get a specific document for authenticated user
app.get('/api/documents/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const document = getUserDocument(id, req.user.id);
        
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        res.json(document);
    } catch (error) {
        console.error('Error fetching document:', error);
        res.status(500).json({ error: 'Failed to fetch document' });
    }
});

// Save/update a document for authenticated user
app.post('/api/documents', authenticateToken, async (req, res) => {
    try {
        const document = req.body;
        
        // Validate required fields
        if (!document.id || !document.title) {
            return res.status(400).json({ error: 'Document ID and title are required' });
        }
        
        // Set timestamps
        if (!document.createdAt) {
            document.createdAt = Date.now();
        }
        document.lastModified = Date.now();
        
        // Save document to database
        saveDocument(document, req.user.id);
        
        console.log(`Document saved: ${document.title} (${document.id}) for user ${req.user.username}`);
        res.json({ success: true, document });
    } catch (error) {
        console.error('Error saving document:', error);
        res.status(500).json({ error: 'Failed to save document' });
    }
});

// Delete a document for authenticated user
app.delete('/api/documents/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = deleteUserDocument(id, req.user.id);
        
        if (!deleted) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        console.log(`Document deleted: ${id} for user ${req.user.username}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

// VERSION CONTROL ENDPOINTS

// Save document with version control
app.post('/api/documents/:id/versions', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { document, commitMessage } = req.body;
        
        // Validate required fields
        if (!document || !document.title) {
            return res.status(400).json({ error: 'Document data is required' });
        }
        
        // Ensure document ID matches the URL parameter
        document.id = id;
        
        // Set timestamps
        if (!document.createdAt) {
            document.createdAt = Date.now();
        }
        document.lastModified = Date.now();
        
        // Save document with version control
        saveDocumentWithVersion(document, req.user.id, commitMessage || 'Document updated');
        
        console.log(`Document version saved: ${document.title} (${document.id}) for user ${req.user.username}`);
        res.json({ success: true, document });
    } catch (error) {
        console.error('Error saving document version:', error);
        res.status(500).json({ error: 'Failed to save document version' });
    }
});

// Get document version history
app.get('/api/documents/:id/versions', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const versions = getDocumentVersionHistory(id, req.user.id);
        
        if (!versions) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        res.json(versions);
    } catch (error) {
        console.error('Error fetching version history:', error);
        res.status(500).json({ error: 'Failed to fetch version history' });
    }
});

// Restore document to specific version
app.post('/api/documents/:id/versions/:versionId/restore', authenticateToken, async (req, res) => {
    try {
        const { id, versionId } = req.params;
        
        const result = restoreDocumentVersion(id, parseInt(versionId), req.user.id);
        
        console.log(`Document restored: ${id} to version ${versionId} for user ${req.user.username}`);
        res.json({ success: true, result });
    } catch (error) {
        console.error('Error restoring document version:', error);
        res.status(500).json({ error: error.message || 'Failed to restore document version' });
    }
});

// Compare two document versions
app.get('/api/documents/:id/versions/:versionId1/compare/:versionId2', authenticateToken, async (req, res) => {
    try {
        const { id, versionId1, versionId2 } = req.params;
        
        const comparison = compareDocumentVersions(
            id, 
            parseInt(versionId1), 
            parseInt(versionId2), 
            req.user.id
        );
        
        res.json(comparison);
    } catch (error) {
        console.error('Error comparing document versions:', error);
        res.status(500).json({ error: error.message || 'Failed to compare document versions' });
    }
});

// Create document branch
app.post('/api/documents/:id/branches', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { branchName, baseVersionId } = req.body;
        
        if (!branchName) {
            return res.status(400).json({ error: 'Branch name is required' });
        }
        
        const branch = createDocumentBranch(id, branchName, baseVersionId, req.user.id);
        
        console.log(`Document branch created: ${branchName} for document ${id} by user ${req.user.username}`);
        res.json({ success: true, branch });
    } catch (error) {
        console.error('Error creating document branch:', error);
        res.status(500).json({ error: error.message || 'Failed to create document branch' });
    }
});

// Get document branches
app.get('/api/documents/:id/branches', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const branches = getDocumentBranches(id, req.user.id);
        
        if (!branches) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        res.json(branches);
    } catch (error) {
        console.error('Error fetching document branches:', error);
        res.status(500).json({ error: 'Failed to fetch document branches' });
    }
});

// Create version tag
app.post('/api/documents/:id/versions/:versionId/tags', authenticateToken, async (req, res) => {
    try {
        const { versionId } = req.params;
        const { tagName, description } = req.body;
        
        if (!tagName) {
            return res.status(400).json({ error: 'Tag name is required' });
        }
        
        const tag = createVersionTag(parseInt(versionId), tagName, description, req.user.id);
        
        console.log(`Version tag created: ${tagName} for version ${versionId} by user ${req.user.username}`);
        res.json({ success: true, tag });
    } catch (error) {
        console.error('Error creating version tag:', error);
        res.status(500).json({ error: error.message || 'Failed to create version tag' });
    }
});

// Get version tags
app.get('/api/documents/:id/versions/:versionId/tags', authenticateToken, async (req, res) => {
    try {
        const { versionId } = req.params;
        const tags = getVersionTags(parseInt(versionId), req.user.id);
        
        if (!tags) {
            return res.status(404).json({ error: 'Version not found' });
        }
        
        res.json(tags);
    } catch (error) {
        console.error('Error fetching version tags:', error);
        res.status(500).json({ error: 'Failed to fetch version tags' });
    }
});

// Export document as DOCX and save to server (protected route)
app.post('/api/documents/:id/export', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { format, content } = req.body;
        
        if (!format || !content) {
            return res.status(400).json({ error: 'Format and content are required' });
        }
        
        // Get document details from database
        const document = getUserDocument(id, req.user.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        // Save exported file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${document.title}_${timestamp}.${format}`;
        const exportPath = path.join(EXPORTS_DIR, filename);
        
        if (format === 'docx') {
            // For DOCX, we receive blob data
            const buffer = Buffer.from(content, 'base64');
            await fs.writeFile(exportPath, buffer);
        } else {
            // For other formats, save as text
            await fs.writeFile(exportPath, content);
        }
        
        console.log(`Document exported: ${filename}`);
        res.json({ 
            success: true, 
            filename,
            downloadUrl: `/api/exports/${filename}`
        });
    } catch (error) {
        console.error('Error exporting document:', error);
        res.status(500).json({ error: 'Failed to export document' });
    }
});

// Serve exported files
app.get('/api/exports/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(EXPORTS_DIR, filename);
    
    res.download(filePath, (error) => {
        if (error) {
            console.error('Error serving export:', error);
            res.status(404).json({ error: 'Export file not found' });
        }
    });
});

// Get list of exported files (protected route)
app.get('/api/exports', authenticateToken, async (req, res) => {
    try {
        const files = await fs.readdir(EXPORTS_DIR);
        const exports = [];
        
        for (const file of files) {
            const filePath = path.join(EXPORTS_DIR, file);
            const stats = await fs.stat(filePath);
            exports.push({
                filename: file,
                size: stats.size,
                created: stats.mtime.getTime(),
                downloadUrl: `/api/exports/${file}`
            });
        }
        
        // Sort by creation date (newest first)
        exports.sort((a, b) => b.created - a.created);
        
        res.json(exports);
    } catch (error) {
        console.error('Error fetching exports:', error);
        res.status(500).json({ error: 'Failed to fetch exports' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        documentsDir: DOCUMENTS_DIR,
        exportsDir: EXPORTS_DIR
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Documents stored in: ${DOCUMENTS_DIR}`);
    console.log(`Exports stored in: ${EXPORTS_DIR}`);
});
