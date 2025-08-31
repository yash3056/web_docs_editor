/**
 * SaveManager - Handles document saving functionality
 */
export class SaveManager {
  constructor(editor, documentTitle, api, watermarkSettings, notificationManager, utils) {
    this.editor = editor;
    this.documentTitle = documentTitle;
    this.api = api;
    this.watermarkSettings = watermarkSettings;
    this.notificationManager = notificationManager;
    this.utils = utils;
    this.isSaving = false;
    this.autoSaveTimeout = null;
    this.autoSaveInterval = null;
    this.lastEditTime = Date.now();
  }

  async saveDocument(showNotification = true) {
    // Prevent concurrent saves
    if (this.isSaving) {
      if (showNotification) {
        console.log("⏳ Save already in progress, skipping...");
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
        console.log("⏳ Save already in progress, skipping duplicate...");
      }
      return { success: false, reason: "Save in progress" };
    }

    this.isSaving = true; // Set saving flag

    try {
      if (showNotification) {
        console.log("💾 Saving document...");
      }

      const title = this.documentTitle.value.trim() || "Untitled Document";
      const editorContent = this.editor ? this.editor.innerHTML : "";

      console.log("💾 Save debug info:");
      console.log("💾 Title:", title);
      console.log("💾 Content length:", editorContent.length);
      console.log("💾 Content preview:", editorContent.substring(0, 150) + "...");

      const isPlaceholderContent = this.utils.isPlaceholderContent(editorContent);
      console.log("💾 Is placeholder content:", isPlaceholderContent);

      const pagesContent = [editorContent]; // Wrap in array for compatibility
      const currentDocId = localStorage.getItem("currentDocumentId");

      // Calculate content hash for change detection
      const contentHash = this.calculateContentHash(editorContent, title);

      // Check if content has changed since last save
      const lastContentHash = localStorage.getItem(
        "lastContentHash_" + (currentDocId || "new")
      );
      const hasContentChanged = contentHash !== lastContentHash;

      const isEmptyContent = this.utils.isPlaceholderContent(editorContent);
      const plainTextContent = editorContent.replace(/<[^>]*>/g, "").trim();
      const hasRealContent = plainTextContent.length > 0;

      if (showNotification) {
        console.log("🔍 Content analysis:", {
          hasContentChanged,
          isEmptyContent,
          hasRealContent,
          currentDocId: !!currentDocId,
          lastContentHash: !!lastContentHash,
          plainTextLength: plainTextContent.length,
        });
      }

      // Check if watermark settings have changed
      const lastWatermarkHash = localStorage.getItem(
        "lastWatermarkHash_" + (currentDocId || "new")
      );
      const currentWatermarkHash = this.watermarkSettings
        ? JSON.stringify(this.watermarkSettings)
        : "";
      const hasWatermarkChanged = currentWatermarkHash !== lastWatermarkHash;

      // Skip saving if no changes detected
      if (
        (!hasContentChanged && !hasWatermarkChanged && currentDocId) ||
        (isPlaceholderContent && currentDocId && !hasWatermarkChanged)
      ) {
        if (showNotification) {
          if (!hasContentChanged && !hasWatermarkChanged) {
            console.log("📄 No content or watermark changes detected, skipping version creation");
            this.notificationManager.showNotification("No changes to save", "info");
          } else if (isPlaceholderContent) {
            console.log("📄 Placeholder content detected, skipping version creation");
            this.notificationManager.showNotification("Cannot save empty document", "warning");
          }
        }
        return { success: true, reason: "No changes detected" };
      }

      // For new documents, allow saving even with minimal content as long as it's not just placeholder
      if (!currentDocId && isPlaceholderContent) {
        if (showNotification) {
          console.log("📄 Cannot save new document with only placeholder content");
          this.notificationManager.showNotification("Please add some content before saving", "warning");
        }
        return { success: false, reason: "New document needs content" };
      }

      const document = {
        id: currentDocId || "doc-" + Date.now(),
        title: title,
        content: pagesContent,
        description: "",
        lastModified: Date.now(),
        wordCount: this.countWords(editorContent),
        pageCount: 1,
      };

      console.log("💾 Saving document:", {
        id: document.id,
        title: document.title,
        currentDocId: currentDocId,
        isNewDocument: !currentDocId,
      });

      if (!currentDocId) {
        localStorage.setItem("currentDocumentId", document.id);
        console.log("🆔 Set new document ID:", document.id);
      }

      if (this.watermarkSettings) {
        document.watermark = this.watermarkSettings;
        console.log("Including watermark in document save:", this.watermarkSettings);
      }

      try {
        // Always try server save first when authenticated
        if (showNotification) {
          console.log("🌐 Attempting server save...");
        }

        const result = await this.api.saveDocumentWithVersion(
          document,
          commitMessage || "Document updated"
        );

        if (result && result.success) {
          if (showNotification) {
            console.log("✅ Document saved to server with version control");
          }

          // Store content hash to prevent duplicate saves
          localStorage.setItem("lastContentHash_" + document.id, contentHash);

          // Store watermark hash to prevent duplicate saves
          const currentWatermarkHash = this.watermarkSettings
            ? JSON.stringify(this.watermarkSettings)
            : "";
          localStorage.setItem("lastWatermarkHash_" + document.id, currentWatermarkHash);

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
            this.notificationManager.showNotification("Document saved with version control!", "success");
          }

          return result;
        } else {
          throw new Error("Server save failed");
        }
      } catch (error) {
        console.error("Error saving document:", error);

        // Store content hash even for local save
        localStorage.setItem("lastContentHash_" + document.id, contentHash);

        // Store watermark hash even for local save
        const currentWatermarkHash = this.watermarkSettings
          ? JSON.stringify(this.watermarkSettings)
          : "";
        localStorage.setItem("lastWatermarkHash_" + document.id, currentWatermarkHash);

        // Fallback to local save
        this.saveDocumentLocally(document);

        if (showNotification) {
          this.notificationManager.showNotification("Document saved locally (server error)", "warning");
        }

        return { success: true, document };
      }
    } finally {
      this.isSaving = false; // Clear saving flag
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

  setupAutoSave() {
    // Store reference to the interval for cleanup
    this.autoSaveInterval = setInterval(() => {
      // Only auto-save if user is not actively editing (debounce) and not currently saving
      if (!this.isSaving && Date.now() - this.lastEditTime > 5000) {
        // 5 seconds after last edit
        this.saveDocument(false); // Auto-save without notifications
      }
    }, 60000); // Auto-save every 60 seconds
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

  updateLastEditTime() {
    this.lastEditTime = Date.now();
  }

  scheduleAutoSave() {
    // Auto-save after a short delay to avoid too frequent saves
    clearTimeout(this.autoSaveTimeout);
    this.autoSaveTimeout = setTimeout(() => {
      // Only auto-save if not currently saving
      if (!this.isSaving) {
        this.saveDocument(false); // Auto-save without notifications
      }
    }, 5000); // Save 5 seconds after user stops typing
  }
}
