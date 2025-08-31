/**
 * WatermarkManager - Handles watermark functionality
 */
export class WatermarkManager {
  constructor(editor, notificationManager) {
    this.editor = editor;
    this.notificationManager = notificationManager;
    this.watermarkSettings = null;
  }

  applyWatermark(text, opacity, size, color, angle) {
    // Remove existing watermark
    this.removeWatermark();

    // Apply watermark directly to the editor using CSS
    const editor = document.querySelector("#editor");
    if (!editor) {
      console.error("Editor element not found");
      this.notificationManager.showNotification("Error: Could not apply watermark", "error");
      return;
    }

    // Create watermark as a pseudo-element using CSS
    const sizeMap = {
      small: "36px",
      medium: "48px",
      large: "60px",
    };

    // Create a style element for the watermark
    let watermarkStyle = document.getElementById("watermark-style");
    if (!watermarkStyle) {
      watermarkStyle = document.createElement("style");
      watermarkStyle.id = "watermark-style";
      document.head.appendChild(watermarkStyle);
    }

    // Generate CSS for the watermark
    const watermarkCSS = `
      #editor::before {
        content: "${text}";
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(${angle}deg);
        font-size: ${sizeMap[size]};
        font-weight: bold;
        color: ${color};
        opacity: ${opacity};
        pointer-events: none;
        z-index: 0;
        white-space: nowrap;
        letter-spacing: 0.1em;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
      }
    `;

    watermarkStyle.textContent = watermarkCSS;
    console.log("Watermark applied as CSS pseudo-element");

    // Save watermark settings
    this.watermarkSettings = {
      text,
      opacity,
      size,
      color,
      angle,
    };

    console.log("Watermark settings saved:", this.watermarkSettings);

    // Apply watermark to any existing canvases
    this.applyWatermarkToCanvases();

    // Update toolbar button state
    this.updateWatermarkButtonState();

    this.notificationManager.showNotification("Watermark applied successfully!", "success");
  }

  // Apply watermark to all canvas elements
  applyWatermarkToCanvases() {
    if (!this.watermarkSettings) return;

    const canvases = document.querySelectorAll("canvas");
    canvases.forEach((canvas) => {
      this.drawWatermarkOnCanvas(canvas, this.watermarkSettings);
    });
  }

  // Draw watermark directly on a canvas
  drawWatermarkOnCanvas(canvas, watermarkSettings) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Save current canvas state
    ctx.save();

    // Set up watermark properties
    const sizeMap = {
      small: 36,
      medium: 48,
      large: 60,
    };

    const fontSize = sizeMap[watermarkSettings.size] || 48;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Set font and style
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.fillStyle = watermarkSettings.color;
    ctx.globalAlpha = parseFloat(watermarkSettings.opacity);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Apply rotation
    ctx.translate(centerX, centerY);
    ctx.rotate((watermarkSettings.angle * Math.PI) / 180);

    // Draw the watermark text
    ctx.fillText(watermarkSettings.text, 0, 0);

    // Restore canvas state
    ctx.restore();
  }

  // Method to create a canvas from the current document content
  async createDocumentCanvas() {
    try {
      // Use html2canvas to capture the document content
      const canvas = await html2canvas(this.editor, {
        backgroundColor: "#ffffff",
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
      });

      // Apply watermark to the canvas if settings exist
      if (this.watermarkSettings) {
        this.drawWatermarkOnCanvas(canvas, this.watermarkSettings);
      }

      return canvas;
    } catch (error) {
      console.error("Error creating document canvas:", error);
      throw error;
    }
  }

  // Debug function to test watermark
  testWatermark() {
    this.applyWatermark("CONFIDENTIAL", 0.4, "medium", "#d0d0d0", -30);
  }

  // Debug function to test canvas watermark
  async testCanvasWatermark() {
    try {
      console.log("Testing canvas watermark...");

      // Apply a test watermark
      this.applyWatermark("CANVAS TEST", 0.3, "medium", "#0066cc", -45);

      // Create canvas with watermark
      const canvas = await this.renderDocumentToCanvas();

      // Display the canvas for testing
      const testDiv = document.createElement("div");
      testDiv.style.position = "fixed";
      testDiv.style.top = "10px";
      testDiv.style.right = "10px";
      testDiv.style.zIndex = "9999";
      testDiv.style.border = "2px solid red";
      testDiv.style.backgroundColor = "white";
      testDiv.style.padding = "10px";

      const testCanvas = document.createElement("canvas");
      testCanvas.width = 300;
      testCanvas.height = 200;
      const ctx = testCanvas.getContext("2d");

      // Scale down the original canvas to fit the test display
      ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, 300, 200);

      const closeBtn = document.createElement("button");
      closeBtn.textContent = "Close Test";
      closeBtn.onclick = () => testDiv.remove();

      testDiv.appendChild(testCanvas);
      testDiv.appendChild(document.createElement("br"));
      testDiv.appendChild(closeBtn);
      document.body.appendChild(testDiv);

      console.log("Canvas watermark test completed. Check the preview in the top-right corner.");
      this.notificationManager.showNotification(
        "Canvas watermark test completed! Check preview in top-right corner.",
        "success"
      );
    } catch (error) {
      console.error("Canvas watermark test failed:", error);
      this.notificationManager.showNotification(
        "Canvas watermark test failed. Check console for details.",
        "error"
      );
    }
  }

  removeWatermark() {
    // Remove CSS-based watermark
    const watermarkStyle = document.getElementById("watermark-style");
    if (watermarkStyle) {
      watermarkStyle.remove();
      this.watermarkSettings = null;
      this.notificationManager.showNotification("Watermark removed successfully!", "success");
      console.log("Watermark CSS removed");

      // Update toolbar button state
      this.updateWatermarkButtonState();
    } else {
      // Also check for old DOM-based watermark for backward compatibility
      const existingWatermark = document.getElementById("document-watermark");
      if (existingWatermark) {
        existingWatermark.remove();
        this.watermarkSettings = null;
        this.notificationManager.showNotification("Watermark removed successfully!", "success");
        this.updateWatermarkButtonState();
      } else {
        this.notificationManager.showNotification("No watermark to remove", "info");
      }
    }
  }

  // Method to get document content with watermark for export
  async getDocumentContentWithWatermark() {
    if (!this.watermarkSettings) {
      // No watermark, return regular content
      return this.editor.innerHTML;
    }

    try {
      // Create a temporary container with the document content
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "relative";
      tempContainer.style.width = this.editor.offsetWidth + "px";
      tempContainer.style.height = this.editor.offsetHeight + "px";
      tempContainer.style.backgroundColor = "#ffffff";
      tempContainer.innerHTML = this.editor.innerHTML;

      // Create watermark element for the temp container
      const watermark = document.createElement("div");
      watermark.style.position = "absolute";
      watermark.style.top = "0";
      watermark.style.left = "0";
      watermark.style.right = "0";
      watermark.style.bottom = "0";
      watermark.style.pointerEvents = "none";
      watermark.style.zIndex = "1";
      watermark.style.display = "flex";
      watermark.style.alignItems = "center";
      watermark.style.justifyContent = "center";
      watermark.style.overflow = "hidden";

      const watermarkText = document.createElement("div");
      const sizeMap = {
        small: "36px",
        medium: "48px",
        large: "60px",
      };

      watermarkText.style.fontSize = sizeMap[this.watermarkSettings.size];
      watermarkText.style.fontWeight = "bold";
      watermarkText.style.color = this.watermarkSettings.color;
      watermarkText.style.opacity = this.watermarkSettings.opacity;
      watermarkText.style.transform = `rotate(${this.watermarkSettings.angle}deg)`;
      watermarkText.style.userSelect = "none";
      watermarkText.style.whiteSpace = "nowrap";
      watermarkText.style.letterSpacing = "0.1em";
      watermarkText.textContent = this.watermarkSettings.text;

      watermark.appendChild(watermarkText);
      tempContainer.appendChild(watermark);

      // Temporarily add to document for rendering
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.top = "-9999px";
      document.body.appendChild(tempContainer);

      // Create canvas from the temp container
      const canvas = await html2canvas(tempContainer, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });

      // Remove temp container
      document.body.removeChild(tempContainer);

      return canvas;
    } catch (error) {
      console.error("Error creating watermarked content:", error);
      return this.editor.innerHTML;
    }
  }

  updateWatermarkButtonState() {
    const watermarkBtn = document.getElementById("watermark-btn");
    if (!watermarkBtn) return;
    
    const icon = watermarkBtn.querySelector("i");
    if (this.watermarkSettings) {
      watermarkBtn.classList.add("active");
      watermarkBtn.title = "Remove Watermark";
      if (icon && icon.classList.contains("fa-tint")) {
        icon.classList.replace("fa-tint", "fa-tint-slash");
      }
    } else {
      watermarkBtn.classList.remove("active");
      watermarkBtn.title = "Add Watermark";
      if (icon && icon.classList.contains("fa-tint-slash")) {
        icon.classList.replace("fa-tint-slash", "fa-tint");
      }
    }
  }

  // Enhanced method to render document with watermark on canvas
  async renderDocumentToCanvas(options = {}) {
    const {
      width = this.editor.offsetWidth,
      height = this.editor.offsetHeight,
      scale = 2,
      backgroundColor = "#ffffff",
    } = options;

    try {
      // Create canvas
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");

      // Set background
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Scale context for high DPI
      ctx.scale(scale, scale);

      // First, render the document content using html2canvas
      const documentCanvas = await html2canvas(this.editor, {
        backgroundColor: backgroundColor,
        scale: 1, // We handle scaling ourselves
        useCORS: true,
        allowTaint: true,
        width: width,
        height: height,
      });

      // Draw the document content onto our canvas
      ctx.drawImage(documentCanvas, 0, 0, width, height);

      // Apply watermark if settings exist
      if (this.watermarkSettings) {
        this.drawWatermarkOnCanvas(canvas, this.watermarkSettings);
      }

      return canvas;
    } catch (error) {
      console.error("Error rendering document to canvas:", error);
      throw error;
    }
  }

  // Method to export current view as image with watermark
  async exportAsImage(format = "png", documentTitle) {
    try {
      const canvas = await this.renderDocumentToCanvas();

      // Convert canvas to blob
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${documentTitle || "document"}.${format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          resolve(blob);
        }, `image/${format}`);
      });
    } catch (error) {
      console.error("Error exporting as image:", error);
      this.notificationManager.showNotification(
        "Error exporting image. Please try again.",
        "error"
      );
    }
  }

  getWatermarkSettings() {
    return this.watermarkSettings;
  }

  setWatermarkSettings(settings) {
    this.watermarkSettings = settings;
  }

  toggleWatermark() {
    if (this.watermarkSettings) {
      this.removeWatermark();
    } else {
      this.showWatermarkModal();
    }
  }

  showWatermarkModal() {
    const modal = document.getElementById("watermark-modal");
    if (modal) {
      modal.style.display = "block";

      // Update range value displays
      this.updateRangeValue("watermark-opacity", "opacity-value", "");
      this.updateRangeValue("watermark-angle", "angle-value", "°");
    }
  }

  updateRangeValue(rangeId, displayId, suffix = "") {
    const range = document.getElementById(rangeId);
    const display = document.getElementById(displayId);
    if (range && display) {
      display.textContent = range.value + suffix;

      range.addEventListener("input", () => {
        display.textContent = range.value + suffix;
      });
    }
  }
}
