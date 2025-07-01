class DocsEditor {
    constructor() {
        this.editor = document.getElementById('editor');
        this.documentTitle = document.getElementById('document-title');
        this.watermarkSettings = null;
        this.initializeEventListeners();
        this.updateWordCount();
        // this.setupAutoSave();
        this.history = [];
        this.historyIndex = -1;
        this.saveState();
        this.updateWatermarkButtonState();
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
        const data = {
            title: this.documentTitle.value,
            content: this.editor.innerHTML,
            watermark: this.watermarkSettings,
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
                // Ensure button state is correct when no watermark
                this.updateWatermarkButtonState();
            }
            
            const lastModified = new Date(data.lastModified).toLocaleString();
            document.getElementById('last-saved').textContent = `Last saved: ${lastModified}`;
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
                width: 800px;
                background: white;
                padding: 40px;
                font-family: Arial, sans-serif;
                line-height: 1.6;
            `;
            
            // Clone editor content
            const content = this.editor.cloneNode(true);
            content.style.cssText = 'margin: 0; padding: 0;';
            tempContainer.appendChild(content);
            
            // Add watermark if exists
            if (this.watermarkSettings) {
                const watermark = document.createElement('div');
                watermark.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    pointer-events: none;
                    z-index: 0;
                `;
                
                const watermarkText = document.createElement('div');
                const settings = this.watermarkSettings;
                const sizeMap = { small: '36px', medium: '48px', large: '60px' };
                
                watermarkText.textContent = settings.text;
                watermarkText.style.cssText = `
                    font-size: ${sizeMap[settings.size]};
                    font-weight: bold;
                    color: ${settings.color};
                    opacity: ${settings.opacity};
                    transform: rotate(${settings.angle}deg);
                    user-select: none;
                    white-space: nowrap;
                    letter-spacing: 0.1em;
                `;
                
                watermark.appendChild(watermarkText);
                tempContainer.appendChild(watermark);
                content.style.position = 'relative';
                content.style.zIndex = '1';
            }
            
            document.body.appendChild(tempContainer);
            
            // Use html2canvas to render the content
            const canvas = await html2canvas(tempContainer, {
                scale: 2,
                useCORS: true,
                allowTaint: true
            });
            
            document.body.removeChild(tempContainer);
            
            // Create PDF using jsPDF
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            const imgWidth = 210;
            const pageHeight = 295;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            
            let position = 0;
            
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
            
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }
            
            pdf.save(`${title}.pdf`);
            this.closeExportMenu();
            this.showNotification('PDF document exported successfully!', 'success');
            
        } catch (error) {
            console.error('PDF export error:', error);
            this.showNotification('Failed to export PDF. Please try again.', 'error');
        }
    }

    async exportAsDOCX() {
        try {
            const title = this.documentTitle.value || 'document';
            const content = this.editor.innerHTML;
            
            // Convert HTML content to plain text for DOCX
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;
            
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
