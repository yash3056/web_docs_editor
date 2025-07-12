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

    // VERSION CONTROL METHODS

    async saveDocumentWithVersion(document, commitMessage = 'Document updated') {
        try {
            const response = await fetch(`${this.baseURL}/api/documents/${document.id}/versions`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ document, commitMessage })
            });
            
            if (await this.handleAuthError(response)) return null;
            if (!response.ok) throw new Error('Failed to save document version');
            
            return await response.json();
        } catch (error) {
            console.error('Error saving document version:', error);
            return null;
        }
    }

    async getDocumentVersionHistory(documentId) {
        try {
            const response = await fetch(`${this.baseURL}/api/documents/${documentId}/versions`, {
                headers: this.getAuthHeaders()
            });
            
            if (await this.handleAuthError(response)) return [];
            if (!response.ok) throw new Error('Failed to fetch version history');
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching version history:', error);
            return [];
        }
    }

    async restoreDocumentVersion(documentId, versionId) {
        try {
            const response = await fetch(`${this.baseURL}/api/documents/${documentId}/versions/${versionId}/restore`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });
            
            if (await this.handleAuthError(response)) return null;
            if (!response.ok) throw new Error('Failed to restore document version');
            
            return await response.json();
        } catch (error) {
            console.error('Error restoring document version:', error);
            return null;
        }
    }

    async compareDocumentVersions(documentId, versionId1, versionId2) {
        try {
            const response = await fetch(`${this.baseURL}/api/documents/${documentId}/versions/${versionId1}/compare/${versionId2}`, {
                headers: this.getAuthHeaders()
            });
            
            if (await this.handleAuthError(response)) return null;
            if (!response.ok) throw new Error('Failed to compare document versions');
            
            return await response.json();
        } catch (error) {
            console.error('Error comparing document versions:', error);
            return null;
        }
    }

    async createDocumentBranch(documentId, branchName, baseVersionId = null) {
        try {
            const response = await fetch(`${this.baseURL}/api/documents/${documentId}/branches`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ branchName, baseVersionId })
            });
            
            if (await this.handleAuthError(response)) return null;
            if (!response.ok) throw new Error('Failed to create document branch');
            
            return await response.json();
        } catch (error) {
            console.error('Error creating document branch:', error);
            return null;
        }
    }

    async getDocumentBranches(documentId) {
        try {
            const response = await fetch(`${this.baseURL}/api/documents/${documentId}/branches`, {
                headers: this.getAuthHeaders()
            });
            
            if (await this.handleAuthError(response)) return [];
            if (!response.ok) throw new Error('Failed to fetch document branches');
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching document branches:', error);
            return [];
        }
    }

    async createVersionTag(documentId, versionId, tagName, description = '') {
        try {
            const response = await fetch(`${this.baseURL}/api/documents/${documentId}/versions/${versionId}/tags`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ tagName, description })
            });
            
            if (await this.handleAuthError(response)) return null;
            if (!response.ok) throw new Error('Failed to create version tag');
            
            return await response.json();
        } catch (error) {
            console.error('Error creating version tag:', error);
            return null;
        }
    }

    async getVersionTags(documentId, versionId) {
        try {
            const response = await fetch(`${this.baseURL}/api/documents/${documentId}/versions/${versionId}/tags`, {
                headers: this.getAuthHeaders()
            });
            
            if (await this.handleAuthError(response)) return [];
            if (!response.ok) throw new Error('Failed to fetch version tags');
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching version tags:', error);
            return [];
        }
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
