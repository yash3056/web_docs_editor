/**
 * Utils - Utility functions for the editor
 */
export class Utils {
  constructor(editor, documentTitle) {
    this.editor = editor;
    this.documentTitle = documentTitle;
  }

  updateWordCount() {
    const text = this.editor.innerText || "";
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const characters = text.length;

    const wordCountElement = document.getElementById("word-count");
    const charCountElement = document.getElementById("char-count");
    
    if (wordCountElement) {
      wordCountElement.textContent = `Words: ${words}`;
    }
    if (charCountElement) {
      charCountElement.textContent = `Characters: ${characters}`;
    }
  }

  updateToolbarState() {
    const commands = ["bold", "italic", "underline", "strikethrough"];
    commands.forEach((command) => {
      const button = document.getElementById(`${command}-btn`);
      if (button) {
        if (document.queryCommandState(command)) {
          button.classList.add("active");
        } else {
          button.classList.remove("active");
        }
      }
    });

    // Update alignment buttons
    const alignments = [
      { command: "justifyLeft", btn: "align-left-btn" },
      { command: "justifyCenter", btn: "align-center-btn" },
      { command: "justifyRight", btn: "align-right-btn" },
      { command: "justifyFull", btn: "align-justify-btn" },
    ];

    alignments.forEach((align) => {
      const button = document.getElementById(align.btn);
      if (button) {
        if (document.queryCommandState(align.command)) {
          button.classList.add("active");
        } else {
          button.classList.remove("active");
        }
      }
    });
  }

  clearPlaceholderContent() {
    if (!this.editor) return;

    const content = this.editor.innerHTML;
    const plainText = this.editor.textContent || this.editor.innerText || "";

    // Check for various forms of placeholder or empty content
    const isPlaceholder =
      content === "<p>Start typing your document here...</p>" ||
      content === "<p><br></p>" ||
      content === "<br>" ||
      content === "<p></p>" ||
      content.trim() === "" ||
      plainText.trim() === "Start typing your document here...";

    if (isPlaceholder) {
      console.log("🧹 Clearing placeholder content:", content);
      this.editor.innerHTML = "<p><br></p>"; // Set to editable empty paragraph instead of completely empty
    } else {
      console.log(
        "✅ Content is not placeholder:",
        content.substring(0, 100) + "..."
      );
    }
  }

  isPlaceholderContent(content) {
    if (!content) return true;

    // Create a temporary element to get plain text
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = content;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";

    return (
      content === "<p>Start typing your document here...</p>" ||
      plainText.trim() === "Start typing your document here..." ||
      content.trim() === "" ||
      plainText.trim() === ""
    );
  }

  showWordCountDialog() {
    const text = this.editor.innerText || "";
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s/g, "").length;
    const paragraphs = text
      .split(/\n\s*\n/)
      .filter((p) => p.trim().length > 0).length;

    const message = `Document Statistics:
        
Words: ${words}
Characters (with spaces): ${characters}
Characters (no spaces): ${charactersNoSpaces}
Paragraphs: ${paragraphs}`;

    alert(message);
  }

  setupPrintHandling(watermarkSettings, renderDocumentToCanvas) {
    window.addEventListener("beforeprint", async () => {
      if (watermarkSettings) {
        try {
          // Create a print-friendly version with watermark
          const printCanvas = await renderDocumentToCanvas({
            width: 794, // A4 width in pixels at 96 DPI
            height: 1123, // A4 height in pixels at 96 DPI
            scale: 1,
            backgroundColor: "#ffffff",
          });

          // Create a temporary image element for printing
          const printImage = document.createElement("img");
          printImage.src = printCanvas.toDataURL();
          printImage.style.width = "100%";
          printImage.style.height = "auto";
          printImage.id = "print-watermark-image";

          // Hide the original editor and show the watermarked image
          this.editor.style.display = "none";
          this.editor.parentNode.insertBefore(printImage, this.editor);
        } catch (error) {
          console.error("Error preparing print with watermark:", error);
        }
      }
    });

    window.addEventListener("afterprint", () => {
      // Restore original editor visibility
      const printImage = document.getElementById("print-watermark-image");
      if (printImage) {
        printImage.remove();
      }
      this.editor.style.display = "";
    });
  }

  setupCanvasMonitoring(watermarkSettings, drawWatermarkOnCanvas) {
    // Create a MutationObserver to watch for new canvas elements
    this.canvasObserver = new MutationObserver((mutations) => {
      if (!watermarkSettings) return;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node is a canvas
            if (node.tagName === "CANVAS") {
              drawWatermarkOnCanvas(node, watermarkSettings);
            }
            // Check if the added node contains canvases
            const canvases = node.querySelectorAll
              ? node.querySelectorAll("canvas")
              : [];
            canvases.forEach((canvas) => {
              drawWatermarkOnCanvas(canvas, watermarkSettings);
            });
          }
        });
      });
    });

    // Start observing the document for canvas additions
    this.canvasObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  cleanup() {
    if (this.canvasObserver) {
      this.canvasObserver.disconnect();
    }
  }
}
