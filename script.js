class DocsEditor {
    constructor() {
        this.editor = document.getElementById('editor');
        this.documentContainer = document.getElementById('document-container');
        this.pageIndicators = document.getElementById('page-indicators');
        this.documentTitle = document.getElementById('document-title');
        this.watermarkSettings = null;
        this.selectedImageData = null;
        this.pageHeight = 11 * 96; // 11 inches * 96 DPI
        this.currentPage = 1;
        
        this.initializeEditor();
        this.initializeEventListeners();
        this.updateWordCount();
        this.history = [];
        this.historyIndex = -1;
        this.saveState();
        this.updateWatermarkButtonState();
        this.updatePageLayout();
        
        console.log('DocsEditor initialized properly as Word-like editor');
    }

    initializeEditor() {
        if (this.editor) {
            this.editor.setAttribute('contenteditable', 'true');
            this.editor.setAttribute('spellcheck', 'true');
            
            // Add input event listener for real-time updates
            this.editor.addEventListener('input', () => {
                this.updateWordCount();
                this.updatePageLayout();
                this.saveState();
            });
            
            // Add click event to ensure focus
            this.editor.addEventListener('click', () => {
                this.editor.focus();
            });

            // Handle scroll to update current page
            this.editor.addEventListener('scroll', () => {
                this.updateCurrentPage();
            });
        }
    }

     updatePageCount() {
        // Calculate page count based on content height
        const editorHeight = this.editor.scrollHeight;
        const pageHeight = this.pageHeight;
        const numberOfPages = Math.ceil(editorHeight / pageHeight);
        
        // Update page count display
        const pageCountElement = document.getElementById('page-count');
        if (pageCountElement) {
            pageCountElement.textContent = `Pages: ${numberOfPages}`;
        }
        
        return numberOfPages;
    }

    updateCurrentPage() {
        // This can be used for showing current page in status bar
        const scrollTop = this.editor.scrollTop || window.scrollY;
        const pageHeight = this.pageHeight;
        const currentPage = Math.floor(scrollTop / pageHeight) + 1;
        
        // Could update a status indicator here if needed
        return currentPage;
    }

    updatePageCount(pageCount) {
        // This function is now redundant since updatePageCount() above handles it
        // Remove this to avoid confusion
    }

    initializeEventListeners() {
        // Dashboard navigation
        document.getElementById('dashboard-btn').addEventListener('click', () => this.goToDashboard());
        
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

        // Watermark toggle (add/remove)
        document.getElementById('watermark-btn').addEventListener('click', () => this.toggleWatermark());

        // Save and export
        document.getElementById('save-btn').addEventListener('click', () => this.saveDocument());
        document.getElementById('export-btn').addEventListener('click', () => this.toggleExportMenu());
        
        // Export options
        document.getElementById('export-html').addEventListener('click', () => this.exportAsHTML());
        document.getElementById('export-pdf').addEventListener('click', () => this.exportAsPDF());
        document.getElementById('export-docx').addEventListener('click', () => this.exportAsDOCX());

        // Close export menu when clicking outside
        document.addEventListener('click', (e) => {
            const exportDropdown = document.querySelector('.export-dropdown');
            const exportMenu = document.getElementById('export-menu');
            if (!exportDropdown.contains(e.target)) {
                exportMenu.classList.remove('show');
            }
        });

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
        this.editor.focus();
        document.execCommand(command, false, value);
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
        
        // Update page count will be called by updatePageBreaks
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
            this.updatePageLayout();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = this.history[this.historyIndex];
            this.editor.innerHTML = state.content;
            this.documentTitle.value = state.title;
            this.updateWordCount();
            this.updatePageLayout();
        }
    }

    showLinkModal() {
        const modal = document.getElementById('link-modal');
        const selectedText = window.getSelection().toString();
        document.getElementById('link-text').value = selectedText;
        modal.style.display = 'block';
    }

    setupImageModalEvents() {
        // Tab switching
        const urlTab = document.getElementById('url-tab');
        const uploadTab = document.getElementById('upload-tab');
        const urlContent = document.getElementById('url-content');
        const uploadContent = document.getElementById('upload-content');

        urlTab.addEventListener('click', () => {
            urlTab.classList.add('active');
            uploadTab.classList.remove('active');
            urlContent.classList.add('active');
            uploadContent.classList.remove('active');
        });

        uploadTab.addEventListener('click', () => {
            uploadTab.classList.add('active');
            urlTab.classList.remove('active');
            uploadContent.classList.add('active');
            urlContent.classList.remove('active');
        });

        // File input handling
        const fileInput = document.getElementById('image-file');
        const dropZone = document.getElementById('file-drop-zone');
        const preview = document.getElementById('image-preview');
        const previewImg = document.getElementById('preview-img');
        const fileName = document.getElementById('file-name');
        const fileSize = document.getElementById('file-size');

        // Click to browse
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleImageFile(file);
            }
        });

        // Drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.type.startsWith('image/')) {
                    fileInput.files = files;
                    this.handleImageFile(file);
                } else {
                    this.showNotification('Please select an image file', 'error');
                }
            }
        });

        // Insert image button
        document.getElementById('insert-image-btn').addEventListener('click', () => {
            this.insertImage();
        });

        // Cancel button
        document.getElementById('cancel-image-btn').addEventListener('click', () => {
            this.resetImageModal();
            document.getElementById('image-modal').style.display = 'none';
        });
    }

    handleImageFile(file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showNotification('Please select an image file', 'error');
            return;
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            this.showNotification('Image file is too large. Maximum size is 5MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const previewImg = document.getElementById('preview-img');
            const fileName = document.getElementById('file-name');
            const fileSize = document.getElementById('file-size');
            const preview = document.getElementById('image-preview');

            // Set image source and ensure proper sizing
            previewImg.src = e.target.result;
            previewImg.onload = () => {
                // Ensure the image doesn't break the modal layout
                previewImg.style.maxWidth = '100%';
                previewImg.style.maxHeight = '150px';
                previewImg.style.objectFit = 'contain';
                
                // Force modal to recalculate scroll if needed
                const modalBody = document.querySelector('#image-modal .modal-body');
                if (modalBody) {
                    modalBody.scrollTop = modalBody.scrollTop; // Trigger scroll update
                }
            };
            
            fileName.textContent = file.name;
            fileSize.textContent = this.formatFileSize(file.size);
            preview.style.display = 'flex'; // Use flex for better centering

            // Store the image data for insertion
            this.selectedImageData = e.target.result;
            
            // Scroll the modal body to show the preview
            const modalBody = document.querySelector('#image-modal .modal-body');
            if (modalBody) {
                setTimeout(() => {
                    modalBody.scrollTop = modalBody.scrollHeight;
                }, 100);
            }
        };

        reader.readAsDataURL(file);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    insertImage() {
        const urlTab = document.getElementById('url-tab');
        const alt = document.getElementById('image-alt').value || 'Image';
        const width = document.getElementById('image-width').value;

        let imageSrc = '';
        let widthStyle = width ? `width: ${width}px; ` : '';

        if (urlTab.classList.contains('active')) {
            // URL tab is active
            imageSrc = document.getElementById('image-url').value;
            if (!imageSrc) {
                this.showNotification('Please enter an image URL', 'error');
                return;
            }
        } else {
            // Upload tab is active
            if (!this.selectedImageData) {
                this.showNotification('Please select an image file', 'error');
                return;
            }
            imageSrc = this.selectedImageData;
        }

        // Ensure the editor has focus before inserting
        this.editor.focus();
        
        // Create the image HTML with better styling
        const img = `<img src="${imageSrc}" alt="${alt}" style="${widthStyle}max-width: 100%; height: auto; border-radius: 4px; margin: 0.5rem 0; display: block;">`;
        
        console.log('Inserting image:', img); // Debug log
        
        try {
            this.insertHTML(img);
            this.resetImageModal();
            document.getElementById('image-modal').style.display = 'none';
            this.showNotification('Image inserted successfully!', 'success');
            
            // Force editor to update and trigger any change events
            this.editor.dispatchEvent(new Event('input'));
            this.updateWordCount();
            
        } catch (error) {
            console.error('Error inserting image:', error);
            this.showNotification('Failed to insert image. Please try again.', 'error');
        }
    }

    resetImageModal() {
        // Reset URL tab
        document.getElementById('image-url').value = '';
        
        // Reset upload tab
        document.getElementById('image-file').value = '';
        document.getElementById('image-preview').style.display = 'none';
        document.getElementById('preview-img').src = '';
        
        // Reset common fields
        document.getElementById('image-alt').value = '';
        document.getElementById('image-width').value = '';
        
        // Reset to URL tab
        document.getElementById('url-tab').classList.add('active');
        document.getElementById('upload-tab').classList.remove('active');
        document.getElementById('url-content').classList.add('active');
        document.getElementById('upload-content').classList.remove('active');
        
        // Clear stored image data
        this.selectedImageData = null;
    }

    showImageModal() {
        this.resetImageModal();
        const modal = document.getElementById('image-modal');
        modal.style.display = 'block';
        
        // Ensure modal body starts at top and focus first input
        setTimeout(() => {
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.scrollTop = 0; // Start at top
            }
            // Focus on the first input for better UX
            const firstInput = modal.querySelector('input[type="url"], input[type="text"]');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);
    }

    showWatermarkModal() {
        const modal = document.getElementById('watermark-modal');
        modal.style.display = 'block';
        
        // Update range value displays
        this.updateRangeValue('watermark-opacity', 'opacity-value', '');
        this.updateRangeValue('watermark-angle', 'angle-value', '°');
    }

    // Toggle between adding and removing watermark
    toggleWatermark() {
        if (this.watermarkSettings) {
            this.removeWatermark();
        } else {
            this.showWatermarkModal();
        }
    }

    updateRangeValue(rangeId, displayId, suffix = '') {
        const range = document.getElementById(rangeId);
        const display = document.getElementById(displayId);
        display.textContent = range.value + suffix;
        
        range.addEventListener('input', () => {
            display.textContent = range.value + suffix;
        });
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
        this.setupImageModalEvents();

        // Watermark modal events
        document.getElementById('apply-watermark-btn').addEventListener('click', () => {
            const text = document.getElementById('watermark-text').value;
            const opacity = document.getElementById('watermark-opacity').value;
            const size = document.getElementById('watermark-size').value;
            const color = document.getElementById('watermark-color').value;
            const angle = document.getElementById('watermark-angle').value;
            
            if (text.trim()) {
                this.applyWatermark(text, opacity, size, color, angle);
                document.getElementById('watermark-modal').style.display = 'none';
            } else {
                this.showNotification('Please enter watermark text', 'error');
            }
        });

        document.getElementById('remove-watermark-btn').addEventListener('click', () => {
            this.removeWatermark();
            document.getElementById('watermark-modal').style.display = 'none';
        });

        document.getElementById('cancel-watermark-btn').addEventListener('click', () => {
            document.getElementById('watermark-modal').style.display = 'none';
        });
    }

    insertHTML(html) {
        // Ensure the editor has focus
        this.editor.focus();
        
        const selection = window.getSelection();
        
        if (selection.rangeCount === 0) {
            // If no selection, create one at the end of the editor
            const range = document.createRange();
            range.selectNodeContents(this.editor);
            range.collapse(false); // Collapse to end
            selection.removeAllRanges();
            selection.addRange(range);
        }
        
        // Try modern approach first
        if (document.queryCommandSupported && document.queryCommandSupported('insertHTML')) {
            try {
                const result = document.execCommand('insertHTML', false, html);
                if (result) {
                    this.saveState();
                    this.updatePageLayout();
                    return;
                }
            } catch (e) {
                console.warn('insertHTML failed, using fallback method:', e);
            }
        }
        
        // Fallback method that works better with modern browsers
        try {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            
            // Create a temporary element to parse the HTML
            const temp = document.createElement('div');
            temp.innerHTML = html;
            
            // Create document fragment and move nodes
            const fragment = document.createDocumentFragment();
            while (temp.firstChild) {
                fragment.appendChild(temp.firstChild);
            }
            
            // Insert the fragment
            range.insertNode(fragment);
            
            // Move cursor after inserted content
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
            
        } catch (e) {
            console.warn('Range-based insertion failed, using direct DOM manipulation:', e);
            
            // Last resort: direct DOM manipulation
            const temp = document.createElement('div');
            temp.innerHTML = html;
            
            // Get the cursor position or append to end
            let insertPoint = this.editor;
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
                    insertPoint = range.commonAncestorContainer.parentNode;
                } else {
                    insertPoint = range.commonAncestorContainer;
                }
            }
            
            // Ensure we're inserting into the editor
            if (!this.editor.contains(insertPoint)) {
                insertPoint = this.editor;
            }
            
            // Insert the content
            while (temp.firstChild) {
                insertPoint.appendChild(temp.firstChild);
            }
        }
        
        this.saveState();
        this.updatePageLayout();
    }

    applyWatermark(text, opacity, size, color, angle) {
        // Remove existing watermark
        this.removeWatermark();
        
        // Create watermark element
        const watermark = document.createElement('div');
        watermark.className = 'watermark';
        watermark.id = 'document-watermark';
        
        const watermarkText = document.createElement('div');
        watermarkText.className = 'watermark-text';
        watermarkText.textContent = text;
        
        // Apply styles based on settings
        const sizeMap = {
            small: '36px',
            medium: '48px',
            large: '60px'
        };
        
        watermarkText.style.fontSize = sizeMap[size];
        watermarkText.style.color = color;
        watermarkText.style.opacity = opacity;
        watermarkText.style.transform = `rotate(${angle}deg)`;
        
        watermark.appendChild(watermarkText);
        
        // Insert watermark into editor container
        const editorContainer = document.querySelector('.editor-container');
        editorContainer.appendChild(watermark);
        
        // Save watermark settings
        this.watermarkSettings = {
            text,
            opacity,
            size,
            color,
            angle
        };
        
        // Update toolbar button state
        this.updateWatermarkButtonState();
        
        this.showNotification('Watermark applied successfully!', 'success');
    }

    removeWatermark() {
        const existingWatermark = document.getElementById('document-watermark');
        if (existingWatermark) {
            existingWatermark.remove();
            this.watermarkSettings = null;
            this.showNotification('Watermark removed successfully!', 'success');
            
            // Update toolbar button state
            this.updateWatermarkButtonState();
        } else {
            this.showNotification('No watermark to remove', 'info');
        }
    }

    updateWatermarkButtonState() {
        const watermarkBtn = document.getElementById('watermark-btn');
        const icon = watermarkBtn.querySelector('i');
        if (this.watermarkSettings) {
            watermarkBtn.classList.add('active');
            watermarkBtn.title = 'Remove Watermark';
            if (icon.classList.contains('fa-tint')) {
                icon.classList.replace('fa-tint', 'fa-tint-slash');
            }
        } else {
            watermarkBtn.classList.remove('active');
            watermarkBtn.title = 'Add Watermark';
            if (icon.classList.contains('fa-tint-slash')) {
                icon.classList.replace('fa-tint-slash', 'fa-tint');
            }
        }
    }

    saveDocument() {
        const title = this.documentTitle.value.trim() || 'Untitled Document';
        const pagesContent = this.pages.map(page => page.innerHTML);
        const currentDocId = localStorage.getItem('currentDocumentId');
        
        if (currentDocId) {
            // Update existing document in dashboard storage
            const documents = JSON.parse(localStorage.getItem('documents') || '[]');
            const docIndex = documents.findIndex(doc => doc.id === currentDocId);
            
            if (docIndex !== -1) {
                documents[docIndex].title = title;
                documents[docIndex].content = pagesContent; // Store as array of pages
                documents[docIndex].lastModified = Date.now();
                documents[docIndex].wordCount = this.countWordsFromPages(pagesContent);
                documents[docIndex].pageCount = this.pages.length;
                if (this.watermarkSettings) {
                    documents[docIndex].watermark = this.watermarkSettings;
                }
                localStorage.setItem('documents', JSON.stringify(documents));
            }
        } else {
            // Check document limit before creating new document
            const documents = JSON.parse(localStorage.getItem('documents') || '[]');
            const maxDocuments = 20;
            
            if (documents.length >= maxDocuments) {
                this.showAlert(`Document limit reached! You can store up to ${maxDocuments} documents. Please delete some documents from the dashboard first.`, 'error');
                return;
            }

            // Create new document if none selected
            const newDoc = {
                id: 'doc-' + Date.now(),
                title: title,
                content: pagesContent, // Store as array of pages
                description: '',
                createdAt: Date.now(),
                lastModified: Date.now(),
                template: 'blank',
                wordCount: this.countWords(content)
            };
            
            if (this.watermarkSettings) {
                newDoc.watermark = this.watermarkSettings;
            }
            
            documents.unshift(newDoc);
            localStorage.setItem('documents', JSON.stringify(documents));
            localStorage.setItem('currentDocumentId', newDoc.id);
        }
        
        // Also save to legacy format for backward compatibility
        const legacyData = {
            title: title,
            content: content,
            watermark: this.watermarkSettings,
            lastModified: new Date().toISOString()
        };
        localStorage.setItem('webdocs_document', JSON.stringify(legacyData));
        
        const now = new Date().toLocaleString();
        document.getElementById('last-saved').textContent = `Last saved: ${now}`;
        
        this.showNotification('Document saved successfully!', 'success');
    }

    countWords(text) {
        if (!text) return 0;
        // Remove HTML tags and count words
        const plainText = text.replace(/<[^>]*>/g, '');
        return plainText.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    countWordsFromPages(pagesContent) {
        let totalText = '';
        pagesContent.forEach(pageContent => {
            // Remove HTML tags and get plain text
            const temp = document.createElement('div');
            temp.innerHTML = pageContent;
            totalText += (temp.textContent || temp.innerText || '') + ' ';
        });
        return totalText.trim() ? totalText.trim().split(/\s+/).length : 0;
    }

    goToDashboard() {
        console.log('Dashboard button clicked'); // Debug log
        
        // Save current document before navigating
        this.saveDocument();
        
        // Small delay to ensure save completes
        setTimeout(() => {
            console.log('Navigating to dashboard'); // Debug log
            // Navigate to dashboard
            window.location.href = 'index.html';
        }, 300);
    }

    loadDocument() {
        const currentDocId = localStorage.getItem('currentDocumentId');
        
        if (currentDocId) {
            // Load document from dashboard storage
            const documents = JSON.parse(localStorage.getItem('documents') || '[]');
            const currentDoc = documents.find(doc => doc.id === currentDocId);
            
            if (currentDoc) {
                this.documentTitle.value = currentDoc.title;
                
                // Handle both old format (single content) and new format (pages array)
                if (Array.isArray(currentDoc.content)) {
                    // New multi-page format
                    currentDoc.content.forEach((pageContent, index) => {
                        if (index === 0) {
                            // Update first page
                            this.pages[0].innerHTML = pageContent;
                        } else {
                            // Create additional pages
                            const newPageContent = this.createNewPage();
                            newPageContent.innerHTML = pageContent;
                        }
                    });
                } else {
                    // Old single-page format - put content in first page
                    this.pages[0].innerHTML = currentDoc.content;
                }
                
                this.updateWordCount();
                
                // Restore watermark if it exists
                if (currentDoc.watermark) {
                    this.watermarkSettings = currentDoc.watermark;
                    this.applyWatermark(
                        currentDoc.watermark.text,
                        currentDoc.watermark.opacity,
                        currentDoc.watermark.size,
                        currentDoc.watermark.color,
                        currentDoc.watermark.angle
                    );
                } else {
                    this.updateWatermarkButtonState();
                }
                
                return;
            }
        }
        
        // Fallback: try to load from legacy storage
        const saved = localStorage.getItem('webdocs_document');
        if (saved) {
            const data = JSON.parse(saved);
            this.documentTitle.value = data.title;
            this.editor.innerHTML = data.content;
            this.updateWordCount();
            
            // Restore watermark if it exists
            if (data.watermark) {
                this.watermarkSettings = data.watermark;
                this.applyWatermark(
                    data.watermark.text,
                    data.watermark.opacity,
                    data.watermark.size,
                    data.watermark.color,
                    data.watermark.angle
                );
            } else {
                this.updateWatermarkButtonState();
            }
        }
    }

    toggleExportMenu() {
        const exportMenu = document.getElementById('export-menu');
        exportMenu.classList.toggle('show');
    }

    exportAsHTML() {
        const title = this.documentTitle.value || 'document';
        const content = this.editor.innerHTML;
        
        // Generate watermark CSS if watermark exists
        let watermarkCSS = '';
        if (this.watermarkSettings) {
            const settings = this.watermarkSettings;
            const sizeMap = {
                small: '36px',
                medium: '48px',
                large: '60px'
            };
            
            watermarkCSS = `
        .watermark {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
            z-index: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
        .watermark-text {
            font-size: ${sizeMap[settings.size]};
            font-weight: bold;
            color: ${settings.color};
            opacity: ${settings.opacity};
            transform: rotate(${settings.angle}deg);
            user-select: none;
            white-space: nowrap;
            letter-spacing: 0.1em;
        }
        .content-wrapper {
            position: relative;
            z-index: 1;
        }`;
        }
        
        const watermarkHTML = this.watermarkSettings ? 
            `<div class="watermark"><div class="watermark-text">${this.watermarkSettings.text}</div></div>` : '';
        
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
            position: relative;
        }
        h1, h2, h3, h4, h5, h6 { margin: 1.5rem 0 1rem 0; }
        p { margin: 1rem 0; }
        ul, ol { margin: 1rem 0; padding-left: 2rem; }
        img { max-width: 100%; height: auto; }${watermarkCSS}
    </style>
</head>
<body>
    ${watermarkHTML}
    <div class="content-wrapper">
        ${content}
    </div>
</body>
</html>`;

        this.downloadFile(html, `${title}.html`, 'text/html');
        this.closeExportMenu();
        this.showNotification('HTML document exported successfully!', 'success');
    }

    async exportAsPDF() {
        try {
            const title = this.documentTitle.value || 'document';
            
            // Create a temporary container for rendering
            const tempContainer = document.createElement('div');
            tempContainer.style.cssText = `
                position: absolute;
                top: -9999px;
                left: -9999px;
                width: 8.5in;
                background: white;
                padding: 1in;
                font-family: 'Times New Roman', serif;
                font-size: 12pt;
                line-height: 1.5;
                color: #000;
                box-sizing: border-box;
            `;
            
            // Clone editor content
            const content = this.editor.cloneNode(true);
            content.style.cssText = `
                margin: 0; 
                padding: 0;
                font-family: inherit;
                font-size: inherit;
                line-height: inherit;
                color: inherit;
            `;
            tempContainer.appendChild(content);
            document.body.appendChild(tempContainer);
            
            try {
                // Convert to canvas with optimized settings
                const canvas = await html2canvas(tempContainer, {
                    scale: 1.5,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    removeContainer: true,
                    imageTimeout: 0,
                    logging: false,
                    width: tempContainer.offsetWidth,
                    height: tempContainer.offsetHeight
                });
                
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF('p', 'mm', 'a4');
                
                const imgData = canvas.toDataURL('image/jpeg', 0.8);
                
                // Calculate page dimensions
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const imgWidth = pdfWidth;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                
                let position = 0;
                let heightLeft = imgHeight;
                
                // Add first page
                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;
                
                // Add additional pages if needed
                while (heightLeft >= 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pdfHeight;
                }
                
                // Add watermark if exists
                if (this.watermarkSettings) {
                    const pageCount = pdf.internal.getNumberOfPages();
                    for (let i = 1; i <= pageCount; i++) {
                        pdf.setPage(i);
                        this.addWatermarkToPDF(pdf, pdfWidth, pdfHeight);
                    }
                }
                
                pdf.save(`${title}.pdf`);
                this.closeExportMenu();
                this.showNotification('PDF exported successfully!', 'success');
                
            } catch (renderError) {
                console.error('Error rendering PDF:', renderError);
                this.showNotification('Error rendering PDF. Please try again.', 'error');
            }
            
            document.body.removeChild(tempContainer);
            
        } catch (error) {
            console.error('PDF export error:', error);
            this.showNotification('Error exporting PDF. Please try again.', 'error');
        }
    }

    addWatermarkToPDF(pdf, pdfWidth, pdfHeight) {
        const settings = this.watermarkSettings;
        pdf.saveGraphicsState();
        
        // Set transparency
        pdf.setGState(new pdf.GState({opacity: settings.opacity}));
        
        // Set font and color
        const sizeMap = { small: 36, medium: 48, large: 60 };
        pdf.setFontSize(sizeMap[settings.size] || 48);
        pdf.setTextColor(settings.color);
        
        // Calculate center position
        const centerX = pdfWidth / 2;
        const centerY = pdfHeight / 2;
        
        // Add rotated text
        pdf.text(settings.text, centerX, centerY, {
            angle: settings.angle,
            align: 'center',
            baseline: 'middle'
        });
        
        pdf.restoreGraphicsState();
    }

    async exportAsDOCX() {
        try {
            const title = this.documentTitle.value || 'document';
            
            // Collect content from all pages
            let allContent = '';
            this.pages.forEach((page, index) => {
                if (index > 0) {
                    allContent += '\n\n--- Page ' + (index + 1) + ' ---\n\n';
                }
                allContent += page.innerHTML;
            });
            
            // Convert HTML content to plain text for DOCX
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = allContent;
            
            // Extract text content and basic formatting
            const paragraphs = [];
            const elements = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, li');
            
            elements.forEach(element => {
                let text = element.textContent.trim();
                if (text) {
                    const tagName = element.tagName.toLowerCase();
                    let formatting = {};
                    
                    // Handle headings
                    if (tagName.startsWith('h')) {
                        const level = parseInt(tagName.slice(1));
                        formatting.heading = `Heading${level}`;
                        formatting.size = Math.max(24 - (level * 2), 14);
                        formatting.bold = true;
                    }
                    
                    // Handle lists
                    if (tagName === 'li') {
                        text = '• ' + text;
                    }
                    
                    paragraphs.push({ text, formatting });
                }
            });
            
            // If no structured content, use plain text
            if (paragraphs.length === 0) {
                const plainText = tempDiv.textContent.trim();
                if (plainText) {
                    plainText.split('\n').forEach(line => {
                        if (line.trim()) {
                            paragraphs.push({ text: line.trim(), formatting: {} });
                        }
                    });
                }
            }
            
            // Create DOCX document using docx library
            const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;
            
            const docParagraphs = paragraphs.map(p => {
                const textRun = new TextRun({
                    text: p.text,
                    bold: p.formatting.bold || false,
                    size: (p.formatting.size || 12) * 2 // DOCX uses half-points
                });
                
                const paragraph = new Paragraph({
                    children: [textRun]
                });
                
                if (p.formatting.heading) {
                    paragraph.heading = HeadingLevel[`HEADING_${p.formatting.heading.slice(-1)}`];
                }
                
                return paragraph;
            });
            
            // Add watermark text if exists
            if (this.watermarkSettings) {
                docParagraphs.unshift(new Paragraph({
                    children: [new TextRun({
                        text: `[Watermark: ${this.watermarkSettings.text}]`,
                        italics: true,
                        color: "CCCCCC"
                    })]
                }));
            }
            
            const doc = new Document({
                sections: [{
                    properties: {},
                    children: docParagraphs
                }]
            });
            
            const blob = await Packer.toBlob(doc);
            this.downloadBlob(blob, `${title}.docx`);
            this.closeExportMenu();
            this.showNotification('DOCX document exported successfully!', 'success');
            
        } catch (error) {
            console.error('DOCX export error:', error);
            this.showNotification('Failed to export DOCX. Please try again.', 'error');
        }
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        this.downloadBlob(blob, filename);
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    closeExportMenu() {
        const exportMenu = document.getElementById('export-menu');
        exportMenu.classList.remove('show');
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

    showAlert(message, type = 'info') {
        // Remove existing alert
        const existingAlert = document.querySelector('.editor-alert');
        if (existingAlert) {
            existingAlert.remove();
        }

        // Create alert element
        const alert = document.createElement('div');
        alert.className = `editor-alert editor-alert-${type}`;
        
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            info: '#007bff',
            warning: '#ffc107'
        };

        alert.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 400px;
            font-size: 14px;
            animation: slideInRight 0.3s ease-out;
        `;

        alert.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; font-size: 16px; cursor: pointer; margin-left: auto;">&times;</button>
            </div>
        `;

        // Add animation styles if not already added
        if (!document.querySelector('#alert-styles')) {
            const style = document.createElement('style');
            style.id = 'alert-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(alert);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.style.animation = 'slideInRight 0.3s ease-out reverse';
                setTimeout(() => alert.remove(), 300);
            }
        }, 5000);
    }

    // Test method for debugging image insertion
    testImageInsertion() {
        console.log('Testing image insertion...');
        console.log('Editor element:', this.editor);
        console.log('Editor contentEditable:', this.editor.contentEditable);
        console.log('Current selection:', window.getSelection());
        
        // Try inserting a simple test image
        const testImg = '<img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwZiIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+VGVzdDwvdGV4dD48L3N2Zz4=" alt="Test Image" style="max-width: 100px;">';
        this.insertHTML(testImg);
    }

    updatePageLayout() {
        // Get the current content height
        const contentHeight = this.editor.scrollHeight;
        const pageHeight = 11 * 96; // 11 inches at 96 DPI  
        const requiredPages = Math.max(1, Math.ceil(contentHeight / pageHeight));
        
        // Update page count in status bar
        const pageCountElement = document.getElementById('page-count');
        if (pageCountElement) {
            pageCountElement.textContent = `Pages: ${requiredPages}`;
        }
        
        // Create visual page indicators
        this.updatePageIndicators(requiredPages);
        
        // Ensure editor is tall enough for content
        const minHeight = requiredPages * pageHeight;
        if (this.editor.style.minHeight !== minHeight + 'px') {
            this.editor.style.minHeight = minHeight + 'px';
        }
    }
    
    updatePageIndicators(pageCount) {
        if (!this.pageIndicators) return;
        
        // Clear existing indicators
        this.pageIndicators.innerHTML = '';
        
        // Add page indicators at page boundaries (like Word)
        for (let i = 1; i < pageCount; i++) {
            const indicator = document.createElement('div');
            indicator.className = 'page-indicator';
            indicator.style.top = (i * 11 * 96) + 'px'; // Position at page boundary
            indicator.setAttribute('data-page', i + 1);
            this.pageIndicators.appendChild(indicator);
        }
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
