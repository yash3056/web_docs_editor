
// Import the modular system
import { DocsEditorModules } from './src/index.js';

// FIXME: Page count doesn't update on deletion of content.
// HACK: Temporary page-break alignment fix.
// For a permanent fix, please look into the misaligned "document-container" element

class DocsEditor {
  constructor() {
    console.log("🚀 DocsEditor constructor starting...");

    this.api = new DocumentAPI();
    this.editor = document.getElementById("editor");
    this.pages = document.getElementById("pages");
    this.documentContainer = document.getElementById("document-container");
    this.isUpdatingLayout = false;
    // this.pageIndicators = document.getElementById("page-indicators");
    this.documentTitle = document.getElementById("document-title");
    this.watermarkSettings = null;
    this.selectedImageData = null;

    //potential use for pagination
    this.pageHeight = 11 * 96; // 11 inches * 96 DPI
    this.currentPage = 1;
    this.totalPages = 1;

    this.serverAvailable = false;
    this.isNavigating = false; // Flag to track programmatic navigation
    this.autoSaveTimeout = null; // For debounced auto-save
    this.authToken = null;
    this.user = null;
    this.currentPrompt = null; // AI prompt data
    this.lastEditTime = Date.now(); // Track when user last edited
    this.isSaving = false; // Flag to prevent concurrent saves

    this.paginationMode = true; // Start in pagination mode by default
    this.paginationTimeout = null;
    this.PAGE_BREAK_HEIGHT = 20; // Height of visual page break
    this.PAGE_BREAK_MARGIN = 40; // Spacing around page breaks
    this.pageBreaksOverlay = null; // Container for visual page breaks
    this.originalMargins = new Map(); // Store original margins for toggle off

    // this.spacers = new Set();
    // Check authentication
    this.authToken = localStorage.getItem("authToken");
    this.user = JSON.parse(localStorage.getItem("user") || "null");

    if (!this.authToken || !this.user) {
      window.location.href = "../auth/login.html";
      return;
    }

    // Set up API authentication
    this.api.setAuthToken(this.authToken);

    console.log("📝 Editor element found:", !!this.editor);
    console.log("📄 Document title element found:", !!this.documentTitle);

    // Initialize modular system
    this.modules = new DocsEditorModules(this.editor);
    console.log("🔧 Modular system initialized");

    // Pass auth token and other properties to AIManager
    this.modules.aiManager.setEditorProperties(this.authToken, this.currentPrompt, this.savedSelection);

    //
    this.initializeEditor();
    this.initializeEventListeners();
    this.modules.utils.updateWordCount();
    this.history = [];
    this.historyIndex = -1;
    this.saveState();
    this.updateWatermarkButtonState();

    //potential use for pagination?
    this.updatePageLayout();
    this.updateCurrentPage();

    this.checkServerStatus();
    this.setupAutoSave();
    this.setupCustomContextMenu();
    this.setupAIWritingEventListeners();
    this.setupRefinePopupEventListeners();

    // Add cleanup on page unload
    window.addEventListener("beforeunload", () => {
      this.cleanupAutoSave();
      this.cleanup();
    });

    console.log("✅ DocsEditor initialized properly as Word-like editor");

    // Set up print handling for watermarks
    this.setupPrintHandling();

    // Set up canvas monitoring for automatic watermark application
    this.setupCanvasMonitoring();

    // Make test methods available globally for debugging
    window.testCanvasWatermark = () => this.testCanvasWatermark();
    window.testWatermark = () => this.testWatermark();
  }

  // Setup print handling to include watermarks
  setupPrintHandling() {
    window.addEventListener("beforeprint", async () => {
      if (this.watermarkSettings) {
        try {
          // Create a print-friendly version with watermark
          const printCanvas = await this.renderDocumentToCanvas({
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

  // Setup monitoring for new canvas elements to automatically apply watermarks
  setupCanvasMonitoring() {
    // Create a MutationObserver to watch for new canvas elements
    this.canvasObserver = new MutationObserver((mutations) => {
      if (!this.watermarkSettings) return;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node is a canvas
            if (node.tagName === "CANVAS") {
              this.drawWatermarkOnCanvas(node, this.watermarkSettings);
            }
            // Check if the added node contains canvases
            const canvases = node.querySelectorAll
              ? node.querySelectorAll("canvas")
              : [];
            canvases.forEach((canvas) => {
              this.drawWatermarkOnCanvas(canvas, this.watermarkSettings);
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

  // Cleanup method
  cleanup() {
    if (this.canvasObserver) {
      this.canvasObserver.disconnect();
    }
  }

  async checkServerStatus() {
    console.log("=== CHECKING SERVER STATUS ===");
    try {
      console.log("Calling api.checkServerHealth()...");
      this.serverAvailable = await this.api.checkServerHealth();
      console.log("Server health check result:", this.serverAvailable);
      console.log(
        "Server status:",
        this.serverAvailable ? "Online" : "Offline"
      );
    } catch (error) {
      console.error("Server check error:", error);
      this.serverAvailable = false;
      console.log("Server check failed, using offline mode");
    }
    console.log("Final serverAvailable value:", this.serverAvailable);
  }

  initializeEditor() {
    if (this.editor) {
      this.editor.setAttribute("contenteditable", "true");
      this.editor.setAttribute("spellcheck", "true");

      // Don't clear content here - let loadDocument handle it
      // Content will be loaded by loadDocument after initialization

      // Add input event listener for real-time updates
      this.editor.addEventListener("input", () => {
        this.lastEditTime = Date.now(); // Track edit time
        this.updateWordCount();
        this.updatePageLayout();
        this.updateCurrentPage(); // Update cursor page position
        // this.checkPageOverflow();
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
      this.editor.addEventListener("click", () => {
        this.editor.focus();
        // Use setTimeout to ensure cursor position is updated after click
        setTimeout(() => {
          this.updateCurrentPage();
        }, 10);
      });

      // Handle scroll to update current page
      this.editor.addEventListener("scroll", () => {
        this.updateCurrentPage();
      });

      // Track cursor movement with keyboard navigation
      this.editor.addEventListener("keyup", (e) => {
        // Update cursor page on arrow keys, page up/down, home/end
        const navigationKeys = [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "PageUp",
          "PageDown",
          "Home",
          "End",
        ];
        if (navigationKeys.includes(e.key)) {
          setTimeout(() => {
            this.updateCurrentPage();
          }, 10);
        }
      });

      // Track selection changes (when user selects text with mouse or keyboard)
      document.addEventListener("selectionchange", () => {
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

  async loadDocument() {
    console.log("🔍 Loading document...");
    const currentDocId = localStorage.getItem("currentDocumentId");
    console.log("📄 Current document ID:", currentDocId);
    console.log("📚 All localStorage keys:", Object.keys(localStorage));

    if (currentDocId) {
      console.log(
        "🔍 Found currentDocId, attempting to load document:",
        currentDocId
      );
      try {
        // Try to load from server first
        console.log("🌐 Attempting to load from server...");
        const currentDoc = await this.api.getDocument(currentDocId);
        console.log("📡 Server response:", currentDoc);

        if (currentDoc) {
          console.log(
            "� Content type:",
            Array.isArray(currentDoc.content)
              ? "array"
              : typeof currentDoc.content
          );
          console.log(
            "📡 Content length:",
            Array.isArray(currentDoc.content)
              ? currentDoc.content.length
              : currentDoc.content?.length || 0
          );

          if (
            Array.isArray(currentDoc.content) &&
            currentDoc.content.length > 0
          ) {
            console.log(
              "📡 First page content preview:",
              currentDoc.content[0]?.substring(0, 100) + "..."
            );
          } else if (currentDoc.content) {
            console.log(
              "📡 Content preview:",
              currentDoc.content.substring(0, 100) + "..."
            );
          }

          console.log("�📖 Loading document from server:", currentDoc.title);
          this.documentTitle.value = currentDoc.title;

          // Handle both old format (single content) and new format (pages array)
          if (Array.isArray(currentDoc.content)) {
            // New multi-page format - use first page content for the editor
            if (currentDoc.content.length > 0 && currentDoc.content[0]) {
              console.log(
                "📡 Loading from page array, content:",
                currentDoc.content[0]
              );
              this.editor.innerHTML = currentDoc.content[0];
              console.log(
                "📡 Editor content after setting:",
                this.editor.innerHTML
              );
            } else {
              console.log("📡 Empty page array, setting minimal content");
              this.editor.innerHTML = "<p><br></p>";
            }
          } else {
            // Old single-page format - put content directly in editor
            console.log("📡 Loading from single content:", currentDoc.content);
            this.editor.innerHTML = currentDoc.content || "<p><br></p>";
            console.log(
              "📡 Editor content after setting:",
              this.editor.innerHTML
            );
          }

          // DO NOT CLEAR CONTENT - just check if it's the default placeholder
          if (
            this.editor.innerHTML ===
            "<p>Start typing your document here...</p>"
          ) {
            console.log("📡 Only clearing the specific default placeholder");
            this.editor.innerHTML = "<p><br></p>";
          } else {
            console.log("📡 Keeping loaded content as-is");
          }

          this.updateWordCount();
          this.updatePageLayout();
          this.updateCurrentPage();

          // Store initial content hash for change detection
          const initialContentHash = this.calculateContentHash(
            this.editor.innerHTML,
            currentDoc.title
          );
          localStorage.setItem(
            "lastContentHash_" + currentDocId,
            initialContentHash
          );

          // Store initial watermark hash for change detection
          const initialWatermarkHash = currentDoc.watermark
            ? JSON.stringify(currentDoc.watermark)
            : "";
          localStorage.setItem(
            "lastWatermarkHash_" + currentDocId,
            initialWatermarkHash
          );

          // Restore watermark if it exists
          if (currentDoc.watermark) {
            console.log(
              "Restoring watermark from server:",
              currentDoc.watermark
            );
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

          console.log("✅ Document loaded successfully from server");

          return;
        }
      } catch (error) {
        console.error("❌ Error loading document from server:", error);
      }

      // Fallback to localStorage if server fails
      console.log("📱 Falling back to localStorage...");
      const documents = JSON.parse(localStorage.getItem("documents") || "[]");
      console.log("📚 Found documents in localStorage:", documents.length);
      const currentDoc = documents.find((doc) => doc.id === currentDocId);
      console.log("🎯 Found current document:", !!currentDoc);

      if (currentDoc) {
        console.log(
          "� Content type:",
          Array.isArray(currentDoc.content)
            ? "array"
            : typeof currentDoc.content
        );
        console.log(
          "📱 Content length:",
          Array.isArray(currentDoc.content)
            ? currentDoc.content.length
            : currentDoc.content?.length || 0
        );

        if (
          Array.isArray(currentDoc.content) &&
          currentDoc.content.length > 0
        ) {
          console.log(
            "📱 First page content preview:",
            currentDoc.content[0]?.substring(0, 100) + "..."
          );
        } else if (currentDoc.content) {
          console.log(
            "📱 Content preview:",
            currentDoc.content.substring(0, 100) + "..."
          );
        }

        console.log(
          "�📖 Loading document from localStorage:",
          currentDoc.title
        );
        this.documentTitle.value = currentDoc.title;

        // Handle both old format (single content) and new format (pages array)
        if (Array.isArray(currentDoc.content)) {
          // New multi-page format - use first page content for the editor
          if (currentDoc.content.length > 0 && currentDoc.content[0]) {
            console.log(
              "📱 Loading from page array, content:",
              currentDoc.content[0]
            );
            this.editor.innerHTML = currentDoc.content[0];
            console.log(
              "📱 Editor content after setting:",
              this.editor.innerHTML
            );
          } else {
            console.log("📱 Empty page array, setting minimal content");
            this.editor.innerHTML = "<p><br></p>";
          }
        } else {
          // Old single-page format - put content directly in editor
          console.log("📱 Loading from single content:", currentDoc.content);
          this.editor.innerHTML = currentDoc.content || "<p><br></p>";
          console.log(
            "📱 Editor content after setting:",
            this.editor.innerHTML
          );
        }

        // DO NOT CLEAR CONTENT - just check if it's the default placeholder
        if (
          this.editor.innerHTML === "<p>Start typing your document here...</p>"
        ) {
          console.log("📱 Only clearing the specific default placeholder");
          this.editor.innerHTML = "<p><br></p>";
        } else {
          console.log("📱 Keeping loaded content as-is");
        }

        this.updateWordCount();
        this.updatePageLayout();
        this.updateCurrentPage();

        // Store initial content hash for change detection
        const initialContentHash = this.calculateContentHash(
          this.editor.innerHTML,
          currentDoc.title
        );
        localStorage.setItem(
          "lastContentHash_" + currentDocId,
          initialContentHash
        );

        // Store initial watermark hash for change detection
        const initialWatermarkHash = currentDoc.watermark
          ? JSON.stringify(currentDoc.watermark)
          : "";
        localStorage.setItem(
          "lastWatermarkHash_" + currentDocId,
          initialWatermarkHash
        );

        // Restore watermark if it exists
        if (currentDoc.watermark) {
          console.log(
            "Restoring watermark from localStorage:",
            currentDoc.watermark
          );
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
    const saved = localStorage.getItem("webdocs_document");
    if (saved) {
      const data = JSON.parse(saved);
      this.documentTitle.value = data.title;
      this.editor.innerHTML = data.content;
      this.updateWordCount();
      this.updatePageLayout();
      this.updateCurrentPage();

      // Store initial content hash for legacy documents
      const currentDocId = localStorage.getItem("currentDocumentId");
      if (currentDocId) {
        const initialContentHash = this.calculateContentHash(
          data.content,
          data.title
        );
        localStorage.setItem(
          "lastContentHash_" + currentDocId,
          initialContentHash
        );

        // Store initial watermark hash for change detection
        const initialWatermarkHash = data.watermark
          ? JSON.stringify(data.watermark)
          : "";
        localStorage.setItem(
          "lastWatermarkHash_" + currentDocId,
          initialWatermarkHash
        );
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
      // No document found, clear any default content and reset state
      console.log("📄 No document found, creating new document");

      // Set empty content but ensure editor is editable
      this.editor.innerHTML = "<p><br></p>";
      this.documentTitle.value = "Untitled Document";

      // Clear the current document ID since no document was found
      localStorage.removeItem("currentDocumentId");
      console.log(
        "🗑️ Cleared currentDocumentId - will create new document on save"
      );
    }

    // Final check and logging
    console.log("📋 Final editor state after loadDocument:");
    console.log("📋 Title:", this.documentTitle.value);
    console.log("📋 Content length:", this.editor.innerHTML.length);
    console.log(
      "📋 Content preview:",
      this.editor.innerHTML.substring(0, 200) + "..."
    );
    console.log(
      "📋 Plain text length:",
      (this.editor.textContent || "").length
    );
    console.log(
      "📋 Plain text preview:",
      (this.editor.textContent || "").substring(0, 200) + "..."
    );

    // Ensure editor always has editable content
    if (!this.editor.innerHTML.trim() || this.editor.innerHTML === "") {
      console.log("📋 Setting fallback content for empty editor");
      this.editor.innerHTML = "<p><br></p>";
    }

    // Add a delay check to see if content gets cleared later
    setTimeout(() => {
      console.log("🕐 Content check after 1 second:");
      console.log(
        "🕐 Content:",
        this.editor.innerHTML.substring(0, 200) + "..."
      );
      console.log(
        "🕐 Plain text:",
        (this.editor.textContent || "").substring(0, 200) + "..."
      );
    }, 1000);

    setTimeout(() => {
      console.log("🕐 Content check after 3 seconds:");
      console.log(
        "🕐 Content:",
        this.editor.innerHTML.substring(0, 200) + "..."
      );
      console.log(
        "🕐 Plain text:",
        (this.editor.textContent || "").substring(0, 200) + "..."
      );
    }, 3000);
  }

  togglePaginationMode() {
    this.modules.paginationManager.togglePaginationMode();
  }

  updatePageLayout() {
    this.modules.paginationManager.updatePageLayout();
  }

  adjustNumberOfPages(requiredPages, paginationMode) {
    const pagesContainer = document.querySelector(".pages");
    if (!pagesContainer) return;

    pagesContainer.innerHTML = "";

    if (!paginationMode) {
      return;
    }

    for (let i = 0; i < requiredPages; i++) {
      const page = document.createElement("div");
      page.classList.add("page");

      page.style.marginTop = `${this.pageHeight - this.PAGE_BREAK_MARGIN}px`;

      pagesContainer.appendChild(page);

      if (i < requiredPages - 1) {
        const breaker = document.createElement("div");
        breaker.classList.add("breaker");

        breaker.style.marginTop = `${this.PAGE_BREAK_MARGIN}px`;
        breaker.style.marginBottom = `${this.PAGE_BREAK_MARGIN}px`;
        breaker.style.height = `${this.PAGE_BREAK_HEIGHT}px`;

        pagesContainer.appendChild(breaker);
      }
    }
  }

  updateCurrentPage() {
    return this.modules.paginationManager.updateCurrentPage();
  }

  updatePageInfo() {
    const pageInfoElement = document.getElementById("page-info");
    if (pageInfoElement) {
      const currentPage = this.currentPage || 1;
      const totalPages = this.totalPages || 1;
      pageInfoElement.textContent = `Page ${currentPage} of ${totalPages}`;
    }
  }
  //#endregion

  //#region triggers for pagination perhaps
  formatText(command, value = null) {
    // Delegate to modular system
    this.modules.textFormatter.formatText(command, value);
    this.modules.utils.updateToolbarState();
    this.saveState();
  }
  undo() {
    // Delegate to modular system
    this.modules.textFormatter.undo();
  }

  redo() {
    // Delegate to modular system
    this.modules.textFormatter.redo();
  }

  insertHTML(html) {
    // Delegate to modular system
    this.modules.textFormatter.insertHTML(html);
    this.saveState();
    this.updatePageLayout();
    this.updateCurrentPage();
  }
  // #endregion

  // #region linespacing

  applyLineSpacing(spacing) {
    this.modules.lineSpacingManager.applyLineSpacing(spacing);
    this.saveState();
  }

  applyLineSpacingToEditor(spacing) {
    this.modules.lineSpacingManager.applyLineSpacingToEditor(spacing);
  }

  getCurrentParagraphElement() {
    return this.modules.lineSpacingManager.getCurrentParagraphElement();
  }

  isParagraphElement(element) {
    return this.modules.lineSpacingManager.isParagraphElement(element);
  }

  wrapContentInParagraph() {
    return this.lineSpacingManager.wrapContentInParagraph();
  }

  setElementLineSpacing(element, spacing) {
    return this.lineSpacingManager.setElementLineSpacing(element, spacing);
  }

  applySpacingToSelection(spacing) {
    return this.lineSpacingManager.applySpacingToSelection(spacing);
  }

  getParagraphElementsInRange(range) {
    return this.lineSpacingManager.getParagraphElementsInRange(range);
  }

  adjustParagraphSpacing(position, value) {
    return this.lineSpacingManager.adjustParagraphSpacing(position, value);
  }

  setParagraphSpacing(element, position, value) {
    return this.lineSpacingManager.setParagraphSpacing(element, position, value);
  }

  updateLineSpacingButton(spacing) {
    return this.lineSpacingManager.updateLineSpacingButton(spacing);
  }

  showLineSpacingModal() {
    return this.lineSpacingManager.showLineSpacingModal();
  }

  populateLineSpacingModal() {
    return this.lineSpacingManager.populateLineSpacingModal();
  }

  setupLineSpacingModalEvents() {
    return this.lineSpacingManager.setupLineSpacingModalEvents();
  }

  updateSpacingPreview() {
    return this.lineSpacingManager.updateSpacingPreview();
  }

  applyDetailedSpacing() {
    this.modules.lineSpacingManager.applyDetailedSpacing();
  }

  applyDetailedSpacingToElement(element, lineHeight, spaceBefore, spaceAfter) {
    this.modules.lineSpacingManager.applyDetailedSpacingToElement(element, lineHeight, spaceBefore, spaceAfter);
  }

  closeLineSpacingModal() {
    return this.lineSpacingManager.closeLineSpacingModal();
  }

  updateWordCount() {
    // Delegate to modular system
    this.modules.utils.updateWordCount();
  }

  initializeEventListeners() {
    // Dashboard navigation
    const dashboardBtn = document.getElementById("dashboard-btn");
    if (dashboardBtn) {
      dashboardBtn.addEventListener("click", async () => {
        console.log("Dashboard button click detected");
        await this.goToDashboard();
      });
    } else {
      console.error("Dashboard button not found!");
    }

    // Toolbar formatting buttons
    document
      .getElementById("bold-btn")
      .addEventListener("click", () => this.formatText("bold"));
    document
      .getElementById("italic-btn")
      .addEventListener("click", () => this.formatText("italic"));
    document
      .getElementById("underline-btn")
      .addEventListener("click", () => this.formatText("underline"));
    document
      .getElementById("strikethrough-btn")
      .addEventListener("click", () => this.formatText("strikethrough"));

    // Alignment buttons
    document
      .getElementById("align-left-btn")
      .addEventListener("click", () => this.formatText("justifyLeft"));
    document
      .getElementById("align-center-btn")
      .addEventListener("click", () => this.formatText("justifyCenter"));
    document
      .getElementById("align-right-btn")
      .addEventListener("click", () => this.formatText("justifyRight"));
    document
      .getElementById("align-justify-btn")
      .addEventListener("click", () => this.formatText("justifyFull"));

    // List buttons
    document
      .getElementById("bullet-list-btn")
      .addEventListener("click", () => this.formatText("insertUnorderedList"));
    document
      .getElementById("number-list-btn")
      .addEventListener("click", () => this.formatText("insertOrderedList"));

    // Font controls
    document.getElementById("font-family").addEventListener("change", (e) => {
      this.formatText("fontName", e.target.value);
    });

    document.getElementById("font-size").addEventListener("change", (e) => {
      this.formatText("fontSize", e.target.value);
    });

    // Color controls
    document.getElementById("text-color").addEventListener("change", (e) => {
      this.formatText("foreColor", e.target.value);
    });

    document.getElementById("bg-color").addEventListener("change", (e) => {
      this.formatText("backColor", e.target.value);
    });

    // Undo/Redo
    document
      .getElementById("undo-btn")
      .addEventListener("click", () => this.undo());
    document
      .getElementById("redo-btn")
      .addEventListener("click", () => this.redo());

    // Link and image insertion
    document
      .getElementById("link-btn")
      .addEventListener("click", () => this.showLinkModal());
    document
      .getElementById("image-btn")
      .addEventListener("click", () => this.showImageModal());

    // Watermark toggle (add/remove)
    document
      .getElementById("watermark-btn")
      .addEventListener("click", () => this.toggleWatermark());

    // Version control
    document
      .getElementById("version-control-btn")
      .addEventListener("click", () => this.openVersionControl());

    // Page break
    // document
    //   .getElementById("page-break-btn")
    //   .addEventListener("click", () => this.insertPageBreak());

    // Line spacing controls
    document
      .getElementById("line-spacing-btn")
      .addEventListener("click", () => this.toggleLineSpacingMenu());
    this.setupLineSpacingEventListeners();

    // Save and export
    const saveBtn = document.getElementById("save-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        console.log("💾 Save button clicked!");
        this.saveDocument();
      });
      console.log("✅ Save button event listener attached");
    } else {
      console.error("❌ Save button not found!");
    }

    document
      .getElementById("export-btn")
      .addEventListener("click", () => this.toggleExportMenu());

    // Export options
    document
      .getElementById("export-html")
      .addEventListener("click", () => this.exportAsHTML());
    document
      .getElementById("export-pdf")
      .addEventListener("click", () => this.exportAsPDF());
    document
      .getElementById("export-docx")
      .addEventListener("click", () => this.exportAsDOCX());

    // Close export menu when clicking outside
    document.addEventListener("click", (e) => {
      // Close export menu
      const exportDropdown = document.querySelector(".export-dropdown");
      const exportMenu = document.getElementById("export-menu");
      if (!exportDropdown?.contains(e.target)) {
        exportMenu?.classList.remove("show");
      }

      // Close line spacing menu
      const lineSpacingDropdown = document.querySelector(
        ".line-spacing-dropdown"
      );
      const lineSpacingMenu = document.getElementById("line-spacing-menu");
      if (!lineSpacingDropdown?.contains(e.target)) {
        lineSpacingMenu?.classList.remove("show");
      }
    });

    // Editor events
    this.editor.addEventListener("input", () => {
      this.updateWordCount();
      this.saveState();
    });

    this.editor.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "s":
            e.preventDefault();
            this.saveDocument();
            break;
          case "z":
            e.preventDefault();
            if (e.shiftKey) {
              this.redo();
            } else {
              this.undo();
            }
            break;
          case "y":
            e.preventDefault();
            this.redo();
            break;
        }
      }
    });

    // Selection change for toolbar updates
    document.addEventListener("selectionchange", () =>
      this.updateToolbarState()
    );

    // Modal events
    this.setupModalEvents();
  }

  updateToolbarState() {
    this.modules.utils.updateToolbarState();
  }

  // Line Spacing Methods
  toggleLineSpacingMenu() {
    return this.lineSpacingManager.toggleLineSpacingMenu();
  }

  closeLineSpacingMenu(event) {
    return this.lineSpacingManager.closeLineSpacingMenu(event);
  }

  setupLineSpacingEventListeners() {
    return this.lineSpacingManager.setupLineSpacingEventListeners();
  }

  saveState() {
    const state = {
      content: this.editor.innerHTML,
      title: this.documentTitle.value,
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

  showLinkModal() {
    this.modules.modalManager.showLinkModal();
  }

  setupImageModalEvents() {
    // Tab switching
    const urlTab = document.getElementById("url-tab");
    const uploadTab = document.getElementById("upload-tab");
    const urlContent = document.getElementById("url-content");
    const uploadContent = document.getElementById("upload-content");

    urlTab.addEventListener("click", () => {
      urlTab.classList.add("active");
      uploadTab.classList.remove("active");
      urlContent.classList.add("active");
      uploadContent.classList.remove("active");
    });

    uploadTab.addEventListener("click", () => {
      uploadTab.classList.add("active");
      urlTab.classList.remove("active");
      uploadContent.classList.add("active");
      urlContent.classList.remove("active");
    });

    // File input handling
    const fileInput = document.getElementById("image-file");
    const dropZone = document.getElementById("file-drop-zone");
    const preview = document.getElementById("image-preview");
    const previewImg = document.getElementById("preview-img");
    const fileName = document.getElementById("file-name");
    const fileSize = document.getElementById("file-size");

    // Click to browse
    dropZone.addEventListener("click", () => {
      fileInput.click();
    });

    // File input change
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        this.handleImageFile(file);
      }
    });

    // Drag and drop
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith("image/")) {
          fileInput.files = files;
          this.handleImageFile(file);
        } else {
          this.showNotification("Please select an image file", "error");
        }
      }
    });

    // Insert image button
    document
      .getElementById("insert-image-btn")
      .addEventListener("click", () => {
        this.insertImage();
      });

    // Cancel button
    document
      .getElementById("cancel-image-btn")
      .addEventListener("click", () => {
        this.resetImageModal();
        document.getElementById("image-modal").style.display = "none";
      });
  }

  handleImageFile(file) {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      this.showNotification("Please select an image file", "error");
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      this.showNotification(
        "Image file is too large. Maximum size is 5MB",
        "error"
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const previewImg = document.getElementById("preview-img");
      const fileName = document.getElementById("file-name");
      const fileSize = document.getElementById("file-size");
      const preview = document.getElementById("image-preview");

      // Set image source and ensure proper sizing
      previewImg.src = e.target.result;
      previewImg.onload = () => {
        // Ensure the image doesn't break the modal layout
        previewImg.style.maxWidth = "100%";
        previewImg.style.maxHeight = "150px";
        previewImg.style.objectFit = "contain";

        // Force modal to recalculate scroll if needed
        const modalBody = document.querySelector("#image-modal .modal-body");
        if (modalBody) {
          modalBody.scrollTop = modalBody.scrollTop; // Trigger scroll update
        }
      };

      fileName.textContent = file.name;
      fileSize.textContent = this.formatFileSize(file.size);
      preview.style.display = "flex"; // Use flex for better centering

      // Store the image data for insertion
      this.selectedImageData = e.target.result;

      // Scroll the modal body to show the preview
      const modalBody = document.querySelector("#image-modal .modal-body");
      if (modalBody) {
        setTimeout(() => {
          modalBody.scrollTop = modalBody.scrollHeight;
        }, 100);
      }
    };

    reader.readAsDataURL(file);
  }

  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  insertImage() {
    const urlTab = document.getElementById("url-tab");
    const alt = document.getElementById("image-alt").value || "Image";
    const width = document.getElementById("image-width").value;

    let imageSrc = "";
    let widthStyle = width ? `width: ${width}px; ` : "";

    if (urlTab.classList.contains("active")) {
      // URL tab is active
      imageSrc = document.getElementById("image-url").value;
      if (!imageSrc) {
        this.showNotification("Please enter an image URL", "error");
        return;
      }
    } else {
      // Upload tab is active
      if (!this.selectedImageData) {
        this.showNotification("Please select an image file", "error");
        return;
      }
      imageSrc = this.selectedImageData;
    }

    // Ensure the editor has focus before inserting
    this.editor.focus();

    // Create the image HTML with better styling
    const img = `<img src="${imageSrc}" alt="${alt}" style="${widthStyle}max-width: 100%; height: auto; border-radius: 4px; margin: 0.5rem 0; display: block;">`;

    console.log("Inserting image:", img); // Debug log

    try {
      this.insertHTML(img);
      this.resetImageModal();
      document.getElementById("image-modal").style.display = "none";
      this.showNotification("Image inserted successfully!", "success");

      // Force editor to update and trigger any change events
      this.editor.dispatchEvent(new Event("input"));
      this.updateWordCount();
    } catch (error) {
      console.error("Error inserting image:", error);
      this.showNotification(
        "Failed to insert image. Please try again.",
        "error"
      );
    }
  }

  resetImageModal() {
    // Reset URL tab
    document.getElementById("image-url").value = "";

    // Reset upload tab
    document.getElementById("image-file").value = "";
    document.getElementById("image-preview").style.display = "none";
    document.getElementById("preview-img").src = "";

    // Reset common fields
    document.getElementById("image-alt").value = "";
    document.getElementById("image-width").value = "";

    // Reset to URL tab
    document.getElementById("url-tab").classList.add("active");
    document.getElementById("upload-tab").classList.remove("active");
    document.getElementById("url-content").classList.add("active");
    document.getElementById("upload-content").classList.remove("active");

    // Clear stored image data
    this.selectedImageData = null;
  }

  showImageModal() {
    this.modules.modalManager.showImageModal();
  }

  showWatermarkModal() {
    this.modules.modalManager.showWatermarkModal();
  }

  // Toggle between adding and removing watermark
  toggleWatermark() {
    if (this.watermarkSettings) {
      this.removeWatermark();
    } else {
      this.showWatermarkModal();
    }
  }

  updateRangeValue(rangeId, displayId, suffix = "") {
    const range = document.getElementById(rangeId);
    const display = document.getElementById(displayId);
    display.textContent = range.value + suffix;

    range.addEventListener("input", () => {
      display.textContent = range.value + suffix;
    });
  }

  setupModalEvents() {
    this.modules.modalManager.setupModalEvents();
  }

  applyWatermark(text, opacity, size, color, angle) {
    this.modules.watermarkManager.applyWatermark(text, opacity, size, color, angle);
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
    return this.modules.watermarkManager.drawWatermarkOnCanvas(canvas, watermarkSettings);
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

  removeWatermark() {
    this.modules.watermarkManager.removeWatermark();
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
    this.modules.watermarkManager.updateWatermarkButtonState();
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
  async exportAsImage(format = "png") {
    try {
      const canvas = await this.renderDocumentToCanvas();

      // Convert canvas to blob
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${this.documentTitle.value || "document"}.${format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          resolve(blob);
        }, `image/${format}`);
      });
    } catch (error) {
      console.error("Error exporting as image:", error);
      this.showNotification(
        "Error exporting image. Please try again.",
        "error"
      );
    }
  }

  async saveDocument(showNotification = true) {
    return this.modules.saveManager.saveDocument(showNotification);
  }

  async saveDocumentWithVersion(commitMessage = null, showNotification = true) {
    return this.modules.saveManager.saveDocumentWithVersion(commitMessage, showNotification);
  }

  async saveDocumentOriginal(showNotification = true) {
    if (showNotification) {
      console.log("💾 Save button clicked");
    }

    const title = this.documentTitle.value.trim() || "Untitled Document";

    // Get content from the editor (single page mode)
    const editorContent = this.editor ? this.editor.innerHTML : "";

    // Don't save if content is just the placeholder text
    const isPlaceholderContent =
      editorContent === "<p>Start typing your document here...</p>" ||
      editorContent === "<p><br></p>" ||
      editorContent.trim() === "";

    const pagesContent = [editorContent]; // Wrap in array for compatibility

    const currentDocId = localStorage.getItem("currentDocumentId");

    const document = {
      id: currentDocId || "doc-" + Date.now(),
      title: title,
      content: pagesContent,
      description: "",
      lastModified: Date.now(),
      wordCount: this.countWords(editorContent),
      pageCount: 1,
    };

    if (!currentDocId) {
      document.createdAt = Date.now();
      document.template = "blank";
    }

    if (this.watermarkSettings) {
      document.watermark = this.watermarkSettings;
      console.log(
        "Including watermark in document save (method 2):",
        this.watermarkSettings
      );
    }

    if (showNotification) {
      console.log("📄 Saving document:", document);
    }

    try {
      // Always try server save first when authenticated
      if (showNotification) {
        console.log("🌐 Attempting server save...");
      }
      const result = await this.api.saveDocument(document);

      if (result && result.success) {
        if (showNotification) {
          console.log("✅ Document saved to server");
        }

        // Update current document ID if new
        if (!currentDocId) {
          localStorage.setItem("currentDocumentId", document.id);
          if (showNotification) {
            console.log("🆔 Set document ID:", document.id);
          }
        }

        // Update UI
        const now = new Date().toLocaleString();
        const lastSavedElement = document.getElementById("last-saved");
        if (lastSavedElement) {
          lastSavedElement.textContent = `Last saved: ${now}`;
        }

        if (showNotification) {
          this.showNotification("Document saved to server!", "success");
          console.log("✅ Document saved successfully:", document.title);
        }

        // Also save locally as backup
        this.saveDocumentLocally(document);
        return;
      } else {
        throw new Error("Server save failed");
      }
    } catch (error) {
      console.error("❌ Save error:", error);
      // Fallback to local save only
      this.saveDocumentLocally(document);
      if (showNotification) {
        this.showNotification(
          "Document saved locally (server offline)",
          "warning"
        );
      }
    }
  }

  saveDocumentLocally(document) {
    // Save to localStorage
    const documents = JSON.parse(localStorage.getItem("documents") || "[]");
    const existingIndex = documents.findIndex((doc) => doc.id === document.id);

    if (existingIndex !== -1) {
      documents[existingIndex] = document;
    } else {
      documents.unshift(document);
    }

    localStorage.setItem("documents", JSON.stringify(documents));

    // Legacy format for backward compatibility
    const legacyData = {
      title: document.title,
      content: document.content,
      watermark: this.watermarkSettings,
      lastModified: new Date().toISOString(),
    };
    localStorage.setItem("webdocs_document", JSON.stringify(legacyData));
  }

  countWords(text) {
    if (!text) return 0;
    // Remove HTML tags and count words
    const plainText = text.replace(/<[^>]*>/g, "");
    return plainText
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  // Calculate a simple hash for content comparison
  calculateContentHash(content, title) {
    // Normalize content by removing extra whitespace and empty paragraphs
    const normalizedContent = content
      .replace(/<p><br><\/p>/g, "") // Remove empty paragraphs
      .replace(/<p><\/p>/g, "") // Remove empty paragraphs without br
      .replace(/<br>/g, "") // Remove standalone br tags
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    const combined = `${title}|||${normalizedContent}`;

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  countWordsFromPages(pagesContent) {
    let totalText = "";
    pagesContent.forEach((pageContent) => {
      // Remove HTML tags and get plain text
      const temp = document.createElement("div");
      temp.innerHTML = pageContent;
      totalText += (temp.textContent || temp.innerText || "") + " ";
    });
    return totalText.trim() ? totalText.trim().split(/\s+/).length : 0;
  }

  openVersionControl() {
    this.modules.navigationManager.openVersionControl();
  }

  async goToDashboard() {
    await this.modules.navigationManager.goToDashboard();
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

  toggleExportMenu() {
    this.modules.exportManager.toggleExportMenu();
  }

  exportAsHTML() {
    this.modules.exportManager.exportAsHTML();
  }

  async exportAsPDF() {
    await this.modules.exportManager.exportAsPDF();
  }

  // Enhanced PDF export using canvas for better watermark rendering
  async exportAsPDFWithCanvas(title) {
    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("p", "mm", "a4");

      // Create canvas with watermark
      const canvas = await this.renderDocumentToCanvas({
        width: 794, // A4 width in pixels at 96 DPI
        height: 1123, // A4 height in pixels at 96 DPI
        scale: 2, // Higher resolution
        backgroundColor: "#ffffff",
      });

      // Convert canvas to image and add to PDF
      const imgData = canvas.toDataURL("image/png");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${title}.pdf`);
    } catch (error) {
      console.error("Canvas-based PDF export error:", error);
      // Fallback to regular export
      await ExportUtils.exportContentAsPDF(
        this.editor.innerHTML,
        title,
        this.watermarkSettings
      );
    }
  }

  async exportAsDOCX() {
    await this.modules.exportManager.exportAsDOCX();
  }

  downloadFile(content, filename, mimeType) {
    this.modules.exportManager.downloadFile(content, filename, mimeType);
  }

  downloadBlob(blob, filename) {
    this.modules.exportManager.downloadBlob(blob, filename);
  }

  closeExportMenu() {
    this.modules.exportManager.closeExportMenu();
  }

  setupAutoSave() {
    // Store reference to the interval for cleanup
    this.autoSaveInterval = setInterval(() => {
      // Only auto-save if user is not actively editing (debounce) and not currently saving
      if (!this.isSaving && Date.now() - this.lastEditTime > 5000) {
        // 5 seconds after last edit
        this.saveDocument(false); // Auto-save without notifications
      }
    }, 60000); // Auto-save every 60 seconds (increased from 30)
  }

  showNotification(message, type = "info") {
    // Delegate to modular system
    this.modules.notificationManager.showNotification(message, type);
  }

  showAlert(message, type = "info") {
    // Delegate to modular system
    this.modules.notificationManager.showAlert(message, type);
  }

  setupCustomContextMenu() {
    this.modules.contextMenuManager.setupCustomContextMenu();
  }

  showCustomContextMenu(event) {
    console.log("=== SHOW CUSTOM CONTEXT MENU ===");
    const contextMenu = document.getElementById("custom-context-menu");
    const selection = window.getSelection();
    const hasSelection = selection.toString().length > 0;

    console.log("Has selection:", hasSelection);
    console.log("Selection text:", selection.toString());
    console.log("Selection range count:", selection.rangeCount);

    // Store the current selection to preserve it
    this.savedSelection = null;
    if (hasSelection && selection.rangeCount > 0) {
      this.savedSelection = {
        range: selection.getRangeAt(0).cloneRange(),
        text: selection.toString(),
      };
      console.log("Saved selection:", this.savedSelection);
    } else {
      console.log("No selection to save");
    }

    // IMPORTANT: Store cursor position when context menu is shown (right-click)
    // This ensures we capture the position before any menu interactions
    this.storeCursorPosition();
    console.log("✅ Cursor position stored during context menu show");

    // Update menu items based on current state
    this.updateContextMenuState(hasSelection);

    // Position the menu
    const x = event.clientX;
    const y = event.clientY;

    // Show menu temporarily to get dimensions
    contextMenu.style.display = "block";
    contextMenu.style.visibility = "hidden";

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
    contextMenu.style.visibility = "visible";
  }

  hideCustomContextMenu() {
    const contextMenu = document.getElementById("custom-context-menu");
    contextMenu.style.display = "none";
  }

  updateContextMenuState(hasSelection) {
    // Enable/disable menu items based on current state
    const cutItem = document.getElementById("context-cut");
    const copyItem = document.getElementById("context-copy");
    const boldItem = document.getElementById("context-bold");
    const italicItem = document.getElementById("context-italic");
    const underlineItem = document.getElementById("context-underline");
    const aiWritingItem = document.getElementById("context-ai-writing");
    const refineTextItem = document.getElementById("context-refine-text");

    // Cut and Copy only available when text is selected
    if (hasSelection) {
      cutItem.classList.remove("disabled");
      copyItem.classList.remove("disabled");
    } else {
      cutItem.classList.add("disabled");
      copyItem.classList.add("disabled");
    }

    // Show appropriate AI option based on selection
    if (hasSelection) {
      // Show refine text option when text is selected
      aiWritingItem.style.display = "none";
      refineTextItem.style.display = "flex";
    } else {
      // Show AI writing option when no text is selected
      aiWritingItem.style.display = "flex";
      refineTextItem.style.display = "none";
    }

    // Update formatting buttons based on current selection
    if (hasSelection) {
      boldItem.classList.toggle("active", document.queryCommandState("bold"));
      italicItem.classList.toggle(
        "active",
        document.queryCommandState("italic")
      );
      underlineItem.classList.toggle(
        "active",
        document.queryCommandState("underline")
      );
    } else {
      boldItem.classList.remove("active");
      italicItem.classList.remove("active");
      underlineItem.classList.remove("active");
    }
  }

  setupContextMenuHandlers() {
    // Cut
    document.getElementById("context-cut").addEventListener("click", () => {
      if (
        !document.getElementById("context-cut").classList.contains("disabled")
      ) {
        document.execCommand("cut");
        this.saveState();
        this.updateWordCount();
      }
      this.hideCustomContextMenu();
    });

    // Copy
    document.getElementById("context-copy").addEventListener("click", () => {
      if (
        !document.getElementById("context-copy").classList.contains("disabled")
      ) {
        document.execCommand("copy");
      }
      this.hideCustomContextMenu();
    });

    // Paste
    document.getElementById("context-paste").addEventListener("click", () => {
      this.editor.focus();
      document.execCommand("paste");
      this.saveState();
      this.updateWordCount();
      this.hideCustomContextMenu();
    });

    // Select All
    document
      .getElementById("context-select-all")
      .addEventListener("click", () => {
        this.editor.focus();
        document.execCommand("selectAll");
        this.hideCustomContextMenu();
      });

    // Bold
    document.getElementById("context-bold").addEventListener("click", () => {
      this.formatText("bold");
      this.hideCustomContextMenu();
    });

    // Italic
    document.getElementById("context-italic").addEventListener("click", () => {
      this.formatText("italic");
      this.hideCustomContextMenu();
    });

    // Underline
    document
      .getElementById("context-underline")
      .addEventListener("click", () => {
        this.formatText("underline");
        this.hideCustomContextMenu();
      });

    // Insert Link
    document
      .getElementById("context-insert-link")
      .addEventListener("click", () => {
        this.showLinkModal();
        this.hideCustomContextMenu();
      });

    // Insert Image
    document
      .getElementById("context-insert-image")
      .addEventListener("click", () => {
        this.showImageModal();
        this.hideCustomContextMenu();
      });

    // Word Count
    document
      .getElementById("context-word-count")
      .addEventListener("click", () => {
        this.showWordCountDialog();
        this.hideCustomContextMenu();
      });

    // Save Document
    document.getElementById("context-save").addEventListener("click", () => {
      this.saveDocument();
      this.hideCustomContextMenu();
    });

    // AI Writing (when no text selected)
    document
      .getElementById("context-ai-writing")
      .addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showAIWritingPopup();
        this.hideCustomContextMenu();
      });

    // Refine text submenu handlers (when text is selected)
    const refineOptions = document.querySelectorAll(
      "#refine-submenu .context-menu-item"
    );
    console.log("Found refine options:", refineOptions.length);

    refineOptions.forEach((option, index) => {
      const action = option.getAttribute("data-action");
      console.log(`Setting up handler for option ${index}:`, action);

      option.addEventListener("click", (e) => {
        console.log("=== REFINE OPTION CLICKED ===");
        console.log("Clicked option:", action);
        console.log("Event:", e);

        e.preventDefault();
        e.stopPropagation();

        console.log("Calling handleRefineText with action:", action);
        this.handleRefineText(action);
        this.hideCustomContextMenu();
      });
    });
  }

  handleRefineText(action) {
    this.modules.aiManager.handleRefineText(action);
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
        console.warn("Failed to restore selection:", error);
        return false;
      }
    }
    return false;
  }

  async refineSelectedText(text, action) {
    return this.modules.aiManager.refineSelectedText(text, action);
  }

  processAIResponse(text) {
    return this.modules.aiManager.processAIResponse(text);
  }

  showRefineResultsPopup(text, actionTitle) {
    this.modules.aiManager.showRefineResultsPopup(text, actionTitle);
  }

  hideRefineResultsPopup() {
    this.modules.aiManager.hideRefineResultsPopup();
  }

  replaceSelectedText(newText) {
    this.modules.aiManager.replaceSelectedText(newText);
  }

  showAIWritingPopup() {
    this.modules.aiManager.showAIWritingPopup();
  }

  hideAIWritingPopup() {
    this.modules.aiManager.hideAIWritingPopup();
  }

  showAIResultsPopup() {
    const popup = document.getElementById("ai-results-popup");
    const writingPopup = document.getElementById("ai-writing-popup");

    // Position at same location as writing popup
    popup.style.left = writingPopup.style.left;
    popup.style.top = writingPopup.style.top;
    popup.style.display = "block";

    // Add show animation
    setTimeout(() => popup.classList.add("show"), 10);

    // Make results popup draggable too
    this.makeDraggable(popup);

    // Hide writing popup
    this.hideAIWritingPopup();
  }

  hideAIResultsPopup() {
    const popup = document.getElementById("ai-results-popup");
    popup.classList.remove("show");
    setTimeout(() => (popup.style.display = "none"), 200);
  }

  makeDraggable(popup) {
    // Try to find header with different class names
    const header =
      popup.querySelector(".ai-popup-header") ||
      popup.querySelector(".refine-popup-header") ||
      popup.querySelector(".popup-header");

    if (!header) {
      console.warn("No draggable header found for popup");
      return;
    }

    let isDragging = false;
    let startX, startY, startLeft, startTop;

    header.style.cursor = "move";
    header.style.userSelect = "none";

    header.addEventListener("mousedown", (e) => {
      // Don't start dragging if clicking on close button
      if (
        e.target.closest(".ai-close-btn") ||
        e.target.closest(".refine-close-btn")
      )
        return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(popup.style.left) || 0;
      startTop = parseInt(popup.style.top) || 0;

      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      const newLeft = startLeft + (e.clientX - startX);
      const newTop = startTop + (e.clientY - startY);

      // Keep popup within viewport bounds
      const maxLeft = window.innerWidth - popup.offsetWidth;
      const maxTop = window.innerHeight - popup.offsetHeight;

      popup.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + "px";
      popup.style.top = Math.max(0, Math.min(newTop, maxTop)) + "px";
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }
  // for sure
  storeCursorPosition() {
    try {
      console.log("=== STORING CURSOR POSITION ===");

      // Remove any existing cursor markers first
      this.removeCursorMarker();

      const selection = window.getSelection();
      console.log("Selection range count:", selection.rangeCount);

      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        console.log("Range start container:", range.startContainer.nodeName);
        console.log("Range start offset:", range.startOffset);
        console.log("Range collapsed:", range.collapsed);

        // Log the text content around the cursor for debugging
        if (range.startContainer.nodeType === Node.TEXT_NODE) {
          const text = range.startContainer.textContent;
          const before = text.substring(0, range.startOffset);
          const after = text.substring(range.startOffset);
          console.log("Text before cursor:", before);
          console.log("Text after cursor:", after);
        }

        // Only store if it's within our editor
        if (
          this.editor.contains(range.startContainer) &&
          this.editor.contains(range.endContainer)
        ) {
          // Insert a temporary marker at the cursor position
          const marker = document.createElement("span");
          marker.id = "cursor-position-marker";
          marker.style.display = "none";
          marker.textContent = "";

          // Clone the range and insert the marker
          const markerRange = range.cloneRange();
          markerRange.collapse(true); // Collapse to start

          try {
            markerRange.insertNode(marker);
            console.log(
              "✅ Cursor marker inserted successfully using range.insertNode"
            );

            // Restore the selection after the marker
            const newRange = document.createRange();
            newRange.setStartAfter(marker);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          } catch (insertError) {
            console.warn(
              "Range insertNode failed, trying text splitting method:",
              insertError.message
            );

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

              console.log(
                "✅ Cursor marker inserted using text splitting method"
              );
            } else {
              throw insertError; // Re-throw if not a text node
            }
          }

          return;
        } else {
          console.warn("Selection is not within editor bounds");
        }
      } else {
        console.warn("No selection range found");
      }

      // Fallback: insert marker at end of editor
      console.log("Using fallback cursor position at end");
      const marker = document.createElement("span");
      marker.id = "cursor-position-marker";
      marker.style.display = "none";
      marker.textContent = "";
      this.editor.appendChild(marker);
      console.log("✅ Fallback marker inserted at end");
    } catch (error) {
      console.error("Error storing cursor position:", error);
    }
  }

  removeCursorMarker() {
    const existingMarker = document.getElementById("cursor-position-marker");
    if (existingMarker) {
      existingMarker.remove();
    }
  }

  findCursorMarker() {
    const marker = document.getElementById("cursor-position-marker");
    if (marker) {
      console.log("✅ Cursor marker found in DOM");
      console.log(
        "Marker parent:",
        marker.parentNode
          ? marker.parentNode.tagName || marker.parentNode.nodeName
          : "NO PARENT"
      );
      console.log("Marker is in editor:", this.editor.contains(marker));
    } else {
      console.log("❌ Cursor marker NOT found in DOM");
    }
    return marker;
  }

  restoreCursorPosition() {
    if (this.savedRange) {
      try {
        // Validate that the saved range is still valid
        if (
          this.editor.contains(this.savedRange.startContainer) &&
          this.editor.contains(this.savedRange.endContainer)
        ) {
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(this.savedRange);
          this.editor.focus();
          return true;
        }
      } catch (error) {
        console.warn("Saved range is invalid:", error);
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
      if (
        this.editor.contains(range.startContainer) &&
        this.editor.contains(range.endContainer)
      ) {
        return range.cloneRange();
      }
    }
    return null;
  }

  async generateAIContent(prompt) {
    return this.modules.aiManager.generateAIContent(prompt);
  }

  generateFallbackContent(prompt) {
    return this.modules.aiManager.generateFallbackContent(prompt);
  }

  getDocumentContext() {
    return this.modules.aiManager.getDocumentContext();
  }

  convertMarkdownToHTML(markdown) {
    return this.modules.aiManager.convertMarkdownToHTML(markdown);
  }

  insertAIContent() {
    return this.modules.aiManager.insertAIContent();
  }

  async refineAIContent(action) {
    return this.modules.aiManager.refineAIContent(action);
  }

  shortenText(text) {
    return this.modules.aiManager.shortenText(text);
  }

  elaborateText(text) {
    return this.modules.aiManager.elaborateText(text);
  }

  makeFormal(text) {
    return this.modules.aiManager.makeFormal(text);
  }

  makeCasual(text) {
    return this.modules.aiManager.makeCasual(text);
  }

  convertToBullets(text) {
    return this.modules.aiManager.convertToBullets(text);
  }

  summarizeText(text) {
    return this.modules.aiManager.summarizeText(text);
  }

  setupAIWritingEventListeners() {
    return this.modules.aiManager.setupAIWritingEventListeners();
  }

  setupRefinePopupEventListeners() {
    return this.modules.aiManager.setupRefinePopupEventListeners();
  }

  showWordCountDialog() {
    this.modules.utils.showWordCountDialog();
  }
}

// Initialize the editor when the page loads
document.addEventListener("DOMContentLoaded", async () => {
  window.docsEditor = new DocsEditor();
  await window.docsEditor.loadDocument();
  console.log("✅ DocsEditor initialized and available globally");
});
