// Export utilities shared between DocsEditor and Dashboard

class ExportUtils {
    static async exportContentAsPDF(content, title, watermarkSettings = null) {
        try {
            // Check if content exists
            if (!content || content.trim() === '<p><br></p>' || content.trim() === '<br>') {
                throw new Error('No content to export');
            }
            
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            // Set up page dimensions
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 20; // 20mm margins
            const contentWidth = pageWidth - (margin * 2);
            const contentHeight = pageHeight - (margin * 2);
            
            let yPosition = margin;
            const lineHeight = 6; // 6mm line height
            const fontSize = 12;
            
            // Set default font
            pdf.setFontSize(fontSize);
            pdf.setFont('helvetica', 'normal');
            
            // Convert HTML to text with basic formatting
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;
            
            // Process all elements
            const processedElements = [];
            function walkElements(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent.trim();
                    if (text) {
                        processedElements.push({ text, formatting: { bold: false, italic: false, fontSize: 12 }, type: 'text' });
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const tagName = node.tagName.toLowerCase();
                    
                    if (tagName === 'p' || tagName.startsWith('h')) {
                        const text = node.textContent.trim();
                        if (text) {
                            let formatting = { bold: false, italic: false, fontSize: 12 };
                            
                            if (tagName === 'h1') {
                                formatting.fontSize = 18;
                                formatting.bold = true;
                            } else if (tagName === 'h2') {
                                formatting.fontSize = 16;
                                formatting.bold = true;
                            } else if (tagName === 'h3') {
                                formatting.fontSize = 14;
                                formatting.bold = true;
                            }
                            
                            processedElements.push({ text, formatting, type: tagName });
                        }
                    } else if (tagName === 'li') {
                        const text = '• ' + node.textContent.trim();
                        if (text !== '• ') {
                            processedElements.push({ text, formatting: { bold: false, italic: false, fontSize: 12 }, type: 'li' });
                        }
                    } else if (tagName === 'br') {
                        processedElements.push({ text: '', formatting: { bold: false, italic: false, fontSize: 12 }, type: 'br' });
                    } else {
                        // Process children
                        for (let child of node.childNodes) {
                            walkElements(child);
                        }
                    }
                }
            }
            
            walkElements(tempDiv);
            
            // If no processed elements, fall back to plain text
            if (processedElements.length === 0) {
                const plainText = tempDiv.textContent.trim();
                if (plainText) {
                    plainText.split('\n').forEach(line => {
                        if (line.trim()) {
                            processedElements.push({ 
                                text: line.trim(), 
                                formatting: { bold: false, italic: false, fontSize: 12 }, 
                                type: 'text' 
                            });
                        }
                    });
                }
            }
            
            // Add text to PDF
            for (let element of processedElements) {
                if (element.type === 'br') {
                    yPosition += lineHeight;
                    continue;
                }
                
                if (!element.text) continue;
                
                // Set font based on formatting
                const fontStyle = element.formatting.bold ? 'bold' : 'normal';
                pdf.setFont('helvetica', fontStyle);
                pdf.setFontSize(element.formatting.fontSize);
                
                // Calculate line height based on font size
                const currentLineHeight = element.formatting.fontSize * 0.5;
                
                // Split text into lines that fit the page width
                const lines = pdf.splitTextToSize(element.text, contentWidth);
                
                for (let line of lines) {
                    // Check if we need a new page
                    if (yPosition + currentLineHeight > pageHeight - margin) {
                        pdf.addPage();
                        yPosition = margin;
                    }
                    
                    // Add the text line
                    pdf.text(line, margin, yPosition);
                    yPosition += currentLineHeight;
                }
                
                // Add extra space after paragraphs and headings
                if (element.type === 'p' || element.type.startsWith('h')) {
                    yPosition += currentLineHeight * 0.5;
                }
            }
            
            // Add watermark if exists
            if (watermarkSettings) {
                const pageCount = pdf.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    pdf.setPage(i);
                    this.addWatermarkToPDF(pdf, pageWidth, pageHeight, watermarkSettings);
                }
            }
            
            pdf.save(`${title}.pdf`);
            return { success: true };
            
        } catch (error) {
            console.error('PDF export error:', error);
            throw error;
        }
    }
    
    static addWatermarkToPDF(pdf, pdfWidth, pdfHeight, watermarkSettings) {
        pdf.saveGraphicsState();
        
        // Set transparency
        pdf.setGState(new pdf.GState({opacity: watermarkSettings.opacity}));
        
        // Set font and color
        const sizeMap = { small: 36, medium: 48, large: 60 };
        pdf.setFontSize(sizeMap[watermarkSettings.size] || 48);
        pdf.setTextColor(watermarkSettings.color);
        
        // Calculate center position
        const centerX = pdfWidth / 2;
        const centerY = pdfHeight / 2;
        
        // Add rotated text
        pdf.text(watermarkSettings.text, centerX, centerY, {
            angle: watermarkSettings.angle,
            align: 'center',
            baseline: 'middle'
        });
        
        pdf.restoreGraphicsState();
    }
}

// Make it available globally
window.ExportUtils = ExportUtils;
