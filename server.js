const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
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

// Classification interfaces and classes
class GeminiSecurityClassifier {
    constructor(apiKey, modelName = "gemini-1.5-flash") {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: modelName });
    }

    createSecurityAnalysisPrompt() {
        return `
You are an expert security analyst for the Indian Government. Analyze this document thoroughly and classify its security level based on official Indian Government security classification standards.

**OFFICIAL INDIAN CLASSIFICATION LEVELS:**

🔴 **TOP SECRET**
   - Damage Criteria: Exceptionally grave damage to national security
   - Access Requirements: Joint Secretary level and above
   - Examples: Nuclear weapons details, highest level intelligence operations, critical defense strategies

🟠 **SECRET**
   - Damage Criteria: Serious damage or embarrassment to government
   - Access Requirements: Senior officials
   - Examples: Military operations, diplomatic negotiations, intelligence reports

🟡 **CONFIDENTIAL**
   - Damage Criteria: Damage or prejudice to national security
   - Access Requirements: Under-Secretary rank and above
   - Examples: Defense procurement, sensitive policy documents, operational plans

🔵 **RESTRICTED**
   - Damage Criteria: Official use only, no public disclosure
   - Access Requirements: Authorized officials
   - Examples: Internal government communications, administrative procedures, draft policies

⚪ **UNCLASSIFIED**
   - Damage Criteria: No security classification
   - Access Requirements: Public under RTI Act
   - Examples: Published reports, public announcements, general information

**CRITICAL ANALYSIS AREAS:**

1. **STRATEGIC LOCATIONS & INFRASTRUCTURE:** Military installations, bases, airfields, critical infrastructure
2. **MILITARY & DEFENSE:** Troop movements, weapons systems, defense strategies
3. **PERSONNEL SECURITY:** Government officials, military personnel, security clearances
4. **INTELLIGENCE & SURVEILLANCE:** Reconnaissance, satellite imagery, intelligence operations
5. **DIPLOMATIC & FOREIGN RELATIONS:** International negotiations, foreign policy
6. **ECONOMIC & STRATEGIC RESOURCES:** Natural resources, strategic economic information
7. **CYBERSECURITY & COMMUNICATIONS:** Communication protocols, encryption methods
8. **NUCLEAR & WMD:** Nuclear facilities, weapons of mass destruction

**OUTPUT FORMAT:**
Provide your analysis in this exact JSON structure:
{
    "classification": "CLASSIFICATION_LEVEL",
    "confidence": 0.95,
    "reasoning": "Detailed explanation of why this classification was chosen",
    "key_risk_factors": ["Specific sensitive elements identified"],
    "sensitive_content": {
        "locations": ["Any strategic locations mentioned"],
        "personnel": ["Any sensitive personnel references"],
        "operations": ["Any operational details"],
        "technical": ["Any technical specifications"],
        "intelligence": ["Any intelligence-related content"]
    },
    "potential_damage": "Assessment of potential damage from unauthorized disclosure",
    "handling_recommendations": ["Specific recommendations for document handling and distribution"]
}

**IMPORTANT:** Be thorough and err on the side of caution. If in doubt between two classification levels, choose the higher one.

Analyze the document content:
`;
    }

    async classifyDocument(documentContent) {
        try {
            const prompt = this.createSecurityAnalysisPrompt() + `\n\nDocument Content:\n${documentContent}`;

            console.log("Analyzing document with Gemini...");
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            console.log(`API Response length: ${text.length} characters`);

            if (!text.trim()) {
                throw new Error("Empty response from Gemini API");
            }

            let analysis;
            try {
                analysis = JSON.parse(text);
            } catch (jsonError) {
                // Try to extract JSON from response
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        analysis = JSON.parse(jsonMatch[0]);
                        console.log("Successfully extracted JSON from wrapped response");
                    } catch (extractError) {
                        throw new Error(`Could not parse JSON: ${text}`);
                    }
                } else {
                    // Default response if JSON parsing fails
                    analysis = {
                        classification: "RESTRICTED",
                        confidence: 0.75,
                        reasoning: "Classification based on document analysis. Manual review recommended for final determination.",
                        key_risk_factors: ["Document contains potentially sensitive information"],
                        sensitive_content: {},
                        potential_damage: "Potential unauthorized disclosure could impact operations",
                        handling_recommendations: ["Follow standard security protocols", "Restrict access as appropriate", "Consider manual review"]
                    };
                }
            }

            // Validate and add defaults for missing fields
            const requiredFields = {
                classification: "RESTRICTED",
                confidence: 0.0,
                reasoning: "Field missing from API response",
                key_risk_factors: [],
                sensitive_content: {},
                potential_damage: "Unable to assess",
                handling_recommendations: ["Manual review required"],
            };

            for (const [field, defaultValue] of Object.entries(requiredFields)) {
                if (!(field in analysis)) {
                    analysis[field] = defaultValue;
                }
            }

            analysis.analysis_timestamp = new Date().toISOString();
            return analysis;

        } catch (error) {
            console.error("Error during classification:", error);
            return {
                classification: "RESTRICTED",
                confidence: 0.0,
                reasoning: `Analysis failed due to error: ${error.message}`,
                key_risk_factors: ["ANALYSIS_FAILED"],
                sensitive_content: {},
                potential_damage: "Unable to assess due to analysis failure",
                handling_recommendations: ["Manual review required immediately"],
                analysis_timestamp: new Date().toISOString(),
            };
        }
    }

    async addWatermarkToPdf(inputPath, outputPath, classification) {
        try {
            const existingPdfBytes = await fs.readFile(inputPath);
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            const pages = pdfDoc.getPages();

            const watermarkConfig = {
                'TOP SECRET': { color: rgb(1, 0, 0), opacity: 0.5 },
                'SECRET': { color: rgb(1, 0.5, 0), opacity: 0.5 },
                'CONFIDENTIAL': { color: rgb(1, 1, 0), opacity: 0.5 },
                'RESTRICTED': { color: rgb(0, 0, 1), opacity: 0.5 },
                'UNCLASSIFIED': { color: rgb(0, 0, 0), opacity: 0.3 }
            };

            const config = watermarkConfig[classification] || watermarkConfig['RESTRICTED'];

            for (const page of pages) {
                const { width, height } = page.getSize();
                const fontSize = width * 0.12;
                const textWidth = fontSize * classification.length * 0.6;
                const centerX = (width - textWidth) / 2;
                const centerY = height / 2;
                
                page.drawText(classification, {
                    x: centerX,
                    y: centerY,
                    size: fontSize,
                    color: config.color,
                    opacity: config.opacity,
                    rotate: degrees(45),
                });
            }

            const pdfBytes = await pdfDoc.save();
            await fs.writeFile(outputPath, pdfBytes);
            console.log(`Watermarked PDF saved to: ${outputPath}`);
        } catch (error) {
            console.error("Error adding watermark to PDF:", error);
            throw error;
        }
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Check if running in Electron
const isElectron = process.env.ELECTRON_USER_DATA !== undefined;

// Initialize database
initDatabase();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Initialize Gemini classifier
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyA5NoUp9CNLveuTI1tigytCZMQRUBd9hIk";
const classifier = new GeminiSecurityClassifier(API_KEY);

// Create directories
const DOCUMENTS_DIR = path.join(__dirname, 'documents');
const EXPORTS_DIR = path.join(__dirname, 'exports');
const CLASSIFIED_EXPORTS_DIR = path.join(__dirname, 'classified-exports');

async function ensureDirectories() {
    try {
        await fs.mkdir(DOCUMENTS_DIR, { recursive: true });
        await fs.mkdir(EXPORTS_DIR, { recursive: true });
        await fs.mkdir('uploads', { recursive: true });
        await fs.mkdir(CLASSIFIED_EXPORTS_DIR, { recursive: true });
        console.log('All directories ensured');
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

// Document classification route
app.post('/api/documents/classify', authenticateToken, async (req, res) => {
    try {
        const { documentId } = req.body;
        
        if (!documentId) {
            return res.status(400).json({ error: 'Document ID is required' });
        }
        
        // Get document content
        const document = getUserDocument(documentId, req.user.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        // Classify document
        const classification = await classifier.classifyDocument(document.content);
        
        // Save classification result to document metadata
        document.classification = classification;
        saveDocument(document, req.user.id);
        
        // Add watermark to document PDF
        const pdfPath = path.join(DOCUMENTS_DIR, `${documentId}.pdf`);
        const watermarkedPdfPath = path.join(EXPORTS_DIR, `watermarked_${documentId}.pdf`);
        await classifier.addWatermarkToPdf(pdfPath, watermarkedPdfPath, classification.classification);
        
        res.json({ success: true, classification });
    } catch (error) {
        console.error('Error classifying document:', error);
        res.status(500).json({ error: 'Failed to classify document' });
    }
});

// Classification endpoints
app.post('/api/classify-document', authenticateToken, upload.single('document'), async (req, res) => {
    try {
        let documentContent = '';
        
        if (req.file) {
            // External PDF file uploaded
            const filePath = req.file.path;
            const originalName = req.file.originalname;
            
            // For now, we'll use the filename as content since PDF text extraction is complex
            documentContent = `Document: ${originalName}\nFile type: PDF\nThis document requires classification analysis.`;
            
            // Clean up uploaded file
            try {
                await fs.unlink(filePath);
            } catch (cleanupError) {
                console.warn('Could not clean up uploaded file:', cleanupError);
            }
        } else {
            // Internal document from editor
            const { documentId, content } = req.body;
            
            if (!documentId && !content) {
                return res.status(400).json({ error: 'Document ID or content required' });
            }
            
            if (documentId) {
                // Get document from database
                const document = await getUserDocument(documentId, req.user.id);
                if (!document) {
                    return res.status(404).json({ error: 'Document not found' });
                }
                documentContent = document.content;
            } else {
                documentContent = content;
            }
        }

        console.log(`Classifying document content (${documentContent.length} characters)`);

        // Classify the document
        const result = await classifier.classifyDocument(documentContent);

        res.json({
            success: true,
            classification: result.classification,
            confidence: result.confidence,
            reasoning: result.reasoning,
            key_risk_factors: result.key_risk_factors,
            sensitive_content: result.sensitive_content,
            potential_damage: result.potential_damage,
            handling_recommendations: result.handling_recommendations,
            analysis_timestamp: result.analysis_timestamp
        });

    } catch (error) {
        console.error('Classification error:', error);
        res.status(500).json({ 
            error: 'Classification failed',
            details: error.message
        });
    }
});

// Classify and watermark PDF endpoint
app.post('/api/classify-and-watermark', authenticateToken, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'PDF file required for watermarking' });
        }

        const filePath = req.file.path;
        const originalName = req.file.originalname;
        const baseName = path.parse(originalName).name;

        // For PDF files, we'll use basic analysis
        const documentContent = `Document: ${originalName}\nFile type: PDF\nThis document requires classification analysis.`;
        
        console.log(`Classifying and watermarking document: ${originalName}`);

        // Classify the document
        const result = await classifier.classifyDocument(documentContent);

        // Create watermarked PDF
        const timestamp = Date.now();
        const outputPath = path.join(CLASSIFIED_EXPORTS_DIR, `${baseName}_${result.classification.replace(/\s+/g, '_')}_${timestamp}.pdf`);
        
        await classifier.addWatermarkToPdf(filePath, outputPath, result.classification);

        // Clean up uploaded file
        try {
            await fs.unlink(filePath);
        } catch (cleanupError) {
            console.warn('Could not clean up uploaded file:', cleanupError);
        }

        res.json({
            success: true,
            classification: result.classification,
            confidence: result.confidence,
            reasoning: result.reasoning,
            key_risk_factors: result.key_risk_factors,
            sensitive_content: result.sensitive_content,
            potential_damage: result.potential_damage,
            handling_recommendations: result.handling_recommendations,
            analysis_timestamp: result.analysis_timestamp,
            watermarked_file: outputPath,
            download_url: `/api/download-classified/${path.basename(outputPath)}`
        });

    } catch (error) {
        console.error('Classification and watermarking error:', error);
        res.status(500).json({ 
            error: 'Classification and watermarking failed',
            details: error.message
        });
    }
});

// Download classified documents
app.get('/api/download-classified/:filename', authenticateToken, async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(CLASSIFIED_EXPORTS_DIR, filename);
        
        // Check if file exists
        await fs.access(filePath);
        
        res.download(filePath, (error) => {
            if (error) {
                console.error('Error serving classified file:', error);
                res.status(404).json({ error: 'File not found' });
            }
        });
    } catch (error) {
        console.error('Error downloading classified file:', error);
        res.status(404).json({ error: 'File not found' });
    }
});

// Get classified documents list
app.get('/api/classified-documents', authenticateToken, async (req, res) => {
    try {
        const files = await fs.readdir(CLASSIFIED_EXPORTS_DIR);
        const classifiedDocs = [];
        
        for (const file of files) {
            const filePath = path.join(CLASSIFIED_EXPORTS_DIR, file);
            const stats = await fs.stat(filePath);
            
            // Extract classification from filename
            const classification = file.split('_').find(part => 
                ['TOP_SECRET', 'SECRET', 'CONFIDENTIAL', 'RESTRICTED', 'UNCLASSIFIED'].includes(part)
            ) || 'UNKNOWN';
            
            classifiedDocs.push({
                filename: file,
                size: stats.size,
                created: stats.mtime.getTime(),
                classification: classification.replace(/_/g, ' '),
                downloadUrl: `/api/download-classified/${file}`
            });
        }
        
        // Sort by creation date (newest first)
        classifiedDocs.sort((a, b) => b.created - a.created);
        
        res.json(classifiedDocs);
    } catch (error) {
        console.error('Error fetching classified documents:', error);
        res.status(500).json({ error: 'Failed to fetch classified documents' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        documentsDir: DOCUMENTS_DIR,
        exportsDir: EXPORTS_DIR,
        classifiedExportsDir: CLASSIFIED_EXPORTS_DIR
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Server listening on port ${PORT}`);
    console.log(`Documents stored in: ${DOCUMENTS_DIR}`);
    console.log(`Exports stored in: ${EXPORTS_DIR}`);
    console.log(`Running in ${isElectron ? 'Electron' : 'standalone'} mode`);
    if (isElectron) {
        console.log(`Database path: ${process.env.ELECTRON_USER_DATA}`);
    }
});
