/**
 * ContextMenuManager - Handles right-click context menu functionality
 */
export class ContextMenuManager {
  constructor(editor, textFormatter, saveManager, exportManager, notificationManager) {
    this.editor = editor;
    this.textFormatter = textFormatter;
    this.saveManager = saveManager;
    this.exportManager = exportManager;
    this.notificationManager = notificationManager;
    this.contextMenu = null;
    this.currentSelection = null;
    this.initializeContextMenu();
  }

  initializeContextMenu() {
    this.createContextMenu();
    this.attachEventListeners();
  }

  createContextMenu() {
    // Remove existing context menu if it exists
    if (this.contextMenu) {
      this.contextMenu.remove();
    }

    this.contextMenu = document.createElement("div");
    this.contextMenu.id = "context-menu";
    this.contextMenu.className = "context-menu";
    this.contextMenu.style.cssText = `
      position: fixed;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      padding: 4px 0;
      min-width: 150px;
      z-index: 10000;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
    `;

    // Create context menu items
    const menuItems = this.getContextMenuItems();
    menuItems.forEach((item) => {
      if (item.separator) {
        const separator = document.createElement("div");
        separator.className = "context-menu-separator";
        separator.style.cssText = `
          height: 1px;
          background: #eee;
          margin: 4px 0;
        `;
        this.contextMenu.appendChild(separator);
      } else {
        const menuItem = document.createElement("div");
        menuItem.className = "context-menu-item";
        menuItem.style.cssText = `
          padding: 8px 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background-color 0.1s;
        `;

        // Add hover effect
        menuItem.addEventListener("mouseenter", () => {
          menuItem.style.backgroundColor = "#f0f0f0";
        });
        menuItem.addEventListener("mouseleave", () => {
          menuItem.style.backgroundColor = "transparent";
        });

        // Add icon if provided
        if (item.icon) {
          const icon = document.createElement("i");
          icon.className = item.icon;
          icon.style.width = "16px";
          menuItem.appendChild(icon);
        }

        // Add text
        const text = document.createElement("span");
        text.textContent = item.text;
        menuItem.appendChild(text);

        // Add keyboard shortcut if provided
        if (item.shortcut) {
          const shortcut = document.createElement("span");
          shortcut.textContent = item.shortcut;
          shortcut.style.cssText = `
            margin-left: auto;
            color: #888;
            font-size: 12px;
          `;
          menuItem.appendChild(shortcut);
        }

        // Add click handler
        menuItem.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.hideContextMenu();
          if (item.action) {
            item.action();
          }
        });

        // Disable item if condition is met
        if (item.disabled && item.disabled()) {
          menuItem.style.opacity = "0.5";
          menuItem.style.cursor = "not-allowed";
          menuItem.style.pointerEvents = "none";
        }

        this.contextMenu.appendChild(menuItem);
      }
    });

    document.body.appendChild(this.contextMenu);
  }

  getContextMenuItems() {
    return [
      {
        text: "Cut",
        icon: "fas fa-cut",
        shortcut: "Ctrl+X",
        action: () => this.cutText(),
        disabled: () => !this.hasSelection(),
      },
      {
        text: "Copy",
        icon: "fas fa-copy",
        shortcut: "Ctrl+C",
        action: () => this.copyText(),
        disabled: () => !this.hasSelection(),
      },
      {
        text: "Paste",
        icon: "fas fa-paste",
        shortcut: "Ctrl+V",
        action: () => this.pasteText(),
      },
      { separator: true },
      {
        text: "Select All",
        icon: "fas fa-expand-arrows-alt",
        shortcut: "Ctrl+A",
        action: () => this.selectAll(),
      },
      { separator: true },
      {
        text: "Bold",
        icon: "fas fa-bold",
        shortcut: "Ctrl+B",
        action: () => this.textFormatter.toggleBold(),
        disabled: () => !this.hasSelection(),
      },
      {
        text: "Italic",
        icon: "fas fa-italic",
        shortcut: "Ctrl+I",
        action: () => this.textFormatter.toggleItalic(),
        disabled: () => !this.hasSelection(),
      },
      {
        text: "Underline",
        icon: "fas fa-underline",
        shortcut: "Ctrl+U",
        action: () => this.textFormatter.toggleUnderline(),
        disabled: () => !this.hasSelection(),
      },
      { separator: true },
      {
        text: "Insert Link",
        icon: "fas fa-link",
        action: () => this.insertLink(),
        disabled: () => !this.hasSelection(),
      },
      {
        text: "Insert Image",
        icon: "fas fa-image",
        action: () => this.insertImage(),
      },
      { separator: true },
      {
        text: "Find & Replace",
        icon: "fas fa-search",
        shortcut: "Ctrl+H",
        action: () => this.showFindReplace(),
      },
      { separator: true },
      {
        text: "Save Document",
        icon: "fas fa-save",
        shortcut: "Ctrl+S",
        action: () => this.saveManager.saveDocument(),
      },
      {
        text: "Export as...",
        icon: "fas fa-download",
        action: () => this.showExportMenu(),
      },
    ];
  }

  attachEventListeners() {
    // Attach context menu to editor
    this.editor.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.showContextMenu(e);
    });

    // Hide context menu on click outside
    document.addEventListener("click", (e) => {
      if (!this.contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
    });

    // Hide context menu on escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.hideContextMenu();
      }
    });

    // Hide context menu on scroll
    document.addEventListener("scroll", () => {
      this.hideContextMenu();
    });
  }

  showContextMenu(event) {
    // Store current selection
    this.currentSelection = window.getSelection();

    // Position the context menu
    const x = event.clientX;
    const y = event.clientY;

    // Recreate context menu to update disabled states
    this.createContextMenu();

    // Calculate position to keep menu within viewport
    const menuRect = this.contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let finalX = x;
    let finalY = y;

    // Adjust horizontal position if menu would go off-screen
    if (x + menuRect.width > viewportWidth) {
      finalX = x - menuRect.width;
    }

    // Adjust vertical position if menu would go off-screen
    if (y + menuRect.height > viewportHeight) {
      finalY = y - menuRect.height;
    }

    // Ensure menu doesn't go off the left or top edge
    finalX = Math.max(0, finalX);
    finalY = Math.max(0, finalY);

    this.contextMenu.style.left = finalX + "px";
    this.contextMenu.style.top = finalY + "px";
    this.contextMenu.style.display = "block";
  }

  hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.style.display = "none";
    }
  }

  hasSelection() {
    const selection = window.getSelection();
    return selection && selection.toString().length > 0;
  }

  cutText() {
    if (this.hasSelection()) {
      document.execCommand("cut");
      this.notificationManager.showNotification("Text cut to clipboard", "success");
    }
  }

  copyText() {
    if (this.hasSelection()) {
      document.execCommand("copy");
      this.notificationManager.showNotification("Text copied to clipboard", "success");
    }
  }

  async pasteText() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        this.textFormatter.insertHTML(text);
        this.notificationManager.showNotification("Text pasted", "success");
      } else {
        // Fallback for older browsers
        document.execCommand("paste");
      }
    } catch (error) {
      console.error("Paste error:", error);
      this.notificationManager.showNotification("Could not paste text", "error");
    }
  }

  selectAll() {
    const range = document.createRange();
    range.selectNodeContents(this.editor);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  insertLink() {
    const selection = window.getSelection();
    if (!selection.toString()) {
      this.notificationManager.showNotification("Please select text first", "warning");
      return;
    }

    const url = prompt("Enter URL:");
    if (url) {
      const link = `<a href="${url}" target="_blank">${selection.toString()}</a>`;
      this.textFormatter.insertHTML(link);
      this.notificationManager.showNotification("Link inserted", "success");
    }
  }

  insertImage() {
    const url = prompt("Enter image URL:");
    if (url) {
      const img = `<img src="${url}" alt="Inserted image" style="max-width: 100%; height: auto;">`;
      this.textFormatter.insertHTML(img);
      this.notificationManager.showNotification("Image inserted", "success");
    }
  }

  showFindReplace() {
    // Trigger find and replace modal
    const findReplaceModal = document.getElementById("find-replace-modal");
    if (findReplaceModal) {
      findReplaceModal.style.display = "block";
      const findInput = document.getElementById("find-text");
      if (findInput) {
        findInput.focus();
      }
    } else {
      this.notificationManager.showNotification("Find & Replace not available", "warning");
    }
  }

  showExportMenu() {
    // Create export submenu
    const exportMenu = document.createElement("div");
    exportMenu.className = "export-submenu";
    exportMenu.style.cssText = `
      position: fixed;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      padding: 4px 0;
      min-width: 120px;
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
    `;

    const exportFormats = [
      { format: "html", icon: "fab fa-html5", name: "HTML" },
      { format: "txt", icon: "fas fa-file-alt", name: "Text" },
      { format: "pdf", icon: "fas fa-file-pdf", name: "PDF" },
      { format: "png", icon: "fas fa-image", name: "PNG Image" },
      { format: "docx", icon: "fas fa-file-word", name: "Word Document" },
    ];

    exportFormats.forEach((item) => {
      const menuItem = document.createElement("div");
      menuItem.className = "export-menu-item";
      menuItem.style.cssText = `
        padding: 8px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: background-color 0.1s;
      `;

      menuItem.addEventListener("mouseenter", () => {
        menuItem.style.backgroundColor = "#f0f0f0";
      });
      menuItem.addEventListener("mouseleave", () => {
        menuItem.style.backgroundColor = "transparent";
      });

      const icon = document.createElement("i");
      icon.className = item.icon;
      icon.style.width = "16px";
      menuItem.appendChild(icon);

      const text = document.createElement("span");
      text.textContent = item.name;
      menuItem.appendChild(text);

      menuItem.addEventListener("click", () => {
        exportMenu.remove();
        this.exportDocument(item.format);
      });

      exportMenu.appendChild(menuItem);
    });

    // Position export menu next to context menu
    const contextMenuRect = this.contextMenu.getBoundingClientRect();
    exportMenu.style.left = contextMenuRect.right + "px";
    exportMenu.style.top = contextMenuRect.bottom - 100 + "px";

    document.body.appendChild(exportMenu);

    // Remove export menu after a delay or on click outside
    setTimeout(() => {
      if (exportMenu.parentNode) {
        exportMenu.remove();
      }
    }, 5000);

    document.addEventListener(
      "click",
      (e) => {
        if (!exportMenu.contains(e.target)) {
          exportMenu.remove();
        }
      },
      { once: true }
    );
  }

  async exportDocument(format) {
    try {
      const title = document.title || "document";
      await this.exportManager.exportDocument(format, title);
    } catch (error) {
      console.error("Export error:", error);
      this.notificationManager.showNotification("Export failed", "error");
    }
  }

  // Method to programmatically show context menu at specific coordinates
  showContextMenuAt(x, y) {
    const syntheticEvent = {
      clientX: x,
      clientY: y,
      preventDefault: () => {},
    };
    this.showContextMenu(syntheticEvent);
  }

  // Method to add custom menu items
  addCustomMenuItem(item, position = -1) {
    // This would require recreating the context menu with the new item
    // Implementation depends on specific requirements
    console.log("Custom menu item added:", item);
  }

  // Method to remove custom menu items
  removeCustomMenuItem(itemId) {
    // Implementation for removing custom items
    console.log("Custom menu item removed:", itemId);
  }

  // Method to update menu items based on current context
  updateMenuItems() {
    if (this.contextMenu && this.contextMenu.style.display === "block") {
      this.createContextMenu();
    }
  }

  destroy() {
    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
  }
}
