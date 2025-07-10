// API client for server communication
class DocumentAPI {
    constructor() {
        this.baseURL = ''; // Empty for same origin, or specify server URL
        this.authToken = null;
    }

    setAuthToken(token) {
        this.authToken = token;
    }

    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }
        
        return headers;
    }

    async handleAuthError(response) {
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            window.location.href = '/login.html';
            return true;
        }
        return false;
    }

    async getAllDocuments() {
        try {
            const response = await fetch(`${this.baseURL}/api/documents`, {
                headers: this.getAuthHeaders()
            });
            
            if (await this.handleAuthError(response)) return [];
            if (!response.ok) throw new Error('Failed to fetch documents');
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching documents:', error);
            // No fallback to localStorage for authenticated users
            return [];
        }
    }

    async getDocument(id) {
        try {
            const response = await fetch(`${this.baseURL}/api/documents/${id}`, {
                headers: this.getAuthHeaders()
            });
            
            if (await this.handleAuthError(response)) return null;
            if (!response.ok) throw new Error('Failed to fetch document');
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching document:', error);
            return null;
        }
    }

    async saveDocument(document) {
        try {
            const response = await fetch(`${this.baseURL}/api/documents`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(document)
            });
            
            if (await this.handleAuthError(response)) return null;
            if (!response.ok) throw new Error('Failed to save document');
            
            return await response.json();
        } catch (error) {
            console.error('Error saving document to server:', error);
            return null;
        }
    }

    async deleteDocument(id) {
        try {
            const response = await fetch(`${this.baseURL}/api/documents/${id}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
            
            if (await this.handleAuthError(response)) return false;
            if (!response.ok) throw new Error('Failed to delete document');
            
            return true;
        } catch (error) {
            console.error('Error deleting document:', error);
            return false;
        }
    }

    async exportDocument(id, format, content) {
        try {
            const response = await fetch(`${this.baseURL}/api/documents/${id}/export`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ format, content })
            });
            
            if (await this.handleAuthError(response)) return null;
            if (!response.ok) throw new Error('Failed to export document');
            
            return await response.json();
        } catch (error) {
            console.error('Error exporting document:', error);
            throw error;
        }
    }

    async getExports() {
        try {
            const response = await fetch(`${this.baseURL}/api/exports`, {
                headers: this.getAuthHeaders()
            });
            
            if (await this.handleAuthError(response)) return [];
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
