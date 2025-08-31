/**
 * TextFormatter - Handles text formatting, undo/redo functionality
 */
export class TextFormatter {
  constructor(editor, documentTitle, updatePageLayout, updateCurrentPage, updateToolbarState) {
    this.editor = editor;
    this.documentTitle = documentTitle;
    this.updatePageLayout = updatePageLayout;
    this.updateCurrentPage = updateCurrentPage;
    this.updateToolbarState = updateToolbarState;
    this.history = [];
    this.historyIndex = -1;
  }

  formatText(command, value = null) {
    this.editor.focus();
    document.execCommand(command, false, value);
    this.updateToolbarState();
    this.saveState();
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

  insertHTML(html) {
    console.log("insertHTML called with:", html);

    // Ensure the editor has focus
    this.editor.focus();

    const selection = window.getSelection();
    console.log("Current selection range count:", selection.rangeCount);

    if (selection.rangeCount === 0) {
      console.log("No selection found, creating one at end of editor");
      // If no selection, create one at the end of the editor
      const range = document.createRange();
      range.selectNodeContents(this.editor);
      range.collapse(false); // Collapse to end
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      const range = selection.getRangeAt(0);
      console.log(
        "Current selection start:",
        range.startContainer,
        "offset:",
        range.startOffset
      );
    }

    // Try modern approach first
    if (
      document.queryCommandSupported &&
      document.queryCommandSupported("insertHTML")
    ) {
      try {
        console.log("Trying document.execCommand insertHTML");
        const result = document.execCommand("insertHTML", false, html);
        console.log("execCommand result:", result);
        if (result) {
          this.saveState();
          this.updatePageLayout();
          return;
        }
      } catch (e) {
        console.warn("insertHTML failed, using fallback method:", e);
      }
    } else {
      console.log("insertHTML not supported, using fallback");
    }

    // Fallback method that works better with modern browsers
    try {
      const range = selection.getRangeAt(0);
      range.deleteContents();

      // Create a temporary element to parse the HTML
      const temp = document.createElement("div");
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
      console.warn(
        "Range-based insertion failed, using direct DOM manipulation:",
        e
      );

      // Last resort: direct DOM manipulation
      const temp = document.createElement("div");
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

  // Add method to call word count update (will be injected)
  updateWordCount() {
    // This will be overridden by the main class
  }
}
