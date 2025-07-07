// API client for server communication
class DocumentAPI {
    constructor() {
        this.baseURL = ''; // Empty for same origin, or specify server URL
    }

    async getAllDocuments() {
        try {
            const response = await fetch(`${this.baseURL}/api/documents`);
            if (!response.ok) throw new Error('Failed to fetch documents');
            return await response.json();
        } catch (error) {
            console.error('Error fetching documents:', error);
            // Fallback to localStorage if server is not available
            return this.getLocalDocuments();
        }
    }

    async getDocument(id) {
        try {
            const response = await fetch(`${this.baseURL}/api/documents/${id}`);
            if (!response.ok) throw new Error('Failed to fetch document');
            return await response.json();
        } catch (error) {
            console.error('Error fetching document:', error);
            // Fallback to localStorage
            return this.getLocalDocument(id);
        }
    }

    async saveDocument(document) {
        try {
            const response = await fetch(`${this.baseURL}/api/documents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(document)
            });
            
            if (!response.ok) throw new Error('Failed to save document');
            const result = await response.json();
            
            // Also save to localStorage as backup
            this.saveLocalDocument(document);
            
            return result;
        } catch (error) {
            console.error('Error saving document to server:', error);
            // Fallback to localStorage
            return this.saveLocalDocument(document);
        }
    }

    async deleteDocument(id) {
        try {
            const response = await fetch(`${this.baseURL}/api/documents/${id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Failed to delete document');
            
            // Also remove from localStorage
            this.deleteLocalDocument(id);
            
            return await response.json();
        } catch (error) {
            console.error('Error deleting document from server:', error);
            // Fallback to localStorage
            return this.deleteLocalDocument(id);
        }
    }

    async exportDocument(id, format, content) {
        try {
            const response = await fetch(`${this.baseURL}/api/documents/${id}/export`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ format, content })
            });
            
            if (!response.ok) throw new Error('Failed to export document');
            return await response.json();
        } catch (error) {
            console.error('Error exporting document:', error);
            throw error;
        }
    }

    async getExports() {
        try {
            const response = await fetch(`${this.baseURL}/api/exports`);
            if (!response.ok) throw new Error('Failed to fetch exports');
            return await response.json();
        } catch (error) {
            console.error('Error fetching exports:', error);
            return [];
        }
    }

    // Fallback localStorage methods
    getLocalDocuments() {
        const stored = localStorage.getItem('documents');
        return stored ? JSON.parse(stored) : [];
    }

    getLocalDocument(id) {
        const documents = this.getLocalDocuments();
        return documents.find(doc => doc.id === id);
    }

    saveLocalDocument(document) {
        const documents = this.getLocalDocuments();
        const existingIndex = documents.findIndex(doc => doc.id === document.id);
        
        if (existingIndex !== -1) {
            documents[existingIndex] = document;
        } else {
            documents.push(document);
        }
        
        localStorage.setItem('documents', JSON.stringify(documents));
        return { success: true, document };
    }

    deleteLocalDocument(id) {
        const documents = this.getLocalDocuments();
        const filteredDocuments = documents.filter(doc => doc.id !== id);
        localStorage.setItem('documents', JSON.stringify(filteredDocuments));
        return { success: true };
    }

    // Server health check
    async checkServerHealth() {
        try {
            const response = await fetch(`${this.baseURL}/api/health`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

// Export for use in other files
window.DocumentAPI = DocumentAPI;
