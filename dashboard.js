class AdvancedDocumentDashboard {
    constructor() {
        this.api = new DocumentAPI();
        this.documents = [];
        this.selectedDocuments = new Set();
        this.currentView = 'grid';
        this.currentSort = 'modified';
        this.searchQuery = '';
        this.documentToDelete = null;
        this.isSelectionMode = false;
        this.templates = this.initializeTemplates();
        this.maxDocuments = 20; // Document storage limit
        this.serverAvailable = false;
        this.user = null;
        this.authToken = null;
        
        this.init();
    }

    async init() {
        // Check authentication
        this.authToken = localStorage.getItem('authToken');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        
        if (!this.authToken || !this.user) {
            window.location.href = '/login.html';
            return;
        }
        
        // Set up API authentication
        this.api.setAuthToken(this.authToken);
        
        // Check server availability
        this.serverAvailable = await this.api.checkServerHealth();
        console.log('Server available:', this.serverAvailable);
        
        // Load documents from server
        await this.loadDocuments();
        
        this.bindEvents();
        this.renderDocuments();
        this.updateEmptyState();
        this.updateDocumentCount();
        this.populateRecentActivity();
        this.updateStorageInfo();
        this.updateUserInfo();
    }

    updateUserInfo() {
        // Add user info to header
        const headerControls = document.querySelector('.header-controls');
        if (headerControls && this.user) {
            const userInfo = document.createElement('div');
            userInfo.className = 'user-info';
            userInfo.innerHTML = `
                <span class="username">👤 ${this.user.username}</span>
                <button class="logout-btn" onclick="dashboard.logout()">Logout</button>
            `;
            headerControls.appendChild(userInfo);
        }
    }

    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    }

    initializeTemplates() {
        return {
            blank: {
                name: 'Blank Document',
                content: '',
                description: 'Start with a clean slate'
            },
            report: {
                name: 'Business Report',
                content: `<h1>Business Report</h1>
                         <p><strong>Date:</strong> ${new Date().toDateString()}</p>
                         <h2>Executive Summary</h2>
                         <p>Enter your executive summary here...</p>
                         <h2>Main Content</h2>
                         <p>Enter your main content here...</p>
                         <h2>Conclusion</h2>
                         <p>Enter your conclusion here...</p>`,
                description: 'Professional business report template'
            },
            letter: {
                name: 'Formal Letter',
                content: `<p style="text-align: right;">${new Date().toDateString()}</p>
                         <br>
                         <p>Dear [Recipient],</p>
                         <br>
                         <p>Enter your letter content here...</p>
                         <br>
                         <p>Sincerely,<br>[Your Name]</p>`,
                description: 'Formal business letter template'
            },
            resume: {
                name: 'Professional Resume',
                content: `<div style="text-align: center;">
                         <h1>[Your Name]</h1>
                         <p>[Your Address] | [Phone] | [Email]</p>
                         </div>
                         <br>
                         <h2>Professional Summary</h2>
                         <p>Enter your professional summary here...</p>
                         <h2>Experience</h2>
                         <p>Enter your work experience here...</p>
                         <h2>Education</h2>
                         <p>Enter your education details here...</p>
                         <h2>Skills</h2>
                         <p>Enter your skills here...</p>`,
                description: 'Professional resume template'
            }
        };
    }

    bindEvents() {
        // Search functionality
        const searchInput = document.getElementById('search-input');
        const searchClear = document.getElementById('search-clear');

        searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        searchClear.addEventListener('click', () => this.clearSearch());

        // User menu
        const userBtn = document.getElementById('user-btn');
        const userDropdown = document.getElementById('user-dropdown');

        userBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });

        document.addEventListener('click', () => {
            userDropdown.classList.remove('show');
        });

        // Quick actions
        document.getElementById('new-blank-doc').addEventListener('click', () => this.createDocument('blank'));
        document.getElementById('new-template-doc').addEventListener('click', () => this.showNewDocumentModal());
        document.getElementById('import-doc').addEventListener('click', () => this.showImportModal());
        document.getElementById('classify-document').addEventListener('click', () => this.showClassificationModal());
        
        // Empty state create button
        document.getElementById('create-first-doc').addEventListener('click', () => this.createDocument('blank'));

        // View controls
        document.getElementById('grid-view').addEventListener('click', () => this.setView('grid'));
        document.getElementById('list-view').addEventListener('click', () => this.setView('list'));

        // Sort controls
        document.getElementById('sort-select').addEventListener('change', (e) => this.setSortBy(e.target.value));

        // Template cards
        document.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', () => {
                const template = card.dataset.template;
                this.createDocument(template);
            });
        });

        // See all button
        document.getElementById('see-all-recent').addEventListener('click', () => this.showAllDocuments());

        // Bulk actions
        document.getElementById('select-all').addEventListener('click', () => this.toggleSelectAll());
        document.getElementById('delete-selected').addEventListener('click', () => this.deleteSelectedDocuments());

        // Modal events
        this.setupModalEvents();

        // Context menu
        this.setupContextMenu();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

        // User menu actions
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        document.getElementById('settings-btn').addEventListener('click', () => this.showSettings());
        document.getElementById('help-btn').addEventListener('click', () => this.showHelp());
        
        // Add refresh button functionality if it exists
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshDocuments());
        }
    }

    handleSearch(query) {
        this.searchQuery = query.toLowerCase();
        const searchClear = document.getElementById('search-clear');
        
        if (query) {
            searchClear.style.display = 'block';
        } else {
            searchClear.style.display = 'none';
        }
        
        this.renderDocuments();
    }

    clearSearch() {
        const searchInput = document.getElementById('search-input');
        const searchClear = document.getElementById('search-clear');
        
        searchInput.value = '';
        searchClear.style.display = 'none';
        this.searchQuery = '';
        this.renderDocuments();
    }

    setView(view) {
        this.currentView = view;
        
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${view}-view`).classList.add('active');
        
        const grids = document.querySelectorAll('.documents-grid');
        grids.forEach(grid => {
            if (view === 'list') {
                grid.classList.add('list-view');
            } else {
                grid.classList.remove('list-view');
            }
        });
        
        this.renderDocuments();
    }

    setSortBy(sortBy) {
        this.currentSort = sortBy;
        this.renderDocuments();
    }

    showAllDocuments() {
        document.querySelector('.recent-section').style.display = 'none';
        document.querySelector('.templates-section').style.display = 'none';
        document.getElementById('all-documents-section').style.display = 'block';
        this.renderAllDocuments();
    }

    toggleSelectAll() {
        const selectAllBtn = document.getElementById('select-all');
        const deleteSelectedBtn = document.getElementById('delete-selected');
        
        if (this.isSelectionMode) {
            // Exit selection mode
            this.isSelectionMode = false;
            this.selectedDocuments.clear();
            selectAllBtn.textContent = 'Select All';
            deleteSelectedBtn.style.display = 'none';
            document.querySelectorAll('.document-card').forEach(card => {
                card.classList.remove('selection-mode', 'selected');
            });
        } else {
            // Enter selection mode
            this.isSelectionMode = true;
            selectAllBtn.textContent = 'Deselect All';
            deleteSelectedBtn.style.display = 'block';
            document.querySelectorAll('.document-card').forEach(card => {
                card.classList.add('selection-mode');
                const docId = card.dataset.id;
                this.selectedDocuments.add(docId);
                card.classList.add('selected');
            });
        }
    }

    createDocument(template = 'blank', customTitle = null) {
        // Check document limit before creating
        if (this.documents.length >= this.maxDocuments) {
            this.showToast(`Document limit reached! You can store up to ${this.maxDocuments} documents. Please delete some documents first.`, 'error');
            this.showStorageLimitModal();
            return;
        }

        const templateData = this.templates[template] || this.templates.blank;
        const title = customTitle || templateData.name;
        
        const newDocument = {
            id: 'doc-' + Date.now(),
            title: title,
            content: [templateData.content], // Store as array for consistency
            description: '',
            createdAt: Date.now(),
            lastModified: Date.now(),
            template: template,
            wordCount: this.countWords(templateData.content),
            pageCount: 1
        };

        this.documents.unshift(newDocument);
        this.saveDocuments();
        this.updateDocumentCount();
        this.renderDocuments();
        this.updateEmptyState();
        this.populateRecentActivity();
        this.updateStorageInfo();

        this.showToast(`Document "${title}" created successfully!`, 'success');
        
        // Redirect to editor after a short delay
        setTimeout(() => {
            this.openDocument(newDocument.id);
        }, 500);
    }

    openDocument(documentId) {
        localStorage.setItem('currentDocumentId', documentId);
        window.location.href = 'docseditor.html';
    }

    async deleteDocument(documentId) {
        const index = this.documents.findIndex(doc => doc.id === documentId);
        if (index !== -1) {
            const deletedDoc = this.documents[index];
            
            // Delete from server if available
            if (this.serverAvailable) {
                try {
                    const deleted = await this.api.deleteDocument(documentId);
                    if (!deleted) {
                        this.showToast(`Failed to delete "${deletedDoc.title}" from server`, 'error');
                        return;
                    }
                } catch (error) {
                    console.error('Error deleting document from server:', error);
                    this.showToast(`Failed to delete "${deletedDoc.title}" from server`, 'error');
                    return;
                }
            }
            
            // Remove from local array
            this.documents.splice(index, 1);
            this.saveDocuments();
            this.renderDocuments();
            this.updateEmptyState();
            this.updateDocumentCount();
            this.updateStorageInfo();
            this.populateRecentActivity();
            this.showToast(`Document "${deletedDoc.title}" deleted`, 'success');
        }
    }

    async deleteSelectedDocuments() {
        if (this.selectedDocuments.size === 0) return;

        const count = this.selectedDocuments.size;
        const documentsToDelete = Array.from(this.selectedDocuments);
        let deletedCount = 0;
        let failedDeletions = [];

        // Delete from server if available
        if (this.serverAvailable) {
            for (const docId of documentsToDelete) {
                try {
                    const deleted = await this.api.deleteDocument(docId);
                    if (deleted) {
                        deletedCount++;
                    } else {
                        failedDeletions.push(docId);
                    }
                } catch (error) {
                    console.error(`Error deleting document ${docId} from server:`, error);
                    failedDeletions.push(docId);
                }
            }

            if (failedDeletions.length > 0) {
                this.showToast(`Failed to delete ${failedDeletions.length} document(s) from server`, 'error');
                return;
            }
        }

        // Remove successfully deleted documents from local array
        documentsToDelete.forEach(docId => {
            const index = this.documents.findIndex(doc => doc.id === docId);
            if (index !== -1) {
                this.documents.splice(index, 1);
            }
        });

        this.selectedDocuments.clear();
        this.isSelectionMode = false;
        this.saveDocuments();
        this.renderDocuments();
        this.updateEmptyState();
        this.updateDocumentCount();
        this.updateStorageInfo();
        this.populateRecentActivity();

        document.getElementById('select-all').textContent = 'Select All';
        document.getElementById('delete-selected').style.display = 'none';

        this.showToast(`${count} document(s) deleted`, 'success');
    }

    duplicateDocument(documentId) {
        const originalDoc = this.documents.find(doc => doc.id === documentId);
        if (!originalDoc) return;

        const duplicatedDoc = {
            ...originalDoc,
            id: 'doc-' + Date.now(),
            title: `${originalDoc.title} - Copy`,
            createdAt: Date.now(),
            lastModified: Date.now()
        };

        this.documents.unshift(duplicatedDoc);
        this.saveDocuments();
        this.renderDocuments();
        this.updateDocumentCount();
        this.updateStorageInfo();
        this.populateRecentActivity();

        this.showToast(`Document duplicated successfully!`, 'success');
    }

    renameDocument(documentId, newTitle) {
        const doc = this.documents.find(d => d.id === documentId);
        if (doc) {
            doc.title = newTitle;
            doc.lastModified = Date.now();
            this.saveDocuments();
            this.renderDocuments();
            this.populateRecentActivity();
            this.showToast('Document renamed successfully!', 'success');
        }
    }

    exportDocument(documentId) {
        const doc = this.documents.find(d => d.id === documentId);
        if (!doc) {
            this.showToast('Document not found', 'error');
            return;
        }

        try {
            // Hide context menu
            document.getElementById('doc-context-menu').style.display = 'none';

            // Show loading toast
            this.showToast('Generating PDF...', 'info');

            this.exportDocumentAsPDF(doc);
        } catch (error) {
            console.error('Export error:', error);
            this.showToast('Failed to export document', 'error');
        }
    }

    async exportDocumentAsPDF(doc) {
        try {
            const title = doc.title || 'document';
            
            // Get document content
            let editorContent = '';
            if (Array.isArray(doc.content)) {
                // New multi-page format - use first page content
                editorContent = doc.content[0] || '';
            } else {
                // Old single-page format
                editorContent = doc.content || '';
            }
            
            // Check if document has content
            if (!editorContent.trim() || editorContent === '<p><br></p>' || editorContent === '<br>') {
                this.showToast('Document has no content to export', 'warning');
                return;
            }
            
            // Check if ExportUtils is available
            if (typeof ExportUtils === 'undefined') {
                this.showToast('Export utility not available. Please refresh the page.', 'error');
                return;
            }
            
            // Use the shared export utility
            await ExportUtils.exportContentAsPDF(editorContent, title, doc.watermark);
            
            this.showToast('PDF exported successfully!', 'success');
            
        } catch (error) {
            console.error('PDF export error:', error);
            this.showToast('Error exporting PDF. Please try again.', 'error');
        }
    }

    exportDocumentFallback(doc) {
        // Fallback method using browser print
        try {
            // Create a new window for printing
            const printWindow = window.open('', '_blank');
            const content = doc.content && doc.content.length > 0 ? doc.content.join('') : '<p>No content available</p>';
            
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${doc.title} - Export</title>
                    <style>
                        @page {
                            size: A4;
                            margin: 20mm;
                        }
                        body {
                            font-family: Arial, sans-serif;
                            font-size: 12pt;
                            line-height: 1.6;
                            color: #333;
                            margin: 0;
                            padding: 0;
                        }
                        .header {
                            margin-bottom: 20px;
                            border-bottom: 2px solid #333;
                            padding-bottom: 10px;
                        }
                        h1 {
                            margin: 0;
                            font-size: 24pt;
                            color: #333;
                        }
                        .meta {
                            margin: 5px 0 0 0;
                            color: #666;
                            font-size: 10pt;
                        }
                        .content {
                            margin-top: 20px;
                        }
                        h2, h3, h4, h5, h6 {
                            margin: 20px 0 10px 0;
                            color: #333;
                        }
                        p { margin: 10px 0; }
                        @media print {
                            body { margin: 0; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>${this.escapeHtml(doc.title)}</h1>
                        <p class="meta">
                            Created: ${this.formatDate(doc.createdAt)} | 
                            Last Modified: ${this.formatDate(doc.lastModified)} | 
                            Words: ${doc.wordCount || 0}
                        </p>
                    </div>
                    <div class="content">
                        ${content}
                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();

            // Trigger print dialog
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
                this.showToast(`PDF export initiated for "${doc.title}"`, 'success');
            }, 500);

        } catch (error) {
            console.error('Fallback export error:', error);
            this.showToast('Failed to export document. Please try again.', 'error');
        }
    }

    filterDocuments() {
        let filtered = [...this.documents];

        // Apply search filter
        if (this.searchQuery) {
            filtered = filtered.filter(doc => 
                doc.title.toLowerCase().includes(this.searchQuery) ||
                (doc.description && doc.description.toLowerCase().includes(this.searchQuery))
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (this.currentSort) {
                case 'name':
                    return a.title.localeCompare(b.title);
                case 'created':
                    return b.createdAt - a.createdAt;
                case 'size':
                    return (b.wordCount || 0) - (a.wordCount || 0);
                case 'modified':
                default:
                    return b.lastModified - a.lastModified;
            }
        });

        return filtered;
    }

    renderDocuments() {
        const grid = document.getElementById('documents-grid');
        const filtered = this.filterDocuments();
        
        if (filtered.length === 0) {
            if (this.searchQuery) {
                grid.innerHTML = `
                    <div class="no-results">
                        <i class="fas fa-search" style="font-size: 48px; color: #ccc; margin-bottom: 15px;"></i>
                        <h3>No documents found</h3>
                        <p>Try adjusting your search terms</p>
                    </div>
                `;
            } else {
                grid.innerHTML = '';
            }
            return;
        }

        // Show only recent documents (last 6) in the main view
        const documentsToShow = filtered.slice(0, 6);
        
        grid.innerHTML = documentsToShow.map(doc => this.createDocumentCard(doc)).join('');
        this.bindDocumentCardEvents();
    }

    renderAllDocuments() {
        const grid = document.getElementById('all-documents-grid');
        const filtered = this.filterDocuments();
        
        grid.innerHTML = filtered.map(doc => this.createDocumentCard(doc)).join('');
        this.bindDocumentCardEvents();
    }

    createDocumentCard(doc) {
        const isListView = this.currentView === 'list';
        const cardClass = `document-card ${isListView ? 'list-view' : ''}`;
        
        return `
            <div class="${cardClass}" data-id="${doc.id}">
                ${this.isSelectionMode ? `<input type="checkbox" class="card-checkbox" ${this.selectedDocuments.has(doc.id) ? 'checked' : ''}>` : ''}
                
                <div class="document-icon">
                    <i class="fas fa-file-alt"></i>
                </div>
                
                <div class="document-info">
                    <h3 class="document-title">${this.escapeHtml(doc.title)}</h3>
                    <div class="document-meta">
                        <span><i class="fas fa-clock"></i> ${this.formatDate(doc.lastModified)}</span>
                        <span><i class="fas fa-font"></i> ${doc.wordCount || 0} words</span>
                        ${doc.template && doc.template !== 'blank' ? `<span><i class="fas fa-bookmark"></i> ${doc.template}</span>` : ''}
                    </div>
                    ${doc.description ? `<p class="document-description">${this.escapeHtml(doc.description)}</p>` : ''}
                </div>
                
                <div class="document-actions">
                    <button class="btn btn-primary btn-sm" onclick="window.dashboard.openDocument('${doc.id}')">
                        <i class="fas fa-folder-open"></i>
                        Open
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="window.dashboard.openVersionControl('${doc.id}')">
                        <i class="fas fa-code-branch"></i>
                        Versions
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="window.dashboard.showContextMenu(event, '${doc.id}')">
                        <i class="fas fa-ellipsis-h"></i>
                    </button>
                </div>
            </div>
        `;
    }

    openVersionControl(documentId) {
        // Set the current document ID for version control
        localStorage.setItem('currentDocumentId', documentId);
        
        // Open version control in new tab
        window.open('version-control.html', '_blank');
    }

    bindDocumentCardEvents() {
        document.querySelectorAll('.document-card').forEach(card => {
            const checkbox = card.querySelector('.card-checkbox');
            
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    const docId = card.dataset.id;
                    
                    if (checkbox.checked) {
                        this.selectedDocuments.add(docId);
                        card.classList.add('selected');
                    } else {
                        this.selectedDocuments.delete(docId);
                        card.classList.remove('selected');
                    }
                    
                    // Update UI based on selection
                    const deleteBtn = document.getElementById('delete-selected');
                    if (this.selectedDocuments.size > 0) {
                        deleteBtn.style.display = 'block';
                        deleteBtn.textContent = `Delete Selected (${this.selectedDocuments.size})`;
                    } else {
                        deleteBtn.style.display = 'none';
                    }
                });
            }

            // Double click to open
            card.addEventListener('dblclick', () => {
                if (!this.isSelectionMode) {
                    this.openDocument(card.dataset.id);
                }
            });

            // Right click for context menu
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showContextMenu(e, card.dataset.id);
            });
        });
    }

    showContextMenu(event, documentId) {
        const contextMenu = document.getElementById('doc-context-menu');
        
        // First, show the menu to get its dimensions
        contextMenu.style.display = 'block';
        contextMenu.style.visibility = 'hidden'; // Hide while positioning
        
        // Get menu dimensions
        const menuRect = contextMenu.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        const padding = 10; // Minimum distance from edges
        
        // Calculate available space
        const spaceBelow = windowHeight - event.clientY;
        const spaceAbove = event.clientY;
        const spaceRight = windowWidth - event.clientX;
        const spaceLeft = event.clientX;
        
        // Determine vertical position
        let top = event.pageY;
        if (spaceBelow < menuRect.height + padding && spaceAbove > menuRect.height + padding) {
            // Not enough space below, but enough above
            top = event.pageY - menuRect.height;
        } else if (spaceBelow < menuRect.height + padding && spaceAbove < menuRect.height + padding) {
            // Not enough space above or below, position to fit in available space
            if (spaceAbove > spaceBelow) {
                top = padding;
            } else {
                top = Math.max(padding, event.pageY - menuRect.height);
            }
        }
        
        // Determine horizontal position
        let left = event.pageX;
        if (spaceRight < menuRect.width + padding && spaceLeft > menuRect.width + padding) {
            // Not enough space to the right, but enough to the left
            left = event.pageX - menuRect.width;
        } else if (spaceRight < menuRect.width + padding && spaceLeft < menuRect.width + padding) {
            // Not enough space left or right, position to fit in available space
            left = Math.max(padding, Math.min(event.pageX, windowWidth - menuRect.width - padding));
        }
        
        // Ensure menu doesn't go off-screen
        top = Math.max(padding, Math.min(top, windowHeight - menuRect.height - padding));
        left = Math.max(padding, Math.min(left, windowWidth - menuRect.width - padding));
        
        // Apply position
        contextMenu.style.left = left + 'px';
        contextMenu.style.top = top + 'px';
        contextMenu.style.visibility = 'visible'; // Show the menu
        
        // Store current document ID for context actions
        contextMenu.dataset.documentId = documentId;
        
        // Hide context menu when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('click', () => {
                contextMenu.style.display = 'none';
            }, { once: true });
        }, 10);
    }

    setupContextMenu() {
        document.getElementById('context-open').addEventListener('click', () => {
            const docId = document.getElementById('doc-context-menu').dataset.documentId;
            this.openDocument(docId);
        });

        document.getElementById('context-rename').addEventListener('click', () => {
            const docId = document.getElementById('doc-context-menu').dataset.documentId;
            const doc = this.documents.find(d => d.id === docId);
            if (doc) {
                const newTitle = prompt('Enter new name:', doc.title);
                if (newTitle && newTitle.trim()) {
                    this.renameDocument(docId, newTitle.trim());
                }
            }
        });

        document.getElementById('context-duplicate').addEventListener('click', () => {
            const docId = document.getElementById('doc-context-menu').dataset.documentId;
            this.duplicateDocument(docId);
        });

        document.getElementById('context-export').addEventListener('click', () => {
            const docId = document.getElementById('doc-context-menu').dataset.documentId;
            this.exportDocument(docId);
        });

        document.getElementById('context-classify').addEventListener('click', () => {
            const docId = document.getElementById('doc-context-menu').dataset.documentId;
            this.classifyDocumentFromContext(docId);
        });

        document.getElementById('context-delete').addEventListener('click', () => {
            const docId = document.getElementById('doc-context-menu').dataset.documentId;
            this.showDeleteModal(docId);
        });
    }

    classifyDocumentFromContext(docId) {
        const doc = this.documents.find(d => d.id === docId);
        if (doc) {
            // Pre-select the document in the classification modal
            this.showClassificationModal();
            setTimeout(() => {
                const documentSelect = document.getElementById('document-select');
                documentSelect.value = docId;
            }, 100);
        }
    }

    setupModalEvents() {
        // New Document Modal
        this.setupNewDocumentModal();
        
        // Delete Modal
        this.setupDeleteModal();
        
        // Import Modal
        this.setupImportModal();
        
        // Classification Modal
        this.setupClassificationModal();
        
        // General modal close events
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal-overlay').style.display = 'none';
            });
        });

        // Close modals on overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.style.display = 'none';
                }
            });
        });
    }

    setupNewDocumentModal() {
        const modal = document.getElementById('new-doc-modal');
        const createBtn = document.getElementById('create-new-doc');
        const cancelBtn = document.getElementById('cancel-new-doc');
        const nameInput = document.getElementById('document-name');
        const descInput = document.getElementById('document-description');

        createBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            if (name) {
                const newDoc = {
                    id: 'doc-' + Date.now(),
                    title: name,
                    content: '',
                    description: descInput.value.trim(),
                    createdAt: Date.now(),
                    lastModified: Date.now(),
                    template: 'blank',
                    wordCount: 0
                };

                this.documents.unshift(newDoc);
                this.saveDocuments();
                this.renderDocuments();
                this.updateEmptyState();
                this.updateDocumentCount();
                this.updateStorageInfo();
                this.populateRecentActivity();

                modal.style.display = 'none';
                nameInput.value = '';
                descInput.value = '';

                this.showToast(`Document "${name}" created successfully!`, 'success');
                
                setTimeout(() => {
                    this.openDocument(newDoc.id);
                }, 500);
            }
        });

        cancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            nameInput.value = '';
            descInput.value = '';
        });
    }

    setupDeleteModal() {
        const modal = document.getElementById('delete-modal');
        const confirmBtn = document.getElementById('confirm-delete');
        const cancelBtn = document.getElementById('cancel-delete');

        confirmBtn.addEventListener('click', () => {
            if (this.documentToDelete) {
                this.deleteDocument(this.documentToDelete);
                modal.style.display = 'none';
                this.documentToDelete = null;
            }
        });

        cancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            this.documentToDelete = null;
        });
    }

    setupImportModal() {
        const modal = document.getElementById('import-modal');
        const dropZone = document.getElementById('import-drop-zone');
        const fileInput = document.getElementById('import-file');
        const confirmBtn = document.getElementById('confirm-import');
        const cancelBtn = document.getElementById('cancel-import');

        dropZone.addEventListener('click', () => fileInput.click());
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files);
            this.handleImportFiles(files);
        });

        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.handleImportFiles(files);
        });

        cancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            fileInput.value = '';
        });
    }

    setupClassificationModal() {
        const modal = document.getElementById('classification-modal');
        const closeBtn = document.getElementById('close-classification-modal');
        const cancelBtn = document.getElementById('cancel-classification');
        const startBtn = document.getElementById('start-classification');
        const sourceRadios = document.querySelectorAll('input[name="classification-source"]');
        const internalSection = document.getElementById('internal-doc-selection');
        const externalSection = document.getElementById('external-file-selection');
        const pdfUploadZone = document.getElementById('pdf-upload-zone');
        const pdfFileInput = document.getElementById('pdf-file-input');
        
        // Modal close events
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            this.resetClassificationModal();
        });
        
        cancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            this.resetClassificationModal();
        });
        
        // Source selection change
        sourceRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'internal') {
                    internalSection.style.display = 'block';
                    externalSection.style.display = 'none';
                } else {
                    internalSection.style.display = 'none';
                    externalSection.style.display = 'block';
                }
            });
        });
        
        // PDF file upload
        pdfUploadZone.addEventListener('click', () => {
            pdfFileInput.click();
        });
        
        pdfFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handlePdfFileSelection(file);
            }
        });
        
        // Drag and drop
        pdfUploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            pdfUploadZone.classList.add('dragover');
        });
        
        pdfUploadZone.addEventListener('dragleave', () => {
            pdfUploadZone.classList.remove('dragover');
        });
        
        pdfUploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            pdfUploadZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'application/pdf') {
                this.handlePdfFileSelection(file);
            }
        });
        
        // Start classification
        startBtn.addEventListener('click', () => {
            this.startClassification();
        });
        
        // Results modal
        const resultsModal = document.getElementById('classification-results-modal');
        const closeResultsBtn = document.getElementById('close-results-modal');
        const closeResultsBtn2 = document.getElementById('close-results');
        const downloadBtn = document.getElementById('download-classified-pdf');
        
        closeResultsBtn.addEventListener('click', () => {
            resultsModal.style.display = 'none';
        });
        
        closeResultsBtn2.addEventListener('click', () => {
            resultsModal.style.display = 'none';
        });
        
        downloadBtn.addEventListener('click', () => {
            this.downloadClassifiedPdf();
        });
    }

    populateDocumentSelect() {
        const select = document.getElementById('document-select');
        select.innerHTML = '<option value="">Select a document...</option>';
        
        this.documents.forEach(doc => {
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = doc.title;
            select.appendChild(option);
        });
    }

    showClassificationModal() {
        const modal = document.getElementById('classification-modal');
        this.populateDocumentSelect();
        this.resetClassificationModal();
        modal.style.display = 'block';
    }

    handlePdfFileSelection(file) {
        const uploadZone = document.getElementById('pdf-upload-zone');
        uploadZone.classList.add('has-file');
        uploadZone.innerHTML = `
            <i class="fas fa-file-pdf"></i>
            <p>${file.name}</p>
            <span class="file-info">Ready to classify</span>
        `;
        this.selectedPdfFile = file;
    }

    resetClassificationModal() {
        const internalRadio = document.querySelector('input[name="classification-source"][value="internal"]');
        const externalRadio = document.querySelector('input[name="classification-source"][value="external"]');
        const internalSection = document.getElementById('internal-doc-selection');
        const externalSection = document.getElementById('external-file-selection');
        const uploadZone = document.getElementById('pdf-upload-zone');
        const documentSelect = document.getElementById('document-select');
        const pdfFileInput = document.getElementById('pdf-file-input');
        
        internalRadio.checked = true;
        externalRadio.checked = false;
        internalSection.style.display = 'block';
        externalSection.style.display = 'none';
        documentSelect.value = '';
        pdfFileInput.value = '';
        this.selectedPdfFile = null;
        
        uploadZone.classList.remove('has-file');
        uploadZone.innerHTML = `
            <i class="fas fa-cloud-upload-alt"></i>
            <p>Click to upload PDF file or drag and drop</p>
            <span class="file-info">PDF files only</span>
        `;
    }

    async startClassification() {
        const sourceType = document.querySelector('input[name="classification-source"]:checked').value;
        const includeWatermark = document.getElementById('include-watermark').checked;
        const modal = document.getElementById('classification-modal');
        const resultsModal = document.getElementById('classification-results-modal');
        const resultsContent = document.getElementById('classification-results-content');
        
        // Show loading
        resultsContent.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Analyzing document...</p>
            </div>
        `;
        
        modal.style.display = 'none';
        resultsModal.style.display = 'block';
        
        try {
            let result;
            
            if (sourceType === 'internal') {
                const documentId = document.getElementById('document-select').value;
                if (!documentId) {
                    throw new Error('Please select a document');
                }
                
                const selectedDocument = this.documents.find(doc => doc.id === documentId);
                if (!selectedDocument) {
                    throw new Error('Document not found');
                }
                
                result = await this.classifyInternalDocument(selectedDocument);
            } else {
                if (!this.selectedPdfFile) {
                    throw new Error('Please select a PDF file');
                }
                
                result = await this.classifyExternalPdf(this.selectedPdfFile, includeWatermark);
            }
            
            this.displayClassificationResults(result);
            
        } catch (error) {
            console.error('Classification error:', error);
            resultsContent.innerHTML = `
                <div class="error-message">
                    <h3>Classification Failed</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    async classifyInternalDocument(documentObj) {
        const response = await fetch('/api/classify-document', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authToken}`
            },
            body: JSON.stringify({
                documentId: documentObj.id,
                content: documentObj.content
            })
        });
        
        if (!response.ok) {
            throw new Error('Classification failed');
        }
        
        return await response.json();
    }

    async classifyExternalPdf(file, includeWatermark) {
        const formData = new FormData();
        formData.append('document', file);
        
        const endpoint = includeWatermark ? '/api/classify-and-watermark' : '/api/classify-document';
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.authToken}`
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Classification failed');
        }
        
        return await response.json();
    }

    displayClassificationResults(result) {
        const resultsContent = document.getElementById('classification-results-content');
        const downloadBtn = document.getElementById('download-classified-pdf');
        
        if (result.download_url) {
            downloadBtn.style.display = 'block';
            this.currentDownloadUrl = result.download_url;
            downloadBtn.onclick = () => {
                this.downloadClassifiedPdf();
            };
        } else {
            downloadBtn.style.display = 'none';
        }
        
        const classificationClass = result.classification.replace(/\s+/g, '_');
        const confidencePercent = Math.round(result.confidence * 100);
        
        resultsContent.innerHTML = `
            <div class="classification-results">
                <div class="classification-header ${classificationClass}">
                    <i class="fas fa-shield-alt"></i>
                    <span>Classification: ${result.classification}</span>
                </div>
                
                <div class="classification-details">
                    <div class="detail-section">
                        <h4>Confidence Level</h4>
                        <p>${confidencePercent}% confidence</p>
                        <div class="confidence-bar">
                            <div class="confidence-fill" style="width: ${confidencePercent}%"></div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Analysis Time</h4>
                        <p>${new Date(result.analysis_timestamp).toLocaleString()}</p>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Reasoning</h4>
                        <p>${result.reasoning}</p>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Potential Damage</h4>
                        <p>${result.potential_damage}</p>
                    </div>
                </div>
                
                ${result.key_risk_factors.length > 0 ? `
                    <div class="detail-section">
                        <h4>Key Risk Factors</h4>
                        <ul>
                            ${result.key_risk_factors.map(factor => `<li>${factor}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${result.handling_recommendations.length > 0 ? `
                    <div class="detail-section">
                        <h4>Handling Recommendations</h4>
                        <ul>
                            ${result.handling_recommendations.map(rec => `<li>${rec}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${this.formatSensitiveContent(result.sensitive_content)}
            </div>
        `;
    }

    formatSensitiveContent(sensitiveContent) {
        const sections = [];
        
        if (sensitiveContent.locations && sensitiveContent.locations.length > 0) {
            sections.push({
                title: 'Locations',
                icon: 'fas fa-map-marker-alt',
                items: sensitiveContent.locations
            });
        }
        
        if (sensitiveContent.personnel && sensitiveContent.personnel.length > 0) {
            sections.push({
                title: 'Personnel',
                icon: 'fas fa-user',
                items: sensitiveContent.personnel
            });
        }
        
        if (sensitiveContent.operations && sensitiveContent.operations.length > 0) {
            sections.push({
                title: 'Operations',
                icon: 'fas fa-cogs',
                items: sensitiveContent.operations
            });
        }
        
        if (sensitiveContent.technical && sensitiveContent.technical.length > 0) {
            sections.push({
                title: 'Technical',
                icon: 'fas fa-wrench',
                items: sensitiveContent.technical
            });
        }
        
        if (sensitiveContent.intelligence && sensitiveContent.intelligence.length > 0) {
            sections.push({
                title: 'Intelligence',
                icon: 'fas fa-eye',
                items: sensitiveContent.intelligence
            });
        }
        
        if (sections.length === 0) {
            return '';
        }
        
        return `
            <div class="detail-section">
                <h4>Sensitive Content Detected</h4>
                <div class="sensitive-content">
                    ${sections.map(section => `
                        <div class="sensitive-item">
                            <i class="${section.icon}"></i>
                            <strong>${section.title}:</strong> ${section.items.join(', ')}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    downloadClassifiedPdf() {
        if (!this.currentDownloadUrl) {
            console.error('No download URL available');
            return;
        }
        
        // Create a download link with authentication
        fetch(this.currentDownloadUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.authToken}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Download failed');
            }
            return response.blob();
        })
        .then(blob => {
            // Create a download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `classified_document_${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        })
        .catch(error => {
            console.error('Download error:', error);
            alert('Download failed. Please try again.');
        });
    }

    showStorageLimitModal() {
        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10001;
        `;

        // Create modal content
        modalOverlay.innerHTML = `
            <div class="modal-content" style="background: white; padding: 30px; border-radius: 12px; max-width: 500px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                <div style="color: #e74c3c; font-size: 48px; margin-bottom: 20px;">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h2 style="color: #2c3e50; margin-bottom: 15px;">Storage Limit Reached</h2>
                <p style="color: #7f8c8d; margin-bottom: 20px; line-height: 1.6;">
                    You've reached the maximum limit of <strong>${this.maxDocuments} documents</strong>. 
                    To create new documents, please delete some existing ones first.
                </p>
                <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <p style="margin: 0; color: #495057;">
                        <strong>Current:</strong> ${this.documents.length}/${this.maxDocuments} documents
                    </p>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="manage-docs-btn" style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
                        Manage Documents
                    </button>
                    <button id="close-limit-modal" style="padding: 10px 20px; background: #95a5a6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Add event listeners
        modalOverlay.querySelector('#close-limit-modal').addEventListener('click', () => {
            modalOverlay.remove();
        });

        modalOverlay.querySelector('#manage-docs-btn').addEventListener('click', () => {
            modalOverlay.remove();
            // Enable selection mode for easier document management
            this.toggleSelectionMode();
        });

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.remove();
            }
        });

        document.body.appendChild(modalOverlay);
    }

    async refreshDocuments() {
        this.showToast('Refreshing documents...', 'info');
        
        try {
            await this.loadDocuments();
            this.renderDocuments();
            this.updateEmptyState();
            this.updateDocumentCount();
            this.populateRecentActivity();
            this.updateStorageInfo();
            
            this.showToast('Documents refreshed successfully!', 'success');
        } catch (error) {
            console.error('Error refreshing documents:', error);
            this.showToast('Failed to refresh documents', 'error');
        }
    }

    // ...existing code...
    async loadDocuments() {
        if (this.serverAvailable) {
            // Use sync method to ensure consistency between server and local storage
            await this.syncDocuments();
        } else {
            // Fallback to local documents if server is not available
            this.documents = await this.api.getAllDocuments();
        }
        console.log(`Loaded ${this.documents.length} documents from ${this.serverAvailable ? 'server' : 'localStorage'}`);
    }

    async saveDocuments() {
        // Save documents to localStorage
        localStorage.setItem('documents', JSON.stringify(this.documents));
        
        // Also try to save to server if available
        if (this.serverAvailable) {
            try {
                // Get current server documents to compare
                const serverDocs = await this.api.getAllDocuments();
                const localDocIds = new Set(this.documents.map(doc => doc.id));
                const serverDocIds = new Set(serverDocs.map(doc => doc.id));

                // Save/update documents that have been modified
                for (const doc of this.documents) {
                    if (doc.lastModified && doc.lastModified > (doc.lastSaved || 0)) {
                        await this.api.saveDocumentWithVersion(doc, 'Auto-save from dashboard');
                        doc.lastSaved = Date.now();
                    }
                }

                console.log('Documents saved locally and synced with server');
            } catch (error) {
                console.error('Error syncing to server:', error);
            }
        }
    }

    async syncDocuments() {
        if (!this.serverAvailable) return;

        try {
            // Get fresh documents from server
            const serverDocs = await this.api.getAllDocuments();
            
            // Update our local documents array with the server data
            this.documents = serverDocs;
            
            // Save to localStorage to keep them in sync
            localStorage.setItem('documents', JSON.stringify(this.documents));
            
            console.log(`Synced ${this.documents.length} documents from server`);
        } catch (error) {
            console.error('Error syncing documents:', error);
        }
    }

    updateDocumentCount() {
        const count = this.documents.length;
        const countElement = document.getElementById('document-count');
        if (countElement) {
            countElement.textContent = `${count}/${this.maxDocuments} documents`;
            
            // Add visual indicator when approaching limit
            if (count >= this.maxDocuments * 0.8) { // 80% of limit
                countElement.style.color = count >= this.maxDocuments ? '#e74c3c' : '#f39c12';
            } else {
                countElement.style.color = '';
            }
        }
    }

    updateEmptyState() {
        const emptyState = document.getElementById('empty-state');
        const recentSection = document.querySelector('.recent-section');
        const templatesSection = document.querySelector('.templates-section');
        
        if (this.documents.length === 0) {
            emptyState.style.display = 'block';
            recentSection.style.display = 'none';
            templatesSection.style.display = 'block'; // Keep templates visible
        } else {
            emptyState.style.display = 'none';
            recentSection.style.display = 'block';
            templatesSection.style.display = 'block';
        }
    }

    populateRecentActivity() {
        const activityContainer = document.getElementById('recent-activity');
        const recentDocs = this.documents
            .sort((a, b) => b.lastModified - a.lastModified)
            .slice(0, 5);

        if (recentDocs.length === 0) {
            activityContainer.innerHTML = '<div class="activity-item">No recent activity</div>';
            return;
        }

        activityContainer.innerHTML = recentDocs.map(doc => {
            const action = doc.createdAt === doc.lastModified ? 'Created' : 'Modified';
            return `
                <div class="activity-item">
                    <strong>${action}</strong> "${doc.title}"<br>
                    <small>${this.formatDate(doc.lastModified)}</small>
                </div>
            `;
        }).join('');
    }

    updateStorageInfo() {
        const storageUsed = document.getElementById('storage-used');
        const storageText = document.getElementById('storage-text');
        
        const docCount = this.documents.length;
        const percentage = (docCount / this.maxDocuments) * 100;
        
        storageUsed.style.width = `${percentage}%`;
        storageText.textContent = `${docCount}/${this.maxDocuments} documents`;
        
        // Update storage bar color based on usage
        if (percentage >= 100) {
            storageUsed.style.backgroundColor = '#e74c3c'; // Red when full
        } else if (percentage >= 80) {
            storageUsed.style.backgroundColor = '#f39c12'; // Orange when near full
        } else {
            storageUsed.style.backgroundColor = '#3498db'; // Blue when normal
        }
    }

    countWords(text) {
        if (!text) return 0;
        // Remove HTML tags and count words
        const plainText = text.replace(/<[^>]*>/g, '');
        return plainText.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'info') {
        // Remove existing toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        // Toast styles
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            info: '#007bff',
            warning: '#ffc107'
        };

        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
            max-width: 400px;
            font-size: 14px;
        `;

        // Add toast styles if not already added
        if (!document.querySelector('#toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .toast-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);

        // Auto remove after 4 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideInRight 0.3s ease-out reverse';
                setTimeout(() => toast.remove(), 300);
            }
        }, 4000);
    }

    showStorageLimitModal() {
        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10001;
        `;

        // Create modal content
        modalOverlay.innerHTML = `
            <div class="modal-content" style="background: white; padding: 30px; border-radius: 12px; max-width: 500px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                <div style="color: #e74c3c; font-size: 48px; margin-bottom: 20px;">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h2 style="color: #2c3e50; margin-bottom: 15px;">Storage Limit Reached</h2>
                <p style="color: #7f8c8d; margin-bottom: 20px; line-height: 1.6;">
                    You've reached the maximum limit of <strong>${this.maxDocuments} documents</strong>. 
                    To create new documents, please delete some existing ones first.
                </p>
                <div style="margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <p style="margin: 0; color: #495057;">
                        <strong>Current:</strong> ${this.documents.length}/${this.maxDocuments} documents
                    </p>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="manage-docs-btn" style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
                        Manage Documents
                    </button>
                    <button id="close-limit-modal" style="padding: 10px 20px; background: #95a5a6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Add event listeners
        modalOverlay.querySelector('#close-limit-modal').addEventListener('click', () => {
            modalOverlay.remove();
        });

        modalOverlay.querySelector('#manage-docs-btn').addEventListener('click', () => {
            modalOverlay.remove();
            // Enable selection mode for easier document management
            this.toggleSelectionMode();
        });

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.remove();
            }
        });

        document.body.appendChild(modalOverlay);
    }
}

// Initialize the dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.dashboard = new AdvancedDocumentDashboard();
});
