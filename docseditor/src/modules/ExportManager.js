/**
 * ExportManager - Handles document export functionality
 */
export class ExportManager {
  constructor(editor, notificationManager, watermarkManager, saveManager) {
    this.editor = editor;
    this.notificationManager = notificationManager;
    this.watermarkManager = watermarkManager;
    this.saveManager = saveManager;
    this.exportInProgress = false;
  }

  async exportDocument(format, documentTitle) {
    if (this.exportInProgress) {
      this.notificationManager.showNotification("Export already in progress", "warning");
      return;
    }

    try {
      this.exportInProgress = true;
      this.notificationManager.showNotification(`Exporting as ${format.toUpperCase()}...`, "info");

      // Get the document title
      const title = documentTitle || "untitled-document";

      switch (format.toLowerCase()) {
        case "html":
          await this.exportAsHTML(title);
          break;
        case "txt":
          await this.exportAsText(title);
          break;
        case "docx":
          await this.exportAsWordDocument(title);
          break;
        case "pdf":
          await this.exportAsPDF(title);
          break;
        case "png":
        case "jpg":
        case "jpeg":
          await this.watermarkManager.exportAsImage(format, title);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      this.notificationManager.showNotification(
        `Document exported as ${format.toUpperCase()} successfully!`,
        "success"
      );
    } catch (error) {
      console.error("Export error:", error);
      this.notificationManager.showNotification(
        `Export failed: ${error.message}`,
        "error"
      );
    } finally {
      this.exportInProgress = false;
    }
  }

  async exportAsHTML(title) {
    try {
      // Get the current document content
      const content = this.editor.innerHTML;

      // Create a complete HTML document
      const htmlContent = this.createCompleteHTMLDocument(content, title);

      // Create and download the file
      this.downloadFile(htmlContent, `${title}.html`, "text/html");
    } catch (error) {
      console.error("HTML export error:", error);
      throw new Error("Failed to export as HTML");
    }
  }

  async exportAsText(title) {
    try {
      // Extract plain text from the editor
      const textContent = this.editor.innerText || this.editor.textContent || "";

      // Create and download the file
      this.downloadFile(textContent, `${title}.txt`, "text/plain");
    } catch (error) {
      console.error("Text export error:", error);
      throw new Error("Failed to export as Text");
    }
  }

  async exportAsWordDocument(title) {
    try {
      // Check if docx library is available
      if (typeof docx === "undefined") {
        throw new Error("DOCX library not loaded. Please include the docx library.");
      }

      // Get content from editor
      const content = this.editor.innerHTML;

      // Convert HTML to Word document
      const doc = await this.convertHTMLToDocx(content, title);

      // Generate and download
      const blob = await docx.Packer.toBlob(doc);
      this.downloadBlob(blob, `${title}.docx`);
    } catch (error) {
      console.error("Word export error:", error);
      throw new Error("Failed to export as Word document: " + error.message);
    }
  }

  async exportAsPDF(title) {
    try {
      // Check if jsPDF is available
      if (typeof window.jsPDF === "undefined") {
        throw new Error("jsPDF library not loaded. Please include the jsPDF library.");
      }

      // Create new PDF document
      const { jsPDF } = window.jsPDF;
      const pdf = new jsPDF();

      // Get watermarked content if watermark exists
      let canvas;
      if (this.watermarkManager.getWatermarkSettings()) {
        canvas = await this.watermarkManager.renderDocumentToCanvas({
          width: 595, // A4 width in points
          height: 842, // A4 height in points
          scale: 2,
        });
      } else {
        canvas = await this.renderDocumentToCanvas();
      }

      // Add the canvas as image to PDF
      const imgData = canvas.toDataURL("image/jpeg", 0.9);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Calculate dimensions to fit page
      const canvasAspectRatio = canvas.width / canvas.height;
      const pdfAspectRatio = pdfWidth / pdfHeight;

      let finalWidth, finalHeight;
      if (canvasAspectRatio > pdfAspectRatio) {
        finalWidth = pdfWidth - 20; // 10mm margin on each side
        finalHeight = finalWidth / canvasAspectRatio;
      } else {
        finalHeight = pdfHeight - 20; // 10mm margin on top and bottom
        finalWidth = finalHeight * canvasAspectRatio;
      }

      const xOffset = (pdfWidth - finalWidth) / 2;
      const yOffset = (pdfHeight - finalHeight) / 2;

      pdf.addImage(imgData, "JPEG", xOffset, yOffset, finalWidth, finalHeight);

      // Save the PDF
      pdf.save(`${title}.pdf`);
    } catch (error) {
      console.error("PDF export error:", error);
      throw new Error("Failed to export as PDF: " + error.message);
    }
  }

  async renderDocumentToCanvas() {
    try {
      // Use html2canvas to render the editor content
      const canvas = await html2canvas(this.editor, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        onclone: (clonedDoc) => {
          // Ensure the cloned document has the same styling
          const clonedEditor = clonedDoc.querySelector("#editor");
          if (clonedEditor) {
            clonedEditor.style.width = this.editor.offsetWidth + "px";
            clonedEditor.style.height = this.editor.offsetHeight + "px";
          }
        },
      });

      return canvas;
    } catch (error) {
      console.error("Error rendering document to canvas:", error);
      throw error;
    }
  }

  createCompleteHTMLDocument(content, title) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(title)}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 40px;
            background-color: #ffffff;
        }
        .document-content {
            max-width: 800px;
            margin: 0 auto;
            background: #fff;
            padding: 20px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        h1, h2, h3, h4, h5, h6 {
            color: #333;
            margin-top: 20px;
        }
        p {
            margin-bottom: 10px;
        }
        .page-break {
            page-break-before: always;
        }
        @media print {
            body {
                margin: 0;
            }
            .document-content {
                box-shadow: none;
                margin: 0;
                padding: 0;
            }
        }
    </style>
</head>
<body>
    <div class="document-content">
        ${content}
    </div>
</body>
</html>`;
  }

  async convertHTMLToDocx(htmlContent, title) {
    // This is a simplified conversion - for full HTML to DOCX conversion,
    // you might want to use a more comprehensive library
    const doc = new docx.Document({
      sections: [
        {
          properties: {},
          children: [
            new docx.Paragraph({
              text: title,
              heading: docx.HeadingLevel.HEADING_1,
            }),
            // Convert HTML content to paragraphs
            ...this.convertHTMLToParagraphs(htmlContent),
          ],
        },
      ],
    });

    return doc;
  }

  convertHTMLToParagraphs(htmlContent) {
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;

    const paragraphs = [];
    const walker = document.createTreeWalker(
      tempDiv,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      null,
      false
    );

    let currentText = "";
    let node;

    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        currentText += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === "BR" || node.tagName === "P" || node.tagName === "DIV") {
          if (currentText.trim()) {
            paragraphs.push(
              new docx.Paragraph({
                text: currentText.trim(),
              })
            );
            currentText = "";
          }
        }
      }
    }

    // Add any remaining text
    if (currentText.trim()) {
      paragraphs.push(
        new docx.Paragraph({
          text: currentText.trim(),
        })
      );
    }

    return paragraphs.length > 0
      ? paragraphs
      : [
          new docx.Paragraph({
            text: "Empty document",
          }),
        ];
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    this.downloadBlob(blob, filename);
  }

  downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  escapeHtml(text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  // Export with custom options
  async exportWithOptions(format, options = {}) {
    const {
      title = "document",
      includeWatermark = true,
      quality = 0.9,
      scale = 2,
      paperSize = "A4",
    } = options;

    try {
      this.exportInProgress = true;

      switch (format.toLowerCase()) {
        case "pdf":
          await this.exportCustomPDF(title, { paperSize, includeWatermark, quality });
          break;
        case "png":
        case "jpg":
        case "jpeg":
          await this.exportCustomImage(format, title, { includeWatermark, quality, scale });
          break;
        default:
          await this.exportDocument(format, title);
      }
    } finally {
      this.exportInProgress = false;
    }
  }

  async exportCustomPDF(title, options) {
    const { paperSize, includeWatermark, quality } = options;

    // Paper size configurations
    const paperSizes = {
      A4: { width: 595, height: 842 },
      A3: { width: 842, height: 1191 },
      Letter: { width: 612, height: 792 },
      Legal: { width: 612, height: 1008 },
    };

    const size = paperSizes[paperSize] || paperSizes.A4;

    const { jsPDF } = window.jsPDF;
    const pdf = new jsPDF({
      unit: "pt",
      format: [size.width, size.height],
    });

    let canvas;
    if (includeWatermark && this.watermarkManager.getWatermarkSettings()) {
      canvas = await this.watermarkManager.renderDocumentToCanvas({
        width: size.width,
        height: size.height,
        scale: 2,
      });
    } else {
      canvas = await this.renderDocumentToCanvas();
    }

    const imgData = canvas.toDataURL("image/jpeg", quality);
    pdf.addImage(imgData, "JPEG", 0, 0, size.width, size.height);
    pdf.save(`${title}.pdf`);
  }

  async exportCustomImage(format, title, options) {
    const { includeWatermark, quality, scale } = options;

    let canvas;
    if (includeWatermark && this.watermarkManager.getWatermarkSettings()) {
      canvas = await this.watermarkManager.renderDocumentToCanvas({ scale });
    } else {
      canvas = await this.renderDocumentToCanvas();
    }

    canvas.toBlob(
      (blob) => {
        this.downloadBlob(blob, `${title}.${format}`);
      },
      `image/${format}`,
      quality
    );
  }

  getExportFormats() {
    return ["html", "txt", "pdf", "png", "jpg", "docx"];
  }

  isExportInProgress() {
    return this.exportInProgress;
  }
}
