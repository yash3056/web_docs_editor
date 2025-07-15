// Standalone document storage system using localStorage
class StandaloneDocumentStorage {
    constructor() {
        this.storageKey = 'standalone_documents';
        this.versionsKey = 'standalone_document_versions';
    }

    // Get all documents for current user
    getDocuments() {
        const currentUser = standaloneAuth.getCurrentUser();
        if (!currentUser) return [];

        const allDocuments = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
        return allDocuments[currentUser.id] || [];
    }

    // Get a specific document
    getDocument(documentId) {
        const documents = this.getDocuments();
        return documents.find(doc => doc.id === documentId);
    }

    // Save a document
    saveDocument(document) {
        const currentUser = standaloneAuth.getCurrentUser();
        if (!currentUser) throw new Error('User not authenticated');

        const allDocuments = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
        const userDocuments = allDocuments[currentUser.id] || [];
        
        // Check if document exists
        const existingIndex = userDocuments.findIndex(doc => doc.id === document.id);
        
        if (existingIndex !== -1) {
            // Update existing document
            userDocuments[existingIndex] = { ...document, lastModified: Date.now() };
        } else {
            // Add new document
            userDocuments.push({ ...document, createdAt: Date.now(), lastModified: Date.now() });
        }

        allDocuments[currentUser.id] = userDocuments;
        localStorage.setItem(this.storageKey, JSON.stringify(allDocuments));
        
        return document;
    }

    // Delete a document
    deleteDocument(documentId) {
        const currentUser = standaloneAuth.getCurrentUser();
        if (!currentUser) throw new Error('User not authenticated');

        const allDocuments = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
        const userDocuments = allDocuments[currentUser.id] || [];
        
        const filteredDocuments = userDocuments.filter(doc => doc.id !== documentId);
        allDocuments[currentUser.id] = filteredDocuments;
        localStorage.setItem(this.storageKey, JSON.stringify(allDocuments));
        
        return true;
    }

    // Save document version (for version control)
    saveDocumentVersion(document, commitMessage) {
        const currentUser = standaloneAuth.getCurrentUser();
        if (!currentUser) throw new Error('User not authenticated');

        const allVersions = JSON.parse(localStorage.getItem(this.versionsKey) || '{}');
        const userVersions = allVersions[currentUser.id] || {};
        const documentVersions = userVersions[document.id] || [];

        const version = {
            id: Date.now(),
            documentId: document.id,
            content: document.content,
            title: document.title,
            timestamp: Date.now(),
            commitMessage: commitMessage || 'Document updated',
            userId: currentUser.id
        };

        documentVersions.push(version);
        userVersions[document.id] = documentVersions;
        allVersions[currentUser.id] = userVersions;
        localStorage.setItem(this.versionsKey, JSON.stringify(allVersions));

        // Also save the current document
        this.saveDocument(document);
        
        return version;
    }

    // Get document version history
    getDocumentVersions(documentId) {
        const currentUser = standaloneAuth.getCurrentUser();
        if (!currentUser) return [];

        const allVersions = JSON.parse(localStorage.getItem(this.versionsKey) || '{}');
        const userVersions = allVersions[currentUser.id] || {};
        return userVersions[documentId] || [];
    }

    // Generate document ID
    generateDocumentId() {
        return 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Get storage statistics
    getStorageStats() {
        const documents = this.getDocuments();
        const versions = this.getAllVersions();
        
        return {
            documentCount: documents.length,
            versionCount: versions.length,
            totalSize: this.calculateStorageSize()
        };
    }

    getAllVersions() {
        const currentUser = standaloneAuth.getCurrentUser();
        if (!currentUser) return [];

        const allVersions = JSON.parse(localStorage.getItem(this.versionsKey) || '{}');
        const userVersions = allVersions[currentUser.id] || {};
        
        let allUserVersions = [];
        Object.values(userVersions).forEach(docVersions => {
            allUserVersions = allUserVersions.concat(docVersions);
        });
        
        return allUserVersions;
    }

    calculateStorageSize() {
        const documents = JSON.stringify(this.getDocuments());
        const versions = JSON.stringify(this.getAllVersions());
        return documents.length + versions.length;
    }
}

// Create global document storage instance
const standaloneDocStorage = new StandaloneDocumentStorage();