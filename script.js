class DocsEditor {
    constructor() {
        this.editor = document.getElementById('editor');
        this.documentTitle = document.getElementById('document-title');
        this.initializeEventListeners();
        this.updateWordCount();
        this.setupAutoSave();
        this.history = [];
        this.historyIndex = -1;
        this.saveState();
    }

    initializeEventListeners() {
        // Toolbar formatting buttons
        document.getElementById('bold-btn').addEventListener('click', () => this.formatText('bold'));
        document.getElementById('italic-btn').addEventListener('click', () => this.formatText('italic'));
        document.getElementById('underline-btn').addEventListener('click', () => this.formatText('underline'));
        document.getElementById('strikethrough-btn').addEventListener('click', () => this.formatText('strikethrough'));

        // Alignment buttons
        document.getElementById('align-left-btn').addEventListener('click', () => this.formatText('justifyLeft'));
        document.getElementById('align-center-btn').addEventListener('click', () => this.formatText('justifyCenter'));
        document.getElementById('align-right-btn').addEventListener('click', () => this.formatText('justifyRight'));
        document.getElementById('align-justify-btn').addEventListener('click', () => this.formatText('justifyFull'));

        // List buttons
        document.getElementById('bullet-list-btn').addEventListener('click', () => this.formatText('insertUnorderedList'));
        document.getElementById('number-list-btn').addEventListener('click', () => this.formatText('insertOrderedList'));

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

        // Undo/Redo
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.redo());

        // Link and image insertion
        document.getElementById('link-btn').addEventListener('click', () => this.showLinkModal());
        document.getElementById('image-btn').addEventListener('click', () => this.showImageModal());

        // Save and export
        document.getElementById('save-btn').addEventListener('click', () => this.saveDocument());
        document.getElementById('export-btn').addEventListener('click', () => this.exportDocument());

        // Editor events
        this.editor.addEventListener('input', () => {
            this.updateWordCount();
            this.saveState();
        });

        this.editor.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 's':
                        e.preventDefault();
                        this.saveDocument();
                        break;
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.redo();
                        } else {
                            this.undo();
                        }
                        break;
                    case 'y':
                        e.preventDefault();
                        this.redo();
                        break;
                }
            }
        });

        // Selection change for toolbar updates
        document.addEventListener('selectionchange', () => this.updateToolbarState());

        // Modal events
        this.setupModalEvents();
    }

    formatText(command, value = null) {
        document.execCommand(command, false, value);
        this.editor.focus();
        this.updateToolbarState();
        this.saveState();
    }

    updateToolbarState() {
        const commands = ['bold', 'italic', 'underline', 'strikethrough'];
        commands.forEach(command => {
            const button = document.getElementById(`${command}-btn`);
            if (button) {
                if (document.queryCommandState(command)) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            }
        });

        // Update alignment buttons
        const alignments = [
            { command: 'justifyLeft', btn: 'align-left-btn' },
            { command: 'justifyCenter', btn: 'align-center-btn' },
            { command: 'justifyRight', btn: 'align-right-btn' },
            { command: 'justifyFull', btn: 'align-justify-btn' }
        ];

        alignments.forEach(align => {
            const button = document.getElementById(align.btn);
            if (button) {
                if (document.queryCommandState(align.command)) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            }
        });
    }

    updateWordCount() {
        const text = this.editor.innerText || '';
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const characters = text.length;

        document.getElementById('word-count').textContent = `Words: ${words}`;
        document.getElementById('char-count').textContent = `Characters: ${characters}`;
    }

    saveState() {
        const state = {
            content: this.editor.innerHTML,
            title: this.documentTitle.value
        };

        // Remove future history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        this.history.push(state);
        this.historyIndex = this.history.length - 1;

        // Limit history size
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this.editor.innerHTML = state.content;
            this.documentTitle.value = state.title;
            this.updateWordCount();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = this.history[this.historyIndex];
            this.editor.innerHTML = state.content;
            this.documentTitle.value = state.title;
            this.updateWordCount();
        }
    }

    showLinkModal() {
        const modal = document.getElementById('link-modal');
        const selectedText = window.getSelection().toString();
        document.getElementById('link-text').value = selectedText;
        modal.style.display = 'block';
    }

    showImageModal() {
        const modal = document.getElementById('image-modal');
        modal.style.display = 'block';
    }

    setupModalEvents() {
        // Close modals when clicking outside or on close button
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            const closeBtn = modal.querySelector('.close');
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Link modal events
        document.getElementById('insert-link-btn').addEventListener('click', () => {
            const text = document.getElementById('link-text').value;
            const url = document.getElementById('link-url').value;
            
            if (url) {
                const link = `<a href="${url}" target="_blank">${text || url}</a>`;
                this.insertHTML(link);
                document.getElementById('link-modal').style.display = 'none';
                document.getElementById('link-text').value = '';
                document.getElementById('link-url').value = '';
            }
        });

        document.getElementById('cancel-link-btn').addEventListener('click', () => {
            document.getElementById('link-modal').style.display = 'none';
            document.getElementById('link-text').value = '';
            document.getElementById('link-url').value = '';
        });

        // Image modal events
        document.getElementById('insert-image-btn').addEventListener('click', () => {
            const url = document.getElementById('image-url').value;
            const alt = document.getElementById('image-alt').value;
            
            if (url) {
                const img = `<img src="${url}" alt="${alt}" style="max-width: 100%; height: auto;">`;
                this.insertHTML(img);
                document.getElementById('image-modal').style.display = 'none';
                document.getElementById('image-url').value = '';
                document.getElementById('image-alt').value = '';
            }
        });

        document.getElementById('cancel-image-btn').addEventListener('click', () => {
            document.getElementById('image-modal').style.display = 'none';
            document.getElementById('image-url').value = '';
            document.getElementById('image-alt').value = '';
        });
    }

    insertHTML(html) {
        if (document.queryCommandSupported('insertHTML')) {
            document.execCommand('insertHTML', false, html);
        } else {
            // Fallback for browsers that don't support insertHTML
            const selection = window.getSelection();
            if (selection.rangeCount) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                const div = document.createElement('div');
                div.innerHTML = html;
                const frag = document.createDocumentFragment();
                let node;
                while ((node = div.firstChild)) {
                    frag.appendChild(node);
                }
                range.insertNode(frag);
            }
        }
        this.saveState();
    }

    saveDocument() {
        const data = {
            title: this.documentTitle.value,
            content: this.editor.innerHTML,
            lastModified: new Date().toISOString()
        };

        localStorage.setItem('webdocs_document', JSON.stringify(data));
        
        const now = new Date().toLocaleString();
        document.getElementById('last-saved').textContent = `Last saved: ${now}`;
        
        // Show a brief success message
        this.showNotification('Document saved successfully!', 'success');
    }

    loadDocument() {
        const saved = localStorage.getItem('webdocs_document');
        if (saved) {
            const data = JSON.parse(saved);
            this.documentTitle.value = data.title;
            this.editor.innerHTML = data.content;
            this.updateWordCount();
            
            const lastModified = new Date(data.lastModified).toLocaleString();
            document.getElementById('last-saved').textContent = `Last saved: ${lastModified}`;
        }
    }

    exportDocument() {
        const title = this.documentTitle.value || 'document';
        const content = this.editor.innerHTML;
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 2rem; 
            line-height: 1.6; 
        }
        h1, h2, h3, h4, h5, h6 { margin: 1.5rem 0 1rem 0; }
        p { margin: 1rem 0; }
        ul, ol { margin: 1rem 0; padding-left: 2rem; }
        img { max-width: 100%; height: auto; }
    </style>
</head>
<body>
    ${content}
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('Document exported successfully!', 'success');
    }

    setupAutoSave() {
        setInterval(() => {
            this.saveDocument();
        }, 30000); // Auto-save every 30 seconds
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

        if (type === 'success') {
            notification.style.background = '#4CAF50';
        } else if (type === 'error') {
            notification.style.background = '#f44336';
        } else {
            notification.style.background = '#2196F3';
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Initialize the editor when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const editor = new DocsEditor();
    editor.loadDocument();
});

// Handle beforeunload to warn about unsaved changes
window.addEventListener('beforeunload', (e) => {
    const lastSaved = document.getElementById('last-saved').textContent;
    if (lastSaved === 'Never saved') {
        e.preventDefault();
        e.returnValue = '';
    }
});
