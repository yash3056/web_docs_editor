// Standalone editor functionality
class StandaloneEditor {
    constructor() {
        this.currentDocument = null;
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50;
        this.isInitialized = false;
    }

    initialize() {
        if (this.isInitialized) return;
        
        this.editor = document.getElementById('editor');
        this.titleInput = document.getElementById('document-title');
        
        this.setupEventListeners();
        this.loadDocumentFromURL();
        this.isInitialized = true;
    }

    setupEventListeners() {
        // Save button
        document.getElementById('save-btn').addEventListener('click', () => {
            this.saveDocument();
        });

        // Dashboard button
        document.getElementById('dashboard-btn').addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });

        // Export buttons
        document.getElementById('export-btn').addEventListener('click', () => {
            this.toggleExportMenu();
        });

        document.getElementById('export-html').addEventListener('click', () => {
            this.exportDocument('html');
        });

        document.getElementById('export-pdf').addEventListener('click', () => {
            this.exportDocument('pdf');
        });

        document.getElementById('export-word').addEventListener('click', () => {
            this.exportDocument('rtf');
        });

        // Formatting buttons
        document.getElementById('bold-btn').addEventListener('click', () => {
            this.formatText('bold');
        });

        document.getElementById('italic-btn').addEventListener('click', () => {
            this.formatText('italic');
        });

        document.getElementById('underline-btn').addEventListener('click', () => {
            this.formatText('underline');
        });

        document.getElementById('strikethrough-btn').addEventListener('click', () => {
            this.formatText('strikethrough');
        });

        // Alignment buttons
        document.getElementById('align-left-btn').addEventListener('click', () => {
            this.formatText('justifyLeft');
        });

        document.getElementById('align-center-btn').addEventListener('click', () => {
            this.formatText('justifyCenter');
        });

        document.getElementById('align-right-btn').addEventListener('click', () => {
            this.formatText('justifyRight');
        });

        document.getElementById('align-justify-btn').addEventListener('click', () => {
            this.formatText('justifyFull');
        });

        // List buttons
        document.getElementById('bullet-list-btn').addEventListener('click', () => {
            this.formatText('insertUnorderedList');
        });

        document.getElementById('number-list-btn').addEventListener('click', () => {
            this.formatText('insertOrderedList');
        });

        // Undo/Redo buttons
        document.getElementById('undo-btn').addEventListener('click', () => {
            this.undo();
        });

        document.getElementById('redo-btn').addEventListener('click', () => {
            this.redo();
        });

        // Font controls
        document.getElementById('font-family').addEventListener('change', (e) => {
            this.formatText('fontName', e.target.value);
        });

        document.getElementById('font-size').addEventListener('change', (e) => {
            this.formatText('fontSize', e.target.value);
        });

        // Color controls
        document.getElementById('text-color').addEventListener('change', (e) => {
            this.formatText('foreColor', e.target.value);
        });

        document.getElementById('bg-color').addEventListener('change', (e) => {
            this.formatText('backColor', e.target.value);
        });

        // Link and image buttons
        document.getElementById('link-btn').addEventListener('click', () => {
            this.insertLink();
        });

        document.getElementById('image-btn').addEventListener('click', () => {
            this.insertImage();
        });

        // Editor events
        this.editor.addEventListener('input', () => {
            this.updateWordCount();
            this.saveToHistory();
        });

        this.editor.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        this.titleInput.addEventListener('input', () => {
            this.updateDocumentTitle();
        });

        // Auto-save
        setInterval(() => {
            this.autoSave();
        }, 30000); // Auto-save every 30 seconds
    }

    loadDocumentFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const docId = urlParams.get('doc');
        
        if (docId) {
            this.currentDocument = standaloneDocStorage.getDocument(docId);
            if (this.currentDocument) {
                this.titleInput.value = this.currentDocument.title;
                this.editor.innerHTML = this.currentDocument.content;
                this.updateWordCount();
                document.getElementById('save-status').textContent = 'Loaded';
                return;
            }
        }
        
        // Create new document
        this.currentDocument = {
            id: standaloneDocStorage.generateDocumentId(),
            title: 'Untitled Document',
            content: '<p>Start typing your document here...</p>',
            createdAt: Date.now(),
            lastModified: Date.now()
        };
        
        this.titleInput.value = this.currentDocument.title;
        this.editor.innerHTML = this.currentDocument.content;
        this.updateWordCount();
    }

    saveDocument() {
        if (!this.currentDocument) return;
        
        this.currentDocument.title = this.titleInput.value;
        this.currentDocument.content = this.editor.innerHTML;
        this.currentDocument.lastModified = Date.now();
        
        try {
            standaloneDocStorage.saveDocument(this.currentDocument);
            document.getElementById('save-status').textContent = 'Saved';
            setTimeout(() => {
                document.getElementById('save-status').textContent = 'Ready';
            }, 2000);
        } catch (error) {
            document.getElementById('save-status').textContent = 'Error saving';
            console.error('Save error:', error);
        }
    }

    autoSave() {
        if (this.currentDocument) {
            this.saveDocument();
        }
    }

    updateDocumentTitle() {
        if (this.currentDocument) {
            this.currentDocument.title = this.titleInput.value;
        }
    }

    formatText(command, value = null) {
        this.editor.focus();
        document.execCommand(command, false, value);
        this.saveToHistory();
    }

    insertLink() {
        const url = prompt('Enter URL:');
        if (url) {
            const text = prompt('Enter link text:', url);
            if (text) {
                this.formatText('createLink', url);
            }
        }
    }

    insertImage() {
        const url = prompt('Enter image URL:');
        if (url) {
            this.formatText('insertImage', url);
        }
    }

    saveToHistory() {
        if (this.undoStack.length >= this.maxHistorySize) {
            this.undoStack.shift();
        }
        this.undoStack.push(this.editor.innerHTML);
        this.redoStack = [];
    }

    undo() {
        if (this.undoStack.length > 1) {
            this.redoStack.push(this.undoStack.pop());
            this.editor.innerHTML = this.undoStack[this.undoStack.length - 1];
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            const content = this.redoStack.pop();
            this.undoStack.push(content);
            this.editor.innerHTML = content;
        }
    }

    updateWordCount() {
        const text = this.editor.textContent || this.editor.innerText;
        const words = text.trim().split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;
        const charCount = text.length;
        
        document.getElementById('word-count').textContent = `Words: ${wordCount}`;
        document.getElementById('char-count').textContent = `Characters: ${charCount}`;
    }

    handleKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 's':
                    e.preventDefault();
                    this.saveDocument();
                    break;
                case 'z':
                    e.preventDefault();
                    this.undo();
                    break;
                case 'y':
                    e.preventDefault();
                    this.redo();
                    break;
                case 'b':
                    e.preventDefault();
                    this.formatText('bold');
                    break;
                case 'i':
                    e.preventDefault();
                    this.formatText('italic');
                    break;
                case 'u':
                    e.preventDefault();
                    this.formatText('underline');
                    break;
            }
        }
    }

    toggleExportMenu() {
        const menu = document.getElementById('export-menu');
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }

    exportDocument(format) {
        if (!this.currentDocument) return;
        
        const title = this.currentDocument.title;
        const content = this.editor.innerHTML;
        
        switch (format) {
            case 'html':
                standaloneExporter.exportAsHTML(title, content);
                break;
            case 'pdf':
                standaloneExporter.exportAsPDF(title, content);
                break;
            case 'rtf':
                standaloneExporter.exportAsRTF(title, content);
                break;
            case 'txt':
                standaloneExporter.exportAsText(title, content);
                break;
        }
        
        this.toggleExportMenu();
    }

    printDocument() {
        if (!this.currentDocument) return;
        
        const title = this.currentDocument.title;
        const content = this.editor.innerHTML;
        
        standaloneExporter.printDocument(title, content);
    }
}

// Initialize editor when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!standaloneAuth.isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }
    
    // Initialize editor
    const editor = new StandaloneEditor();
    editor.initialize();
    
    // Hide export menu when clicking outside
    document.addEventListener('click', function(e) {
        const exportBtn = document.getElementById('export-btn');
        const exportMenu = document.getElementById('export-menu');
        
        if (!exportBtn.contains(e.target) && !exportMenu.contains(e.target)) {
            exportMenu.style.display = 'none';
        }
    });
});