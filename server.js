const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Get all documents
app.get('/api/documents', async (req, res) => {
    try {
        const files = await fs.readdir(DOCUMENTS_DIR);
        const documents = [];
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(DOCUMENTS_DIR, file);
                const content = await fs.readFile(filePath, 'utf8');
                const document = JSON.parse(content);
                documents.push(document);
            }
        }
        
        // Sort by last modified (newest first)
        documents.sort((a, b) => b.lastModified - a.lastModified);
        
        res.json(documents);
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// Get a specific document
app.get('/api/documents/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const filePath = path.join(DOCUMENTS_DIR, `${id}.json`);
        
        const content = await fs.readFile(filePath, 'utf8');
        const document = JSON.parse(content);
        
        res.json(document);
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Document not found' });
        } else {
            console.error('Error fetching document:', error);
            res.status(500).json({ error: 'Failed to fetch document' });
        }
    }
});

// Save/update a document
app.post('/api/documents', async (req, res) => {
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
        
        // Save document as JSON file
        const filePath = path.join(DOCUMENTS_DIR, `${document.id}.json`);
        await fs.writeFile(filePath, JSON.stringify(document, null, 2));
        
        console.log(`Document saved: ${document.title} (${document.id})`);
        res.json({ success: true, document });
    } catch (error) {
        console.error('Error saving document:', error);
        res.status(500).json({ error: 'Failed to save document' });
    }
});

// Delete a document
app.delete('/api/documents/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const filePath = path.join(DOCUMENTS_DIR, `${id}.json`);
        
        await fs.unlink(filePath);
        
        console.log(`Document deleted: ${id}`);
        res.json({ success: true });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Document not found' });
        } else {
            console.error('Error deleting document:', error);
            res.status(500).json({ error: 'Failed to delete document' });
        }
    }
});

// Export document as DOCX and save to server
app.post('/api/documents/:id/export', async (req, res) => {
    try {
        const { id } = req.params;
        const { format, content } = req.body;
        
        if (!format || !content) {
            return res.status(400).json({ error: 'Format and content are required' });
        }
        
        // Get document details
        const docPath = path.join(DOCUMENTS_DIR, `${id}.json`);
        const docContent = await fs.readFile(docPath, 'utf8');
        const document = JSON.parse(docContent);
        
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

// Get list of exported files
app.get('/api/exports', async (req, res) => {
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
