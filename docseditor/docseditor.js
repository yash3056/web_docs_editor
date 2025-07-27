class DocsEditor {
    constructor() {
        console.log('🚀 DocsEditor constructor starting...');

        this.api = new DocumentAPI();
        this.editor = document.getElementById('editor');
        this.documentContainer = document.getElementById('document-container');
        this.pageIndicators = document.getElementById('page-indicators');
        this.documentTitle = document.getElementById('document-title');
        this.watermarkSettings = null;
        this.selectedImageData = null;
        this.pageHeight = 11 * 96; // 11 inches * 96 DPI
        this.currentPage = 1;
        this.totalPages = 1;
        this.serverAvailable = false;
        this.isNavigating = false; // Flag to track programmatic navigation
        this.autoSaveTimeout = null; // For debounced auto-save
        this.authToken = null;
        this.user = null;
        this.lastEditTime = Date.now(); // Track when user last edited
        this.isSaving = false; // Flag to prevent concurrent saves

        // Check authentication
        this.authToken = localStorage.getItem('authToken');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');

        if (!this.authToken || !this.user) {
            window.location.href = '../auth/login.html';
            return;
        }

        // Set up API authentication
        this.api.setAuthToken(this.authToken);

        console.log('📝 Editor element found:', !!this.editor);
        console.log('📄 Document title element found:', !!this.documentTitle);

        this.initializeEditor();
        this.initializeEventListeners();
        this.updateWordCount();
        this.history = [];
        this.historyIndex = -1;
        this.saveState();
        this.updateWatermarkButtonState();
        this.updatePageLayout();
        this.updateCurrentPage();
        this.checkServerStatus();
        this.setupAutoSave();
        this.setupCustomContextMenu();
        this.setupAIWritingEventListeners();
        this.setupRefinePopupEventListeners();

        // Add cleanup on page unload
        window.addEventListener('beforeunload', () => {
            this.cleanupAutoSave();
        });

        console.log('✅ DocsEditor initialized properly as Word-like editor');
    }

    async checkServerStatus() {
        console.log('=== CHECKING SERVER STATUS ===');
        try {
            console.log('Calling api.checkServerHealth()...');
            this.serverAvailable = await this.api.checkServerHealth();
            console.log('Server health check result:', this.serverAvailable);
            console.log('Server status:', this.serverAvailable ? 'Online' : 'Offline');
        } catch (error) {
            console.error('Server check error:', error);
            this.serverAvailable = false;
            console.log('Server check failed, using offline mode');
        }
        console.log('Final serverAvailable value:', this.serverAvailable);
    }

    initializeEditor() {
        if (this.editor) {
            this.editor.setAttribute('contenteditable', 'true');
            this.editor.setAttribute('spellcheck', 'true');

            // Add input event listener for real-time updates
            this.editor.addEventListener('input', () => {
                this.lastEditTime = Date.now(); // Track edit time
                this.updateWordCount();
                this.updatePageLayout();
                this.updateCurrentPage(); // Update cursor page position
                this.saveState();

                // Auto-save after a short delay to avoid too frequent saves
                clearTimeout(this.autoSaveTimeout);
                this.autoSaveTimeout = setTimeout(() => {
                    // Only auto-save if not currently saving
                    if (!this.isSaving) {
                        this.saveDocument(false); // Auto-save without notifications
                    }
                }, 5000); // Save 5 seconds after user stops typing (increased from 2)
            });

            // Add click event to ensure focus and update cursor page
            this.editor.addEventListener('click', () => {
                this.editor.focus();
                // Use setTimeout to ensure cursor position is updated after click
                setTimeout(() => {
                    this.updateCurrentPage();
                }, 10);
            });

            // Handle scroll to update current page
            this.editor.addEventListener('scroll', () => {
                this.updateCurrentPage();
            });

            // Track cursor movement with keyboard navigation
            this.editor.addEventListener('keyup', (e) => {
                // Update cursor page on arrow keys, page up/down, home/end
                const navigationKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                    'PageUp', 'PageDown', 'Home', 'End'];
                if (navigationKeys.includes(e.key)) {
                    setTimeout(() => {
                        this.updateCurrentPage();
                    }, 10);
                }
            });

            // Track selection changes (when user selects text with mouse or keyboard)
            document.addEventListener('selectionchange', () => {
                // Only update if the selection is within our editor
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    if (this.editor.contains(range.commonAncestorContainer)) {
                        setTimeout(() => {
                            this.updateCurrentPage();
                        }, 10);
                    }
                }
            });
        }
    }



    updateCurrentPage() {
        try {
            // Get cursor position to determine which page the cursor is on
            const selection = window.getSelection();
            if (selection.rangeCount === 0) {
                this.currentPage = 1;
                this.updatePageInfo();
                return 1;
            }

            const range = selection.getRangeAt(0);
            const cursorNode = range.startContainer;

            // Find the actual element containing the cursor
            let cursorElement = cursorNode.nodeType === Node.TEXT_NODE ?
                cursorNode.parentElement : cursorNode;

            // Make sure we're working within the editor
            if (!this.editor.contains(cursorElement)) {
                cursorElement = this.editor;
            }

            // Get the offset of the cursor element relative to the editor
            let offsetTop = 0;
            let element = cursorElement;

            while (element && element !== this.editor) {
                offsetTop += element.offsetTop || 0;
                element = element.offsetParent;
            }

            // Add any additional offset from the range within the element
            if (range.getBoundingClientRect) {
                const rect = range.getBoundingClientRect();
                const editorRect = this.editor.getBoundingClientRect();
                if (rect.top >= editorRect.top) {
                    offsetTop = rect.top - editorRect.top + this.editor.scrollTop;
                }
            }

            // Calculate which page based on the cursor position
            const pageHeight = this.pageHeight;
            const currentPage = Math.max(1, Math.floor(offsetTop / pageHeight) + 1);

            // Store current page and update display
            this.currentPage = currentPage;
            this.updatePageInfo();

            return currentPage;
        } catch (error) {
            console.warn('Error updating current page:', error);
            this.currentPage = 1;
            this.updatePageInfo();
            return 1;
        }
    }

    updatePageInfo() {
        const pageInfoElement = document.getElementById('page-info');
        if (pageInfoElement) {
            const currentPage = this.currentPage || 1;
            const totalPages = this.totalPages || 1;
            pageInfoElement.textContent = `Page ${currentPage} of ${totalPages}`;
        }
    }

    initializeEventListeners() {
        // Dashboard navigation
        const dashboardBtn = document.getElementById('dashboard-btn');
        if (dashboardBtn) {
            dashboardBtn.addEventListener('click', async () => {
                console.log('Dashboard button click detected');
                await this.goToDashboard();
            });
        } else {
            console.error('Dashboard button not found!');
        }

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

        // Version control
        document.getElementById('version-control-btn').addEventListener('click', () => this.openVersionControl());

        // Line spacing controls
        document.getElementById('line-spacing-btn').addEventListener('click', () => this.toggleLineSpacingMenu());
        this.setupLineSpacingEventListeners();

        // Save and export
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                console.log('💾 Save button clicked!');
                this.saveDocument();
            });
            console.log('✅ Save button event listener attached');
        } else {
            console.error('❌ Save button not found!');
        }

        document.getElementById('export-btn').addEventListener('click', () => this.toggleExportMenu());

        // Export options
        document.getElementById('export-html').addEventListener('click', () => this.exportAsHTML());
        document.getElementById('export-pdf').addEventListener('click', () => this.exportAsPDF());
        document.getElementById('export-docx').addEventListener('click', () => this.exportAsDOCX());

        // Close export menu when clicking outside
        document.addEventListener('click', (e) => {
            // Close export menu
            const exportDropdown = document.querySelector('.export-dropdown');
            const exportMenu = document.getElementById('export-menu');
            if (!exportDropdown?.contains(e.target)) {
                exportMenu?.classList.remove('show');
            }

            // Close line spacing menu
            const lineSpacingDropdown = document.querySelector('.line-spacing-dropdown');
            const lineSpacingMenu = document.getElementById('line-spacing-menu');
            if (!lineSpacingDropdown?.contains(e.target)) {
                lineSpacingMenu?.classList.remove('show');
            }
        });

        // Editor events
        this.editor.addEventListener('input', () => {
            this.updateWordCount();
            this.saveState();
        });

        this.editor.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
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

    // Line Spacing Methods
    toggleLineSpacingMenu() {
        const menu = document.getElementById('line-spacing-menu');
        menu.classList.toggle('show');
        
        // Close menu when clicking outside
        if (menu.classList.contains('show')) {
            setTimeout(() => {
                document.addEventListener('click', this.closeLineSpacingMenu.bind(this), { once: true });
            }, 0);
        }
    }

    closeLineSpacingMenu(event) {
        const dropdown = document.querySelector('.line-spacing-dropdown');
        const menu = document.getElementById('line-spacing-menu');
        
        if (!dropdown.contains(event.target)) {
            menu.classList.remove('show');
        }
    }

    setupLineSpacingEventListeners() {
        const menu = document.getElementById('line-spacing-menu');
        
        // Handle spacing option clicks
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const option = e.target.closest('.spacing-option');
            if (!option) return;

            const spacing = option.dataset.spacing;
            const id = option.id;

            if (spacing) {
                // Apply line spacing
                this.applyLineSpacing(parseFloat(spacing));
            } else if (id === 'line-spacing-options') {
                // Open detailed spacing modal
                this.showLineSpacingModal();
            } else if (id === 'add-space-before') {
                this.adjustParagraphSpacing('before', 12);
            } else if (id === 'remove-space-before') {
                this.adjustParagraphSpacing('before', 0);
            } else if (id === 'add-space-after') {
                this.adjustParagraphSpacing('after', 12);
            } else if (id === 'remove-space-after') {
                this.adjustParagraphSpacing('after', 0);
            }

            this.closeLineSpacingMenu({ target: document.body });
        });

        // Setup modal event listeners
        this.setupLineSpacingModalEvents();
    }

    applyLineSpacing(spacing) {
        console.log('Applying line spacing:', spacing);
        const selection = window.getSelection();
        
        if (selection.rangeCount === 0 || selection.toString().trim() === '') {
            // No selection or empty selection, apply to entire editor content
            console.log('No selection, applying to all content');
            this.applyLineSpacingToEditor(spacing);
        } else {
            // Apply to selected content
            console.log('Applying to selection');
            this.applySpacingToSelection(spacing);
        }

        this.updateLineSpacingButton(spacing);
        this.saveState();
    }

    applyLineSpacingToEditor(spacing) {
        // Apply to the editor itself first
        this.setElementLineSpacing(this.editor, spacing);
        
        // Also apply to all child block elements
        const blockElements = this.editor.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, blockquote');
        blockElements.forEach(element => {
            this.setElementLineSpacing(element, spacing);
        });
        
        console.log(`Applied line spacing ${spacing} to editor and ${blockElements.length} block elements`);
    }

    getCurrentParagraphElement() {
        const selection = window.getSelection();
        let element = selection.anchorNode;
        
        console.log('Starting from node:', element);
        
        // If text node, get parent element
        if (element && element.nodeType === Node.TEXT_NODE) {
            element = element.parentElement;
            console.log('Text node parent:', element);
        }

        // Find the paragraph-level element
        while (element && element !== this.editor) {
            console.log('Checking element:', element.tagName);
            if (this.isParagraphElement(element)) {
                console.log('Found paragraph element:', element.tagName);
                return element;
            }
            element = element.parentElement;
        }

        console.log('No paragraph element found, checking if editor has div children');
        
        // If we reach the editor and no paragraph found, 
        // check if content is directly in editor without proper block elements
        const firstChild = this.editor.firstElementChild;
        if (firstChild && this.isParagraphElement(firstChild)) {
            console.log('Found first child paragraph:', firstChild.tagName);
            return firstChild;
        }

        // If still no paragraph element, create one
        console.log('Creating paragraph element for content');
        return this.wrapContentInParagraph();
    }

    isParagraphElement(element) {
        const blockElements = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE'];
        return blockElements.includes(element.tagName);
    }

    wrapContentInParagraph() {
        // If there's loose text content in the editor, wrap it in a paragraph
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        
        // Get the current cursor position
        const currentNode = range.startContainer;
        
        // If we're in a text node directly in the editor
        if (currentNode.parentNode === this.editor || 
            (currentNode === this.editor && this.editor.childNodes.length > 0)) {
            
            // Create a paragraph element
            const p = document.createElement('p');
            
            // Move current content to the paragraph
            if (currentNode.nodeType === Node.TEXT_NODE) {
                // Wrap the text node
                const parent = currentNode.parentNode;
                parent.insertBefore(p, currentNode);
                p.appendChild(currentNode);
            } else if (currentNode === this.editor) {
                // Editor is selected, wrap all content
                while (this.editor.firstChild) {
                    p.appendChild(this.editor.firstChild);
                }
                this.editor.appendChild(p);
            }
            
            return p;
        }
        
        return null;
    }

    setElementLineSpacing(element, spacing) {
        // Use !important to override CSS defaults
        element.style.setProperty('line-height', spacing.toString(), 'important');
        console.log(`Applied line-height: ${spacing} to element:`, element.tagName, element);
    }

    applySpacingToSelection(spacing) {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        
        // Get all paragraph elements within the selection
        const elements = this.getParagraphElementsInRange(range);
        
        elements.forEach(element => {
            this.setElementLineSpacing(element, spacing);
        });
    }

    getParagraphElementsInRange(range) {
        const elements = [];
        const walker = document.createTreeWalker(
            range.commonAncestorContainer,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: (node) => {
                    if (this.isParagraphElement(node) && range.intersectsNode(node)) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_SKIP;
                }
            }
        );

        let node;
        while (node = walker.nextNode()) {
            elements.push(node);
        }

        return elements;
    }

    adjustParagraphSpacing(position, value) {
        const selection = window.getSelection();
        
        if (selection.rangeCount === 0) {
            const currentElement = this.getCurrentParagraphElement();
            if (currentElement) {
                this.setParagraphSpacing(currentElement, position, value);
            }
        } else {
            const range = selection.getRangeAt(0);
            const elements = this.getParagraphElementsInRange(range);
            elements.forEach(element => {
                this.setParagraphSpacing(element, position, value);
            });
        }

        this.saveState();
    }

    setParagraphSpacing(element, position, value) {
        const property = position === 'before' ? 'marginTop' : 'marginBottom';
        element.style[property] = value + 'pt';
    }

    updateLineSpacingButton(spacing) {
        // Update button text to show current spacing
        const btn = document.getElementById('line-spacing-btn');
        if (btn) {
            const icon = btn.querySelector('i:first-child');
            const chevron = btn.querySelector('i:last-child');
            
            // You could update the button to show current spacing
            // For now, we'll keep the icon as is
        }
    }

    showLineSpacingModal() {
        const modal = document.getElementById('line-spacing-modal');
        
        // Get current spacing values from selection
        this.populateLineSpacingModal();
        
        modal.style.display = 'block';
        
        // Focus first input
        setTimeout(() => {
            const firstInput = modal.querySelector('select, input');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    populateLineSpacingModal() {
        // Get current paragraph element to read existing values
        const currentElement = this.getCurrentParagraphElement();
        
        if (currentElement) {
            const computedStyle = window.getComputedStyle(currentElement);
            
            // Parse line height
            const lineHeight = computedStyle.lineHeight;
            if (lineHeight && lineHeight !== 'normal') {
                const fontSize = parseFloat(computedStyle.fontSize);
                const lineHeightValue = parseFloat(lineHeight);
                const ratio = lineHeightValue / fontSize;
                
                document.getElementById('line-spacing-value').value = ratio.toFixed(1);
                
                // Set appropriate type
                if (Math.abs(ratio - 1.0) < 0.1) {
                    document.getElementById('line-spacing-type').value = 'single';
                } else if (Math.abs(ratio - 1.5) < 0.1) {
                    document.getElementById('line-spacing-type').value = '1.5';
                } else if (Math.abs(ratio - 2.0) < 0.1) {
                    document.getElementById('line-spacing-type').value = 'double';
                } else {
                    document.getElementById('line-spacing-type').value = 'multiple';
                }
            }
            
            // Parse margins
            const marginTop = parseFloat(computedStyle.marginTop) || 0;
            const marginBottom = parseFloat(computedStyle.marginBottom) || 0;
            
            document.getElementById('space-before').value = Math.round(marginTop * 0.75); // Convert px to pt approximately
            document.getElementById('space-after').value = Math.round(marginBottom * 0.75);
        }
        
        this.updateSpacingPreview();
    }

    setupLineSpacingModalEvents() {
        // Type selection change
        document.getElementById('line-spacing-type').addEventListener('change', (e) => {
            const type = e.target.value;
            const valueInput = document.getElementById('line-spacing-value');
            const unitSpan = document.getElementById('line-spacing-unit');
            
            switch (type) {
                case 'single':
                    valueInput.value = '1.0';
                    valueInput.disabled = true;
                    unitSpan.textContent = 'lines';
                    break;
                case '1.5':
                    valueInput.value = '1.5';
                    valueInput.disabled = true;
                    unitSpan.textContent = 'lines';
                    break;
                case 'double':
                    valueInput.value = '2.0';
                    valueInput.disabled = true;
                    unitSpan.textContent = 'lines';
                    break;
                case 'multiple':
                    valueInput.disabled = false;
                    unitSpan.textContent = 'lines';
                    break;
                case 'at-least':
                    valueInput.disabled = false;
                    unitSpan.textContent = 'pt';
                    break;
                case 'exactly':
                    valueInput.disabled = false;
                    unitSpan.textContent = 'pt';
                    break;
            }
            this.updateSpacingPreview();
        });

        // Value changes
        ['line-spacing-value', 'space-before', 'space-after'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                this.updateSpacingPreview();
            });
        });

        // Checkbox change
        document.getElementById('dont-add-space').addEventListener('change', () => {
            this.updateSpacingPreview();
        });

        // Modal buttons
        document.getElementById('apply-spacing-btn').addEventListener('click', () => {
            this.applyDetailedSpacing();
            this.closeLineSpacingModal();
        });

        document.getElementById('cancel-spacing-btn').addEventListener('click', () => {
            this.closeLineSpacingModal();
        });

        // Close button
        const modal = document.getElementById('line-spacing-modal');
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeLineSpacingModal();
            });
        }

        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeLineSpacingModal();
            }
        });
    }

    updateSpacingPreview() {
        const preview = document.getElementById('spacing-preview');
        const type = document.getElementById('line-spacing-type').value;
        const value = parseFloat(document.getElementById('line-spacing-value').value) || 1.0;
        const spaceBefore = parseFloat(document.getElementById('space-before').value) || 0;
        const spaceAfter = parseFloat(document.getElementById('space-after').value) || 0;

        // Calculate line height
        let lineHeight;
        switch (type) {
            case 'single':
                lineHeight = '1.0';
                break;
            case '1.5':
                lineHeight = '1.5';
                break;
            case 'double':
                lineHeight = '2.0';
                break;
            case 'multiple':
                lineHeight = value.toString();
                break;
            case 'at-least':
                lineHeight = value + 'pt';
                break;
            case 'exactly':
                lineHeight = value + 'pt';
                break;
            default:
                lineHeight = '1.15';
        }

        // Apply styles to preview
        const paragraphs = preview.querySelectorAll('p');
        paragraphs.forEach((p, index) => {
            p.style.lineHeight = lineHeight;
            p.style.marginTop = (index === 0 ? 0 : spaceBefore) + 'pt';
            p.style.marginBottom = spaceAfter + 'pt';
        });
    }

    applyDetailedSpacing() {
        const type = document.getElementById('line-spacing-type').value;
        const value = parseFloat(document.getElementById('line-spacing-value').value) || 1.0;
        const spaceBefore = parseFloat(document.getElementById('space-before').value) || 0;
        const spaceAfter = parseFloat(document.getElementById('space-after').value) || 0;

        // Calculate line height
        let lineHeight;
        switch (type) {
            case 'single':
                lineHeight = 1.0;
                break;
            case '1.5':
                lineHeight = 1.5;
                break;
            case 'double':
                lineHeight = 2.0;
                break;
            case 'multiple':
                lineHeight = value;
                break;
            case 'at-least':
            case 'exactly':
                lineHeight = value + 'pt';
                break;
            default:
                lineHeight = 1.15;
        }

        // Apply to current selection or paragraph
        const selection = window.getSelection();
        
        if (selection.rangeCount === 0) {
            const currentElement = this.getCurrentParagraphElement();
            if (currentElement) {
                this.applyDetailedSpacingToElement(currentElement, lineHeight, spaceBefore, spaceAfter);
            }
        } else {
            const range = selection.getRangeAt(0);
            const elements = this.getParagraphElementsInRange(range);
            elements.forEach(element => {
                this.applyDetailedSpacingToElement(element, lineHeight, spaceBefore, spaceAfter);
            });
        }

        this.saveState();
        this.showNotification('Spacing applied successfully!', 'success');
    }

    applyDetailedSpacingToElement(element, lineHeight, spaceBefore, spaceAfter) {
        element.style.lineHeight = lineHeight.toString();
        element.style.marginTop = spaceBefore + 'pt';
        element.style.marginBottom = spaceAfter + 'pt';
    }

    closeLineSpacingModal() {
        const modal = document.getElementById('line-spacing-modal');
        modal.style.display = 'none';
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
            this.updateCurrentPage();
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
            this.updateCurrentPage();
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
        console.log('insertHTML called with:', html);

        // Ensure the editor has focus
        this.editor.focus();

        const selection = window.getSelection();
        console.log('Current selection range count:', selection.rangeCount);

        if (selection.rangeCount === 0) {
            console.log('No selection found, creating one at end of editor');
            // If no selection, create one at the end of the editor
            const range = document.createRange();
            range.selectNodeContents(this.editor);
            range.collapse(false); // Collapse to end
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            const range = selection.getRangeAt(0);
            console.log('Current selection start:', range.startContainer, 'offset:', range.startOffset);
        }

        // Try modern approach first
        if (document.queryCommandSupported && document.queryCommandSupported('insertHTML')) {
            try {
                console.log('Trying document.execCommand insertHTML');
                const result = document.execCommand('insertHTML', false, html);
                console.log('execCommand result:', result);
                if (result) {
                    this.saveState();
                    this.updatePageLayout();
                    return;
                }
            } catch (e) {
                console.warn('insertHTML failed, using fallback method:', e);
            }
        } else {
            console.log('insertHTML not supported, using fallback');
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
        this.updateCurrentPage();
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

    async saveDocument(showNotification = true) {
        // Prevent concurrent saves
        if (this.isSaving) {
            if (showNotification) {
                console.log('⏳ Save already in progress, skipping...');
            }
            return;
        }

        // Clear any pending auto-save timeout when manual save is triggered
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
            this.autoSaveTimeout = null;
        }

        return this.saveDocumentWithVersion(null, showNotification);
    }

    async saveDocumentWithVersion(commitMessage = null, showNotification = true) {
        // Prevent concurrent saves
        if (this.isSaving) {
            if (showNotification) {
                console.log('⏳ Save already in progress, skipping duplicate...');
            }
            return { success: false, reason: 'Save in progress' };
        }

        this.isSaving = true; // Set saving flag

        try {
            if (showNotification) {
                console.log('💾 Saving document...');
            }

            const title = this.documentTitle.value.trim() || 'Untitled Document';

            // Get content from the editor (single page mode)
            const editorContent = this.editor ? this.editor.innerHTML : '';

            // Don't save if content is just the placeholder text
            const isPlaceholderContent = editorContent === '<p>Start typing your document here...</p>' ||
                editorContent === '<p><br></p>' ||
                editorContent.trim() === '';

            const pagesContent = [editorContent]; // Wrap in array for compatibility

            const currentDocId = localStorage.getItem('currentDocumentId');

            // Calculate content hash for change detection
            const contentHash = this.calculateContentHash(editorContent, title);

            // Check if content has changed since last save
            const lastContentHash = localStorage.getItem('lastContentHash_' + (currentDocId || 'new'));
            const hasContentChanged = contentHash !== lastContentHash;

            // Also check if this is essentially empty content (for new documents)
            const isEmptyContent = editorContent.trim() === '' ||
                editorContent === '<p><br></p>' ||
                editorContent === '<br>' ||
                editorContent === '<p></p>' ||
                editorContent.replace(/<[^>]*>/g, '').trim() === '';

            // Get plain text content for additional validation
            const plainTextContent = editorContent.replace(/<[^>]*>/g, '').trim();
            const hasRealContent = plainTextContent.length > 0;

            if (showNotification) {
                console.log('🔍 Content analysis:', {
                    hasContentChanged,
                    isEmptyContent,
                    hasRealContent,
                    currentDocId: !!currentDocId,
                    lastContentHash: !!lastContentHash,
                    plainTextLength: plainTextContent.length
                });
            }

            // Skip saving if no changes detected OR if trying to save empty content for existing document
            if ((!hasContentChanged && currentDocId) || (isEmptyContent && lastContentHash) || (!hasRealContent && lastContentHash)) {
                if (showNotification) {
                    if (!hasContentChanged) {
                        console.log('📄 No content changes detected, skipping version creation');
                        this.showNotification('No changes to save', 'info');
                    } else if (!hasRealContent) {
                        console.log('📄 No real content detected, skipping version creation');
                        this.showNotification('Cannot save empty document', 'warning');
                    } else {
                        console.log('📄 Empty content detected, skipping version creation');
                        this.showNotification('Cannot save empty document', 'warning');
                    }
                }
                return { success: true, reason: hasContentChanged ? 'Empty content' : 'No changes detected' };
            }

            const document = {
                id: currentDocId || 'doc-' + Date.now(),
                title: title,
                content: pagesContent,
                description: '',
                lastModified: Date.now(),
                wordCount: this.countWords(editorContent),
                pageCount: 1
            };

            if (!currentDocId) {
                localStorage.setItem('currentDocumentId', document.id);
            }

            if (this.watermarkSettings) {
                document.watermark = this.watermarkSettings;
            }

            try {
                // Always try server save first when authenticated
                if (showNotification) {
                    console.log('🌐 Attempting server save...');
                }

                const result = await this.api.saveDocumentWithVersion(
                    document,
                    commitMessage || 'Document updated'
                );

                if (result && result.success) {
                    if (showNotification) {
                        console.log('✅ Document saved to server with version control');
                    }

                    // Store content hash to prevent duplicate saves
                    localStorage.setItem('lastContentHash_' + document.id, contentHash);

                    // Update current document ID if new
                    if (!currentDocId) {
                        localStorage.setItem('currentDocumentId', document.id);
                        if (showNotification) {
                            console.log('🆔 Set document ID:', document.id);
                        }
                    }

                    // Update UI
                    const now = new Date().toLocaleString();
                    const lastSavedElement = document.getElementById('last-saved');
                    if (lastSavedElement) {
                        lastSavedElement.textContent = `Last saved: ${now}`;
                    }

                    if (showNotification) {
                        this.showNotification('Document saved with version control!', 'success');
                    }

                    return result;
                } else {
                    throw new Error('Server save failed');
                }
            } catch (error) {
                console.error('Error saving document:', error);

                // Store content hash even for local save
                localStorage.setItem('lastContentHash_' + document.id, contentHash);

                // Fallback to local save
                this.saveDocumentLocally(document);

                if (showNotification) {
                    this.showNotification('Document saved locally (server error)', 'warning');
                }

                return { success: true, document };
            }
        } finally {
            this.isSaving = false; // Clear saving flag
        }
    }

    async saveDocumentOriginal(showNotification = true) {
        if (showNotification) {
            console.log('💾 Save button clicked');
        }

        const title = this.documentTitle.value.trim() || 'Untitled Document';

        // Get content from the editor (single page mode)
        const editorContent = this.editor ? this.editor.innerHTML : '';

        // Don't save if content is just the placeholder text
        const isPlaceholderContent = editorContent === '<p>Start typing your document here...</p>' ||
            editorContent === '<p><br></p>' ||
            editorContent.trim() === '';

        const pagesContent = [editorContent]; // Wrap in array for compatibility

        const currentDocId = localStorage.getItem('currentDocumentId');

        const document = {
            id: currentDocId || 'doc-' + Date.now(),
            title: title,
            content: pagesContent,
            description: '',
            lastModified: Date.now(),
            wordCount: this.countWords(editorContent),
            pageCount: 1
        };

        if (!currentDocId) {
            document.createdAt = Date.now();
            document.template = 'blank';
        }

        if (this.watermarkSettings) {
            document.watermark = this.watermarkSettings;
        }

        if (showNotification) {
            console.log('📄 Saving document:', document);
        }

        try {
            // Always try server save first when authenticated
            if (showNotification) {
                console.log('🌐 Attempting server save...');
            }
            const result = await this.api.saveDocument(document);

            if (result && result.success) {
                if (showNotification) {
                    console.log('✅ Document saved to server');
                }

                // Update current document ID if new
                if (!currentDocId) {
                    localStorage.setItem('currentDocumentId', document.id);
                    if (showNotification) {
                        console.log('🆔 Set document ID:', document.id);
                    }
                }

                // Update UI
                const now = new Date().toLocaleString();
                const lastSavedElement = document.getElementById('last-saved');
                if (lastSavedElement) {
                    lastSavedElement.textContent = `Last saved: ${now}`;
                }

                if (showNotification) {
                    this.showNotification('Document saved to server!', 'success');
                    console.log('✅ Document saved successfully:', document.title);
                }

                // Also save locally as backup
                this.saveDocumentLocally(document);
                return;
            } else {
                throw new Error('Server save failed');
            }

        } catch (error) {
            console.error('❌ Save error:', error);
            // Fallback to local save only
            this.saveDocumentLocally(document);
            if (showNotification) {
                this.showNotification('Document saved locally (server offline)', 'warning');
            }
        }
    }

    saveDocumentLocally(document) {
        // Save to localStorage
        const documents = JSON.parse(localStorage.getItem('documents') || '[]');
        const existingIndex = documents.findIndex(doc => doc.id === document.id);

        if (existingIndex !== -1) {
            documents[existingIndex] = document;
        } else {
            documents.unshift(document);
        }

        localStorage.setItem('documents', JSON.stringify(documents));

        // Legacy format for backward compatibility
        const legacyData = {
            title: document.title,
            content: document.content,
            watermark: this.watermarkSettings,
            lastModified: new Date().toISOString()
        };
        localStorage.setItem('webdocs_document', JSON.stringify(legacyData));
    }

    countWords(text) {
        if (!text) return 0;
        // Remove HTML tags and count words
        const plainText = text.replace(/<[^>]*>/g, '');
        return plainText.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    // Calculate a simple hash for content comparison
    calculateContentHash(content, title) {
        // Normalize content by removing extra whitespace and empty paragraphs
        const normalizedContent = content
            .replace(/<p><br><\/p>/g, '') // Remove empty paragraphs
            .replace(/<p><\/p>/g, '') // Remove empty paragraphs without br
            .replace(/<br>/g, '') // Remove standalone br tags
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();

        const combined = `${title}|||${normalizedContent}`;

        // Simple hash function
        let hash = 0;
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
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

    openVersionControl() {
        // Save current document state before opening version control
        const currentDoc = {
            id: localStorage.getItem('currentDocumentId'),
            title: this.documentTitle.value,
            content: [this.editor.innerHTML],
            lastModified: Date.now()
        };

        localStorage.setItem('currentDocument', JSON.stringify(currentDoc));

        // Open version control in same window
        window.location.href = '../version-control/version-control.html';
    }

    async goToDashboard() {
        console.log('Dashboard button clicked'); // Debug log

        try {
            // Set flag to indicate programmatic navigation
            this.isNavigating = true;

            // Clear any pending auto-saves
            this.cleanupAutoSave();

            // Save current document before navigating
            await this.saveDocument(false);

            console.log('Navigating to dashboard'); // Debug log
            // Navigate to dashboard
            window.location.href = '/dashboard';
        } catch (error) {
            console.error('Error in goToDashboard:', error);
            // Still navigate even if save fails
            console.log('Navigating to dashboard after error'); // Debug log
            window.location.href = '/dashboard';
        }
    }

    cleanupAutoSave() {
        // Clear the auto-save timeout
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
            this.autoSaveTimeout = null;
        }

        // Clear the auto-save interval
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    async loadDocument() {
        console.log('🔍 Loading document...');
        const currentDocId = localStorage.getItem('currentDocumentId');
        console.log('📄 Current document ID:', currentDocId);

        if (currentDocId) {
            try {
                // Try to load from server first
                console.log('🌐 Attempting to load from server...');
                const currentDoc = await this.api.getDocument(currentDocId);

                if (currentDoc) {
                    console.log('📖 Loading document from server:', currentDoc.title);
                    this.documentTitle.value = currentDoc.title;

                    // Handle both old format (single content) and new format (pages array)
                    if (Array.isArray(currentDoc.content)) {
                        // New multi-page format - use first page content for the editor
                        if (currentDoc.content.length > 0 && currentDoc.content[0]) {
                            this.editor.innerHTML = currentDoc.content[0];
                        } else {
                            this.editor.innerHTML = '';
                        }
                    } else {
                        // Old single-page format - put content directly in editor
                        this.editor.innerHTML = currentDoc.content || '';
                    }

                    // Clear default placeholder content if it's still there
                    if (this.editor.innerHTML.trim() === '' ||
                        this.editor.innerHTML === '<p>Start typing your document here...</p>' ||
                        this.editor.innerHTML === '<p><br></p>') {
                        this.editor.innerHTML = '';
                    }

                    this.updateWordCount();
                    this.updatePageLayout();
                    this.updateCurrentPage();

                    // Store initial content hash for change detection
                    const initialContentHash = this.calculateContentHash(this.editor.innerHTML, currentDoc.title);
                    localStorage.setItem('lastContentHash_' + currentDocId, initialContentHash);

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

                    console.log('✅ Document loaded successfully from server');
                    return;
                }
            } catch (error) {
                console.error('❌ Error loading document from server:', error);
            }

            // Fallback to localStorage if server fails
            console.log('📱 Falling back to localStorage...');
            const documents = JSON.parse(localStorage.getItem('documents') || '[]');
            console.log('📚 Found documents in localStorage:', documents.length);
            const currentDoc = documents.find(doc => doc.id === currentDocId);
            console.log('🎯 Found current document:', !!currentDoc);

            if (currentDoc) {
                console.log('📖 Loading document from localStorage:', currentDoc.title);
                this.documentTitle.value = currentDoc.title;

                // Handle both old format (single content) and new format (pages array)
                if (Array.isArray(currentDoc.content)) {
                    // New multi-page format - use first page content for the editor
                    if (currentDoc.content.length > 0 && currentDoc.content[0]) {
                        this.editor.innerHTML = currentDoc.content[0];
                    } else {
                        this.editor.innerHTML = '';
                    }
                } else {
                    // Old single-page format - put content directly in editor
                    this.editor.innerHTML = currentDoc.content || '';
                }

                // Clear default placeholder content if it's still there
                if (this.editor.innerHTML.trim() === '' ||
                    this.editor.innerHTML === '<p>Start typing your document here...</p>' ||
                    this.editor.innerHTML === '<p><br></p>') {
                    this.editor.innerHTML = '';
                }

                this.updateWordCount();
                this.updatePageLayout();
                this.updateCurrentPage();

                // Store initial content hash for change detection
                const initialContentHash = this.calculateContentHash(this.editor.innerHTML, currentDoc.title);
                localStorage.setItem('lastContentHash_' + currentDocId, initialContentHash);

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
            this.updatePageLayout();
            this.updateCurrentPage();

            // Store initial content hash for legacy documents
            const currentDocId = localStorage.getItem('currentDocumentId');
            if (currentDocId) {
                const initialContentHash = this.calculateContentHash(data.content, data.title);
                localStorage.setItem('lastContentHash_' + currentDocId, initialContentHash);
            }

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
        } else {
            // No document found, clear any default content and initialize hash
            this.editor.innerHTML = '';
            this.documentTitle.value = 'Untitled Document';

            // Initialize content hash for new document to prevent empty saves
            const currentDocId = localStorage.getItem('currentDocumentId');
            if (currentDocId) {
                const initialContentHash = this.calculateContentHash('', 'Untitled Document');
                localStorage.setItem('lastContentHash_' + currentDocId, initialContentHash);
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
            const editorContent = this.editor.innerHTML.trim();

            // Check if editor has content
            if (!editorContent || editorContent === '<p><br></p>' || editorContent === '<br>') {
                this.showNotification('No content to export', 'warning');
                return;
            }

            // Use the shared export utility
            await ExportUtils.exportContentAsPDF(editorContent, title, this.watermarkSettings);

            this.closeExportMenu();
            this.showNotification('PDF exported successfully!', 'success');

        } catch (error) {
            console.error('PDF export error:', error);
            this.showNotification('Error exporting PDF. Please try again.', 'error');
        }
    }

    async exportAsDOCX() {
        try {
            const title = this.documentTitle.value || 'document';

            // Check if editor has content
            const editorContent = this.editor.innerHTML.trim();
            if (!editorContent || editorContent === '<p><br></p>' || editorContent === '<br>') {
                this.showNotification('No content to export', 'warning');
                return;
            }

            // Check if docx library is available
            if (typeof docx === 'undefined' || !docx) {
                console.error('DOCX library not found');
                this.showNotification('DOCX library not available. Please refresh the page and try again.', 'error');
                return;
            }

            // Convert HTML content to plain text for DOCX
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = editorContent;

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
                        formatting.heading = level;
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

                const paragraphOptions = {
                    children: [textRun]
                };

                // Add heading level if it exists
                if (p.formatting.heading) {
                    switch (p.formatting.heading) {
                        case 1:
                            paragraphOptions.heading = HeadingLevel.HEADING_1;
                            break;
                        case 2:
                            paragraphOptions.heading = HeadingLevel.HEADING_2;
                            break;
                        case 3:
                            paragraphOptions.heading = HeadingLevel.HEADING_3;
                            break;
                        case 4:
                            paragraphOptions.heading = HeadingLevel.HEADING_4;
                            break;
                        case 5:
                            paragraphOptions.heading = HeadingLevel.HEADING_5;
                            break;
                        case 6:
                            paragraphOptions.heading = HeadingLevel.HEADING_6;
                            break;
                    }
                }

                return new Paragraph(paragraphOptions);
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
            console.error('Error details:', error.message);
            console.error('Stack trace:', error.stack);
            this.showNotification(`Failed to export DOCX: ${error.message}`, 'error');
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
        // Store reference to the interval for cleanup
        this.autoSaveInterval = setInterval(() => {
            // Only auto-save if user is not actively editing (debounce) and not currently saving
            if (!this.isSaving && Date.now() - this.lastEditTime > 5000) { // 5 seconds after last edit
                this.saveDocument(false); // Auto-save without notifications
            }
        }, 60000); // Auto-save every 60 seconds (increased from 30)
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

    updatePageLayout() {
        // Get the current content height
        const contentHeight = this.editor.scrollHeight;
        const pageHeight = 11 * 96; // 11 inches at 96 DPI  
        const requiredPages = Math.max(1, Math.ceil(contentHeight / pageHeight));

        // Store total pages for use in updateCurrentPage
        this.totalPages = requiredPages;

        // Update the combined page info (will be updated with current page by updateCurrentPage)
        this.updatePageInfo();

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

    setupCustomContextMenu() {
        const contextMenu = document.getElementById('custom-context-menu');

        // Disable default context menu on the editor
        this.editor.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showCustomContextMenu(e);
        });

        // Hide context menu when clicking elsewhere
        document.addEventListener('click', (e) => {
            if (!contextMenu.contains(e.target)) {
                this.hideCustomContextMenu();
            }
        });

        // Hide context menu on scroll
        this.editor.addEventListener('scroll', () => {
            this.hideCustomContextMenu();
        });

        // Hide context menu on window resize
        window.addEventListener('resize', () => {
            this.hideCustomContextMenu();
        });

        // Setup context menu item handlers
        this.setupContextMenuHandlers();
    }

    showCustomContextMenu(event) {
        console.log('=== SHOW CUSTOM CONTEXT MENU ===');
        const contextMenu = document.getElementById('custom-context-menu');
        const selection = window.getSelection();
        const hasSelection = selection.toString().length > 0;
        
        console.log('Has selection:', hasSelection);
        console.log('Selection text:', selection.toString());
        console.log('Selection range count:', selection.rangeCount);

        // Store the current selection to preserve it
        this.savedSelection = null;
        if (hasSelection && selection.rangeCount > 0) {
            this.savedSelection = {
                range: selection.getRangeAt(0).cloneRange(),
                text: selection.toString()
            };
            console.log('Saved selection:', this.savedSelection);
        } else {
            console.log('No selection to save');
        }

        // IMPORTANT: Store cursor position when context menu is shown (right-click)
        // This ensures we capture the position before any menu interactions
        this.storeCursorPosition();
        console.log('✅ Cursor position stored during context menu show');

        // Update menu items based on current state
        this.updateContextMenuState(hasSelection);

        // Position the menu
        const x = event.clientX;
        const y = event.clientY;

        // Show menu temporarily to get dimensions
        contextMenu.style.display = 'block';
        contextMenu.style.visibility = 'hidden';

        const menuRect = contextMenu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let menuX = x;
        let menuY = y;

        // Adjust horizontal position if menu would go off screen
        if (x + menuRect.width > viewportWidth) {
            menuX = Math.max(10, viewportWidth - menuRect.width - 10);
        }

        // Adjust vertical position if menu would go off screen
        if (y + menuRect.height > viewportHeight) {
            menuY = Math.max(10, viewportHeight - menuRect.height - 10);
        }

        // Apply final position and show menu
        contextMenu.style.left = `${menuX}px`;
        contextMenu.style.top = `${menuY}px`;
        contextMenu.style.visibility = 'visible';
    }

    hideCustomContextMenu() {
        const contextMenu = document.getElementById('custom-context-menu');
        contextMenu.style.display = 'none';
    }

    updateContextMenuState(hasSelection) {
        // Enable/disable menu items based on current state
        const cutItem = document.getElementById('context-cut');
        const copyItem = document.getElementById('context-copy');
        const boldItem = document.getElementById('context-bold');
        const italicItem = document.getElementById('context-italic');
        const underlineItem = document.getElementById('context-underline');
        const aiWritingItem = document.getElementById('context-ai-writing');
        const refineTextItem = document.getElementById('context-refine-text');

        // Cut and Copy only available when text is selected
        if (hasSelection) {
            cutItem.classList.remove('disabled');
            copyItem.classList.remove('disabled');
        } else {
            cutItem.classList.add('disabled');
            copyItem.classList.add('disabled');
        }

        // Show appropriate AI option based on selection
        if (hasSelection) {
            // Show refine text option when text is selected
            aiWritingItem.style.display = 'none';
            refineTextItem.style.display = 'flex';
        } else {
            // Show AI writing option when no text is selected
            aiWritingItem.style.display = 'flex';
            refineTextItem.style.display = 'none';
        }

        // Update formatting buttons based on current selection
        if (hasSelection) {
            boldItem.classList.toggle('active', document.queryCommandState('bold'));
            italicItem.classList.toggle('active', document.queryCommandState('italic'));
            underlineItem.classList.toggle('active', document.queryCommandState('underline'));
        } else {
            boldItem.classList.remove('active');
            italicItem.classList.remove('active');
            underlineItem.classList.remove('active');
        }
    }

    setupContextMenuHandlers() {
        // Cut
        document.getElementById('context-cut').addEventListener('click', () => {
            if (!document.getElementById('context-cut').classList.contains('disabled')) {
                document.execCommand('cut');
                this.saveState();
                this.updateWordCount();
            }
            this.hideCustomContextMenu();
        });

        // Copy
        document.getElementById('context-copy').addEventListener('click', () => {
            if (!document.getElementById('context-copy').classList.contains('disabled')) {
                document.execCommand('copy');
            }
            this.hideCustomContextMenu();
        });

        // Paste
        document.getElementById('context-paste').addEventListener('click', () => {
            this.editor.focus();
            document.execCommand('paste');
            this.saveState();
            this.updateWordCount();
            this.hideCustomContextMenu();
        });

        // Select All
        document.getElementById('context-select-all').addEventListener('click', () => {
            this.editor.focus();
            document.execCommand('selectAll');
            this.hideCustomContextMenu();
        });

        // Bold
        document.getElementById('context-bold').addEventListener('click', () => {
            this.formatText('bold');
            this.hideCustomContextMenu();
        });

        // Italic
        document.getElementById('context-italic').addEventListener('click', () => {
            this.formatText('italic');
            this.hideCustomContextMenu();
        });

        // Underline
        document.getElementById('context-underline').addEventListener('click', () => {
            this.formatText('underline');
            this.hideCustomContextMenu();
        });

        // Insert Link
        document.getElementById('context-insert-link').addEventListener('click', () => {
            this.showLinkModal();
            this.hideCustomContextMenu();
        });

        // Insert Image
        document.getElementById('context-insert-image').addEventListener('click', () => {
            this.showImageModal();
            this.hideCustomContextMenu();
        });

        // Word Count
        document.getElementById('context-word-count').addEventListener('click', () => {
            this.showWordCountDialog();
            this.hideCustomContextMenu();
        });

        // Save Document
        document.getElementById('context-save').addEventListener('click', () => {
            this.saveDocument();
            this.hideCustomContextMenu();
        });

        // AI Writing (when no text selected)
        document.getElementById('context-ai-writing').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showAIWritingPopup();
            this.hideCustomContextMenu();
        });

        // Refine text submenu handlers (when text is selected)
        const refineOptions = document.querySelectorAll('#refine-submenu .context-menu-item');
        console.log('Found refine options:', refineOptions.length);
        
        refineOptions.forEach((option, index) => {
            const action = option.getAttribute('data-action');
            console.log(`Setting up handler for option ${index}:`, action);
            
            option.addEventListener('click', (e) => {
                console.log('=== REFINE OPTION CLICKED ===');
                console.log('Clicked option:', action);
                console.log('Event:', e);
                
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Calling handleRefineText with action:', action);
                this.handleRefineText(action);
                this.hideCustomContextMenu();
            });
        });
    }

    handleRefineText(action) {
        console.log('=== HANDLE REFINE TEXT START ===');
        console.log('Action:', action);
        console.log('Saved selection exists:', !!this.savedSelection);
        
        // Check if we have saved selection
        if (!this.savedSelection || !this.savedSelection.text.trim()) {
            console.error('No saved selection or empty text');
            console.log('Saved selection:', this.savedSelection);
            this.showNotification('Please select text to refine', 'error');
            return;
        }

        const selectedText = this.savedSelection.text;
        console.log('Selected text to refine:', selectedText);
        console.log('Text length:', selectedText.length);

        // Restore the selection first
        const restored = this.restoreSelection();
        console.log('Selection restored:', restored);

        // Show loading state
        this.showNotification('Refining text...', 'info');

        // Call the refine API
        console.log('Calling refineSelectedText...');
        this.refineSelectedText(selectedText, action);
        console.log('=== HANDLE REFINE TEXT END ===');
    }

    restoreSelection() {
        if (this.savedSelection && this.savedSelection.range) {
            try {
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(this.savedSelection.range);
                this.editor.focus();
                return true;
            } catch (error) {
                console.warn('Failed to restore selection:', error);
                return false;
            }
        }
        return false;
    }

    async refineSelectedText(text, action) {
        console.log('=== REFINE SELECTED TEXT START ===');
        console.log('Input text:', text);
        console.log('Action:', action);
        console.log('Server available:', this.serverAvailable);
        
        try {
            // Check if server is available
            if (!this.serverAvailable) {
                console.error('Server not available');
                this.showNotification('AI service is not available', 'error');
                return;
            }

            // Prepare the prompt based on action
            let prompt = '';
            switch (action) {
                case 'rephrase':
                    prompt = `Please rephrase the following text while keeping the same meaning: "${text}"`;
                    break;
                case 'shorten':
                    prompt = `Please make the following text shorter and more concise: "${text}"`;
                    break;
                case 'formal':
                    prompt = `Please rewrite the following text in a more formal tone: "${text}"`;
                    break;
                case 'casual':
                    prompt = `Please rewrite the following text in a more casual tone: "${text}"`;
                    break;
                case 'bulletize':
                    prompt = `Please convert the following text into bullet points: "${text}"`;
                    break;
                case 'summarize':
                    prompt = `Please summarize the following text: "${text}"`;
                    break;
                default:
                    prompt = `Please improve the following text: "${text}"`;
            }

            console.log('Generated prompt:', prompt);

            // Store action title for popup
            let actionTitle = '';
            switch (action) {
                case 'rephrase': actionTitle = 'Rephrase'; break;
                case 'shorten': actionTitle = 'Shorten'; break;
                case 'formal': actionTitle = 'Formal'; break;
                case 'casual': actionTitle = 'Casual'; break;
                case 'bulletize': actionTitle = 'Bulletize'; break;
                case 'summarize': actionTitle = 'Summarize'; break;
                default: actionTitle = 'Improve'; break;
            }

            console.log('Action title:', actionTitle);

            // Call the AI API
            console.log('Calling API generateText...');
            const response = await this.api.generateText(prompt);
            console.log('API response received:', response);

            if (response && response.text) {
                console.log('Raw response text:', response.text);
                
                // Process the response to remove content before </think>
                let processedText = this.processAIResponse(response.text);
                console.log('Processed text:', processedText);
                
                // Show the refine results popup
                console.log('Showing refine results popup...');
                this.showRefineResultsPopup(processedText, actionTitle);
                console.log('Popup should be visible now');
            } else {
                console.error('No response or no text in response:', response);
                throw new Error('No response from AI service');
            }

        } catch (error) {
            console.error('=== ERROR IN REFINE SELECTED TEXT ===');
            console.error('Error details:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            this.showNotification('Failed to refine text. Please try again.', 'error');
        }
        
        console.log('=== REFINE SELECTED TEXT END ===');
    }

    processAIResponse(text) {
        // Remove everything before and including </think> tag
        const thinkEndIndex = text.indexOf('</think>');
        if (thinkEndIndex !== -1) {
            text = text.substring(thinkEndIndex + 8); // 8 is length of '</think>'
        }
        
        // Clean up any remaining whitespace
        return text.trim();
    }

    showRefineResultsPopup(text, actionTitle) {
        console.log('=== SHOW REFINE RESULTS POPUP START ===');
        console.log('Text to show:', text);
        console.log('Action title:', actionTitle);
        
        const popup = document.getElementById('refine-results-popup');
        const titleElement = document.getElementById('refine-title');
        const contentElement = document.getElementById('refine-content');
        
        console.log('Popup element found:', !!popup);
        console.log('Title element found:', !!titleElement);
        console.log('Content element found:', !!contentElement);
        
        if (!popup || !titleElement || !contentElement) {
            console.error('Required popup elements not found!');
            console.error('Popup:', popup);
            console.error('Title:', titleElement);
            console.error('Content:', contentElement);
            return;
        }
        
        // Set the title
        titleElement.textContent = actionTitle;
        console.log('Title set to:', actionTitle);
        
        // Convert markdown to HTML using Showdown
        console.log('Showdown available:', typeof showdown !== 'undefined');
        if (typeof showdown !== 'undefined') {
            try {
                const converter = new showdown.Converter();
                const htmlContent = converter.makeHtml(text);
                console.log('Converted HTML:', htmlContent);
                contentElement.innerHTML = htmlContent;
            } catch (showdownError) {
                console.error('Showdown conversion error:', showdownError);
                contentElement.textContent = text;
            }
        } else {
            // Fallback if Showdown is not loaded
            console.log('Using fallback text content');
            contentElement.textContent = text;
        }
        
        // Store the processed text for insertion
        this.currentRefinedText = text;
        console.log('Stored refined text:', this.currentRefinedText);
        
        // Position the popup in the center of the screen
        const x = window.innerWidth / 2 - 250; // Center horizontally (popup width is 500px)
        const y = window.innerHeight / 2 - 200; // Center vertically
        
        console.log('Positioning popup at:', x, y);
        popup.style.left = `${x}px`;
        popup.style.top = `${y}px`;
        popup.style.display = 'block';
        
        console.log('Popup display set to block');
        
        // Add show animation
        setTimeout(() => {
            popup.classList.add('show');
            console.log('Show class added to popup');
        }, 10);
        
        // Make popup draggable
        try {
            this.makeDraggable(popup);
            console.log('Popup made draggable');
        } catch (dragError) {
            console.error('Error making popup draggable:', dragError);
        }
        
        console.log('=== SHOW REFINE RESULTS POPUP END ===');
    }

    hideRefineResultsPopup() {
        const popup = document.getElementById('refine-results-popup');
        popup.classList.remove('show');
        setTimeout(() => popup.style.display = 'none', 200);
    }

    replaceSelectedText(newText) {
        if (this.restoreSelection()) {
            try {
                // Check if the text contains HTML tags
                const hasHtmlTags = /<[^>]*>/g.test(newText);
                
                if (hasHtmlTags) {
                    // Use insertHTML for rich content
                    document.execCommand('insertHTML', false, newText);
                } else {
                    // Use insertText for plain text
                    document.execCommand('insertText', false, newText);
                }

                // Update editor state
                this.updateWordCount();
                this.updatePageLayout();
                this.updateCurrentPage();
                this.saveState();

                // Clear saved selection
                this.savedSelection = null;

            } catch (error) {
                console.error('Error replacing text:', error);
                this.showNotification('Failed to replace text', 'error');
            }
        } else {
            // Fallback: insert at cursor position
            this.insertHTML(newText);
        }
    }

    showAIWritingPopup() {
        const popup = document.getElementById('ai-writing-popup');
        const input = document.getElementById('ai-input');

        // Cursor position is already stored when context menu was shown
        // No need to store it again here

        // Always center the popup on screen
        const x = window.innerWidth / 2 - 320; // Center horizontally (doubled width)
        const y = window.innerHeight / 2 - 150; // Center vertically

        popup.style.left = `${x}px`;
        popup.style.top = `${y}px`;
        popup.style.display = 'block';

        // Add show animation with a slight delay
        setTimeout(() => {
            popup.classList.add('show');
            // Focus input and clear previous content after animation starts
            input.value = '';
            input.focus();
        }, 20);

        // Make popup draggable
        this.makeDraggable(popup);
    }

    hideAIWritingPopup() {
        const popup = document.getElementById('ai-writing-popup');
        popup.classList.remove('show');
        setTimeout(() => popup.style.display = 'none', 200);
    }

    showAIResultsPopup() {
        const popup = document.getElementById('ai-results-popup');
        const writingPopup = document.getElementById('ai-writing-popup');

        // Position at same location as writing popup
        popup.style.left = writingPopup.style.left;
        popup.style.top = writingPopup.style.top;
        popup.style.display = 'block';

        // Add show animation
        setTimeout(() => popup.classList.add('show'), 10);

        // Make results popup draggable too
        this.makeDraggable(popup);

        // Hide writing popup
        this.hideAIWritingPopup();
    }

    hideAIResultsPopup() {
        const popup = document.getElementById('ai-results-popup');
        popup.classList.remove('show');
        setTimeout(() => popup.style.display = 'none', 200);
    }

    makeDraggable(popup) {
        // Try to find header with different class names
        const header = popup.querySelector('.ai-popup-header') || 
                      popup.querySelector('.refine-popup-header') ||
                      popup.querySelector('.popup-header');
        
        if (!header) {
            console.warn('No draggable header found for popup');
            return;
        }
        
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        header.style.cursor = 'move';
        header.style.userSelect = 'none';

        header.addEventListener('mousedown', (e) => {
            // Don't start dragging if clicking on close button
            if (e.target.closest('.ai-close-btn') || e.target.closest('.refine-close-btn')) return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(popup.style.left) || 0;
            startTop = parseInt(popup.style.top) || 0;

            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const newLeft = startLeft + (e.clientX - startX);
            const newTop = startTop + (e.clientY - startY);

            // Keep popup within viewport bounds
            const maxLeft = window.innerWidth - popup.offsetWidth;
            const maxTop = window.innerHeight - popup.offsetHeight;

            popup.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
            popup.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    storeCursorPosition() {
        try {
            console.log('=== STORING CURSOR POSITION ===');

            // Remove any existing cursor markers first
            this.removeCursorMarker();

            const selection = window.getSelection();
            console.log('Selection range count:', selection.rangeCount);

            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                console.log('Range start container:', range.startContainer.nodeName);
                console.log('Range start offset:', range.startOffset);
                console.log('Range collapsed:', range.collapsed);

                // Log the text content around the cursor for debugging
                if (range.startContainer.nodeType === Node.TEXT_NODE) {
                    const text = range.startContainer.textContent;
                    const before = text.substring(0, range.startOffset);
                    const after = text.substring(range.startOffset);
                    console.log('Text before cursor:', before);
                    console.log('Text after cursor:', after);
                }

                // Only store if it's within our editor
                if (this.editor.contains(range.startContainer) && this.editor.contains(range.endContainer)) {
                    // Insert a temporary marker at the cursor position
                    const marker = document.createElement('span');
                    marker.id = 'cursor-position-marker';
                    marker.style.display = 'none';
                    marker.textContent = '';

                    // Clone the range and insert the marker
                    const markerRange = range.cloneRange();
                    markerRange.collapse(true); // Collapse to start

                    try {
                        markerRange.insertNode(marker);
                        console.log('✅ Cursor marker inserted successfully using range.insertNode');

                        // Restore the selection after the marker
                        const newRange = document.createRange();
                        newRange.setStartAfter(marker);
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);

                    } catch (insertError) {
                        console.warn('Range insertNode failed, trying text splitting method:', insertError.message);

                        // Fallback: try text splitting method
                        if (range.startContainer.nodeType === Node.TEXT_NODE) {
                            const textNode = range.startContainer;
                            const parent = textNode.parentNode;
                            const offset = range.startOffset;

                            // Split the text node at cursor position
                            const beforeText = textNode.textContent.substring(0, offset);
                            const afterText = textNode.textContent.substring(offset);

                            // Replace the text node with before + marker + after
                            const beforeNode = document.createTextNode(beforeText);
                            const afterNode = document.createTextNode(afterText);

                            parent.insertBefore(beforeNode, textNode);
                            parent.insertBefore(marker, textNode);
                            parent.insertBefore(afterNode, textNode);
                            parent.removeChild(textNode);

                            console.log('✅ Cursor marker inserted using text splitting method');
                        } else {
                            throw insertError; // Re-throw if not a text node
                        }
                    }

                    return;
                } else {
                    console.warn('Selection is not within editor bounds');
                }
            } else {
                console.warn('No selection range found');
            }

            // Fallback: insert marker at end of editor
            console.log('Using fallback cursor position at end');
            const marker = document.createElement('span');
            marker.id = 'cursor-position-marker';
            marker.style.display = 'none';
            marker.textContent = '';
            this.editor.appendChild(marker);
            console.log('✅ Fallback marker inserted at end');

        } catch (error) {
            console.error('Error storing cursor position:', error);
        }
    }

    removeCursorMarker() {
        const existingMarker = document.getElementById('cursor-position-marker');
        if (existingMarker) {
            existingMarker.remove();
        }
    }

    findCursorMarker() {
        const marker = document.getElementById('cursor-position-marker');
        if (marker) {
            console.log('✅ Cursor marker found in DOM');
            console.log('Marker parent:', marker.parentNode ? (marker.parentNode.tagName || marker.parentNode.nodeName) : 'NO PARENT');
            console.log('Marker is in editor:', this.editor.contains(marker));
        } else {
            console.log('❌ Cursor marker NOT found in DOM');
        }
        return marker;
    }

    restoreCursorPosition() {
        if (this.savedRange) {
            try {
                // Validate that the saved range is still valid
                if (this.editor.contains(this.savedRange.startContainer) &&
                    this.editor.contains(this.savedRange.endContainer)) {

                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(this.savedRange);
                    this.editor.focus();
                    return true;
                }
            } catch (error) {
                console.warn('Saved range is invalid:', error);
            }
        }

        // Fallback: focus editor and place cursor at end
        this.editor.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(this.editor);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        return false;
    }

    getCurrentCursorPosition() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (this.editor.contains(range.startContainer) && this.editor.contains(range.endContainer)) {
                return range.cloneRange();
            }
        }
        return null;
    }

    async generateAIContent(prompt) {
        try {
            // Store original prompt for refinements
            this.currentPrompt = prompt;

            // Show loading state
            const resultsContent = document.getElementById('ai-generated-content');
            resultsContent.innerHTML = `
                <div class="ai-loading">
                    <div class="ai-loading-spinner"></div>
                    <span>Generating content...</span>
                </div>
            `;

            this.showAIResultsPopup();

            // Call the classification server for text generation
            const response = await fetch('/api/generate-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    prompt: prompt,
                    context: this.getDocumentContext()
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Extract content after </think> token
            let generatedText = data.generatedText || 'Sorry, I couldn\'t generate content for that prompt. Please try again.';

            // Look for </think> token and extract only content after it
            const thinkEndIndex = generatedText.indexOf('</think>');
            if (thinkEndIndex !== -1) {
                generatedText = generatedText.substring(thinkEndIndex + 8).trim(); // 8 is length of '</think>'
            }

            // If no content after </think> or empty, use fallback
            if (!generatedText || generatedText.length === 0) {
                generatedText = 'Sorry, I couldn\'t generate content for that prompt. Please try again.';
            }

            // Convert markdown to HTML for display
            const htmlContent = this.convertMarkdownToHTML(generatedText);

            // Display generated content as HTML
            resultsContent.innerHTML = htmlContent;

        } catch (error) {
            console.error('AI generation error:', error);

            // Fallback content for demo purposes
            const fallbackContent = this.generateFallbackContent(prompt);
            document.getElementById('ai-generated-content').innerHTML = fallbackContent;
        }
    }

    generateFallbackContent(prompt) {
        // Simple fallback content generator for demo
        const templates = {
            'world peace': 'At The Cymbal Foodie, we believe in the power of food to bring people together, transcending cultural differences and fostering understanding. Just as a shared meal can bridge divides, we hope our collective efforts, through authentic storytelling and a celebration of diverse culinary experiences, contribute to a world where respect and harmony are savored by all.',

            'business report': 'This quarterly report demonstrates significant progress in our key initiatives. Our team has successfully implemented new strategies that have resulted in improved performance metrics across all departments. Moving forward, we will continue to focus on innovation and customer satisfaction.',

            'introduction': 'Welcome to our comprehensive guide. In this document, we will explore the essential concepts and provide you with the knowledge needed to understand the subject matter thoroughly. Let\'s begin our journey together.',

            'conclusion': 'In conclusion, the evidence presented clearly supports our initial hypothesis. The findings demonstrate the effectiveness of our approach and provide a solid foundation for future development. We recommend continued investment in this area.',

            'default': `Based on your request about "${prompt}", here is some generated content that you can use as a starting point. This content is designed to help you get started with your writing and can be customized to fit your specific needs.`
        };

        // Find best match or use default
        const lowerPrompt = prompt.toLowerCase();
        for (const [key, content] of Object.entries(templates)) {
            if (lowerPrompt.includes(key)) {
                return content;
            }
        }

        return templates.default;
    }

    getDocumentContext() {
        // Get surrounding text for better AI context
        const selection = window.getSelection();
        let context = '';

        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;
            const paragraph = container.nodeType === Node.TEXT_NODE ?
                container.parentElement : container;

            // Get text from current paragraph and surrounding paragraphs
            context = paragraph.textContent || '';
        }

        return context.slice(0, 500); // Limit context length
    }

    convertMarkdownToHTML(markdown) {
        // Convert markdown to HTML
        let html = markdown
            // Headers
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            // Bold
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/__(.*?)__/gim, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/_(.*?)_/gim, '<em>$1</em>')
            // Bullet lists
            .replace(/^\* (.*$)/gim, '<li>$1</li>')
            .replace(/^- (.*$)/gim, '<li>$1</li>')
            // Numbered lists
            .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
            // Line breaks
            .replace(/\n\n/gim, '</p><p>')
            .replace(/\n/gim, '<br>');

        // Wrap consecutive <li> elements in <ul> or <ol>
        html = html.replace(/(<li>.*?<\/li>)/gims, function (match, p1) {
            if (match.includes('<li>') && !match.includes('<ul>') && !match.includes('<ol>')) {
                // Check if it's numbered list items (originally numbered)
                const isNumbered = markdown.includes('1. ') || markdown.includes('2. ') || markdown.includes('3. ');
                const tag = isNumbered ? 'ol' : 'ul';
                return `<${tag}>${match}</${tag}>`;
            }
            return match;
        });

        // Wrap in paragraphs if not already wrapped
        if (!html.includes('<p>') && !html.includes('<h') && !html.includes('<ul>') && !html.includes('<ol>')) {
            html = `<p>${html}</p>`;
        }

        return html;
    }

    insertAIContent() {
        const content = document.getElementById('ai-generated-content').innerHTML; // Use innerHTML to get formatted content

        if (content && content.trim()) {
            console.log('=== INSERTING AI CONTENT ===');
            console.log('Content to insert:', content);

            // Focus the editor first
            this.editor.focus();

            // Find the cursor marker
            const marker = this.findCursorMarker();

            if (marker) {
                console.log('✅ Found cursor marker');
                console.log('Marker parent:', marker.parentNode.tagName || marker.parentNode.nodeName);
                console.log('Marker parent text:', marker.parentNode.textContent.substring(0, 50) + '...');

                try {
                    // Create a temporary div to parse the HTML content
                    const temp = document.createElement('div');
                    temp.innerHTML = content;

                    // Insert each child node before the marker
                    const fragment = document.createDocumentFragment();
                    while (temp.firstChild) {
                        fragment.appendChild(temp.firstChild);
                    }

                    // Insert the content before the marker
                    marker.parentNode.insertBefore(fragment, marker);

                    // Remove the marker
                    marker.remove();

                    console.log('✅ AI content inserted successfully at marker position');

                    // Update editor state
                    this.saveState();
                    this.updateWordCount();
                    this.updatePageLayout();
                    this.hideAIResultsPopup();
                    return;

                } catch (error) {
                    console.error('❌ Error inserting at marker position:', error);
                    // Continue to fallback
                }
            } else {
                console.warn('❌ No cursor marker found, using fallback insertion');

                // Fallback: try to use current cursor position or insert at end
                const selection = window.getSelection();

                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);

                    // Make sure we're in the editor
                    if (this.editor.contains(range.startContainer)) {
                        console.log('Using current cursor position');

                        // Don't delete existing content - just collapse to insertion point
                        if (!range.collapsed) {
                            range.collapse(false);
                        }

                        // Try execCommand first
                        try {
                            const result = document.execCommand('insertHTML', false, content);
                            if (result) {
                                console.log('execCommand insertHTML succeeded');
                                this.saveState();
                                this.updateWordCount();
                                this.updatePageLayout();
                                this.hideAIResultsPopup();
                                return;
                            }
                        } catch (e) {
                            console.warn('execCommand failed:', e);
                        }

                        // Manual insertion fallback
                        try {
                            const temp = document.createElement('div');
                            temp.innerHTML = content;

                            const fragment = document.createDocumentFragment();
                            while (temp.firstChild) {
                                fragment.appendChild(temp.firstChild);
                            }

                            range.insertNode(fragment);
                            range.collapse(false);
                            selection.removeAllRanges();
                            selection.addRange(range);

                            console.log('Manual insertion succeeded');
                        } catch (error) {
                            console.error('Manual insertion failed:', error);
                            // Last resort: append to end
                            const temp = document.createElement('div');
                            temp.innerHTML = content;
                            while (temp.firstChild) {
                                this.editor.appendChild(temp.firstChild);
                            }
                        }
                    } else {
                        console.log('Selection not in editor, appending to end');
                        const temp = document.createElement('div');
                        temp.innerHTML = content;
                        while (temp.firstChild) {
                            this.editor.appendChild(temp.firstChild);
                        }
                    }
                } else {
                    console.log('No selection, appending to end of editor');
                    const temp = document.createElement('div');
                    temp.innerHTML = content;
                    while (temp.firstChild) {
                        this.editor.appendChild(temp.firstChild);
                    }
                }
            }

            // Update editor state
            this.saveState();
            this.updateWordCount();
            this.updatePageLayout();

            console.log('AI content insertion completed');

            // Hide popup
            this.hideAIResultsPopup();
        } else {
            console.warn('No AI content to insert');
        }
    }

    async refineAIContent(action) {
        // Get original prompt from stored value or input field
        const originalPrompt = this.currentPrompt || document.getElementById('ai-input').value || 'Please help me write content';

        // Create refinement prompts for each action
        let refinementPrompt = '';

        switch (action) {
            case 'shorten':
                refinementPrompt = `${originalPrompt}. Please make the response shorter and more concise.`;
                break;
            case 'elaborate':
                refinementPrompt = `${originalPrompt}. Please provide a more detailed and elaborate response.`;
                break;
            case 'formal':
                refinementPrompt = `${originalPrompt}. Please write in a more formal and professional tone.`;
                break;
            case 'casual':
                refinementPrompt = `${originalPrompt}. Please write in a more casual and conversational tone.`;
                break;
            case 'bulletize':
                refinementPrompt = `${originalPrompt}. Please format the response as bullet points in markdown format.`;
                break;
            case 'summarize':
                refinementPrompt = `${originalPrompt}. Please provide a brief summary.`;
                break;
            case 'retry':
                refinementPrompt = originalPrompt; // Just retry with original prompt
                break;
            default:
                refinementPrompt = originalPrompt;
        }

        // Call generateAIContent with the refined prompt
        await this.generateAIContent(refinementPrompt);
    }

    shortenText(text) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());
        return sentences.slice(0, Math.ceil(sentences.length / 2)).join('. ') + (sentences.length > 1 ? '.' : '');
    }

    elaborateText(text) {
        return text + ' Furthermore, this approach provides additional benefits and considerations that enhance the overall effectiveness and impact of the implementation.';
    }

    makeFormal(text) {
        return text
            .replace(/\bcan't\b/g, 'cannot')
            .replace(/\bwon't\b/g, 'will not')
            .replace(/\bdon't\b/g, 'do not')
            .replace(/\bi think\b/g, 'it is believed')
            .replace(/\bwe\b/g, 'one');
    }

    makeCasual(text) {
        return text
            .replace(/\bcannot\b/g, "can't")
            .replace(/\bwill not\b/g, "won't")
            .replace(/\bdo not\b/g, "don't")
            .replace(/\bit is believed\b/g, 'I think')
            .replace(/\bone believes\b/g, 'we think');
    }

    convertToBullets(text) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());
        return sentences.map(sentence => `• ${sentence.trim()}`).join('\n');
    }

    summarizeText(text) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());
        if (sentences.length <= 2) return text;

        const firstSentence = sentences[0].trim();
        const lastSentence = sentences[sentences.length - 1].trim();
        return `${firstSentence}. ${lastSentence}.`;
    }

    setupAIWritingEventListeners() {
        // Create button
        document.getElementById('ai-create-btn').addEventListener('click', () => {
            const prompt = document.getElementById('ai-input').value.trim();
            if (prompt) {
                this.generateAIContent(prompt);
            }
        });

        // Close buttons
        document.getElementById('ai-close-btn').addEventListener('click', () => {
            this.hideAIWritingPopup();
        });

        document.getElementById('ai-results-close-btn').addEventListener('click', () => {
            this.hideAIResultsPopup();
        });

        // Insert button
        document.getElementById('ai-insert-btn').addEventListener('click', () => {
            this.insertAIContent();
        });

        // Feedback buttons (visual only, no functionality as requested)
        document.getElementById('ai-thumbs-up').addEventListener('click', (e) => {
            e.target.closest('button').classList.toggle('active');
            document.getElementById('ai-thumbs-down').classList.remove('active');
        });

        document.getElementById('ai-thumbs-down').addEventListener('click', (e) => {
            e.target.closest('button').classList.toggle('active');
            document.getElementById('ai-thumbs-up').classList.remove('active');
        });

        // Refine button
        document.getElementById('ai-refine-btn').addEventListener('click', () => {
            const options = document.getElementById('ai-refine-options');
            options.style.display = options.style.display === 'none' ? 'block' : 'none';
        });

        // Refine options
        document.querySelectorAll('.refine-option').forEach(option => {
            option.addEventListener('click', async () => {
                const action = option.dataset.action;
                await this.refineAIContent(action);
                document.getElementById('ai-refine-options').style.display = 'none';
            });
        });

        // Enter key in input
        document.getElementById('ai-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                document.getElementById('ai-create-btn').click();
            }
        });

        // Click outside to close popups
        document.addEventListener('click', (e) => {
            // Don't close if clicking on context menu
            if (e.target.closest('#custom-context-menu')) {
                return;
            }

            const writingPopup = document.getElementById('ai-writing-popup');
            const resultsPopup = document.getElementById('ai-results-popup');

            if (!writingPopup.contains(e.target) && !resultsPopup.contains(e.target)) {
                if (writingPopup.style.display === 'block') {
                    this.hideAIWritingPopup();
                }
                if (resultsPopup.style.display === 'block') {
                    this.hideAIResultsPopup();
                }
            }
        });
    }

    setupRefinePopupEventListeners() {
        // Close button
        document.getElementById('refine-close-btn').addEventListener('click', () => {
            this.hideRefineResultsPopup();
        });

        // Insert button
        document.getElementById('refine-insert-btn').addEventListener('click', () => {
            if (this.currentRefinedText) {
                // Convert markdown to plain text for insertion
                let textToInsert = this.currentRefinedText;
                if (typeof showdown !== 'undefined') {
                    const converter = new showdown.Converter();
                    const htmlContent = converter.makeHtml(textToInsert);
                    // Create a temporary div to extract text content
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = htmlContent;
                    textToInsert = tempDiv.innerHTML; // Keep HTML for rich text insertion
                }
                
                this.replaceSelectedText(textToInsert);
                this.hideRefineResultsPopup();
                this.showNotification('Text refined and inserted successfully!', 'success');
            }
        });

        // Feedback buttons
        document.getElementById('refine-thumbs-up').addEventListener('click', (e) => {
            e.target.closest('button').classList.toggle('active');
            document.getElementById('refine-thumbs-down').classList.remove('active');
        });

        document.getElementById('refine-thumbs-down').addEventListener('click', (e) => {
            e.target.closest('button').classList.toggle('active');
            document.getElementById('refine-thumbs-up').classList.remove('active');
        });

        // Refine dropdown toggle
        document.getElementById('refine-action-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('refine-dropdown-menu');
            const isVisible = dropdown.style.display === 'block';
            dropdown.style.display = isVisible ? 'none' : 'block';
        });

        // Refine dropdown options
        document.querySelectorAll('.refine-dropdown-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = item.getAttribute('data-action');
                
                // Hide dropdown
                document.getElementById('refine-dropdown-menu').style.display = 'none';
                
                // Perform refinement
                if (this.savedSelection) {
                    try {
                        this.showNotification('Refining text...', 'info');
                        await this.refineSelectedText(this.savedSelection.text, action);
                    } catch (error) {
                        console.error('Error with dropdown refine:', error);
                        this.showNotification('Failed to refine text', 'error');
                    }
                }
            });
        });

        // Refine with custom prompt
        document.getElementById('refine-prompt-input').addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const promptInput = e.target;
                const customPrompt = promptInput.value.trim();
                
                if (customPrompt && this.savedSelection) {
                    try {
                        this.showNotification('Refining with custom prompt...', 'info');
                        const fullPrompt = `${customPrompt}: "${this.savedSelection.text}"`;
                        const response = await this.api.generateText(fullPrompt);
                        
                        if (response && response.text) {
                            const processedText = this.processAIResponse(response.text);
                            this.showRefineResultsPopup(processedText, 'Custom');
                            promptInput.value = ''; // Clear the input
                        }
                    } catch (error) {
                        console.error('Error with custom refine:', error);
                        this.showNotification('Failed to refine with custom prompt', 'error');
                    }
                }
            }
        });

        // Click outside to close popup and dropdown
        document.addEventListener('click', (e) => {
            const refinePopup = document.getElementById('refine-results-popup');
            const dropdown = document.getElementById('refine-dropdown-menu');
            
            // Close dropdown if clicking outside
            if (!e.target.closest('.refine-dropdown')) {
                dropdown.style.display = 'none';
            }
            
            // Close popup if clicking outside
            if (!refinePopup.contains(e.target) && !e.target.closest('#custom-context-menu')) {
                if (refinePopup.style.display === 'block') {
                    this.hideRefineResultsPopup();
                }
            }
        });
    }

    showWordCountDialog() {
        const text = this.editor.innerText || '';
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const characters = text.length;
        const charactersNoSpaces = text.replace(/\s/g, '').length;
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

        const message = `Document Statistics:
        
Words: ${words}
Characters (with spaces): ${characters}
Characters (no spaces): ${charactersNoSpaces}
Paragraphs: ${paragraphs}`;

        alert(message);
    }
}

// Initialize the editor when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    window.docsEditor = new DocsEditor();
    await window.docsEditor.loadDocument();
    console.log('✅ DocsEditor initialized and available globally');
});

// Handle beforeunload to warn about unsaved changes
window.addEventListener('beforeunload', (e) => {
    // Don't show warning if we're navigating programmatically
    if (window.docsEditor && window.docsEditor.isNavigating) {
        return;
    }

    // Check if there's actual content and it hasn't been saved
    const editor = document.getElementById('editor');
    const lastSaved = document.getElementById('last-saved');

    if (editor && lastSaved) {
        const hasContent = editor.innerHTML.trim() && editor.innerHTML !== '<p><br></p>' && editor.innerHTML !== '<br>';
        const neverSaved = lastSaved.textContent === 'Never saved' || lastSaved.textContent.includes('Never saved');

        // Only show warning if there's actual content and it's never been saved
        if (hasContent && neverSaved) {
            e.preventDefault();
            e.returnValue = '';
        }
    }
});
