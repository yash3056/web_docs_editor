/**
 * LineSpacingManager - Handles line spacing functionality
 */
export class LineSpacingManager {
  constructor(editor, notificationManager) {
    this.editor = editor;
    this.notificationManager = notificationManager;
    this.currentLineSpacing = "1.5"; // Default line spacing
    this.initializeLineSpacing();
  }

  initializeLineSpacing() {
    // Set default line spacing
    this.applyLineSpacing(this.currentLineSpacing);
    this.updateLineSpacingButton();
  }

  applyLineSpacing(spacing) {
    console.log("Applying line spacing:", spacing);
    const selection = window.getSelection();

    if (selection.rangeCount === 0 || selection.toString().trim() === "") {
      // No selection or empty selection, apply to entire editor content
      console.log("No selection, applying to all content");
      this.applyLineSpacingToEditor(spacing);
    } else {
      // Apply to selected content
      console.log("Applying to selection");
      this.applySpacingToSelection(spacing);
    }

    this.updateLineSpacingButton(spacing);
    // Note: saveState should be called from the main editor class
  }

  applyLineSpacingToEditor(spacing) {
    // Apply to the editor itself first
    this.setElementLineSpacing(this.editor, spacing);

    // Also apply to all child block elements
    const blockElements = this.editor.querySelectorAll(
      "p, div, h1, h2, h3, h4, h5, h6, li, blockquote"
    );
    blockElements.forEach((element) => {
      this.setElementLineSpacing(element, spacing);
    });

    console.log(
      `Applied line spacing ${spacing} to editor and ${blockElements.length} block elements`
    );
  }

  getCurrentParagraphElement() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return null;

    let node = selection.getRangeAt(0).startContainer;

    // Walk up the DOM tree to find a block element
    while (node && node !== this.editor) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (this.isParagraphElement(node)) {
          return node;
        }
      }
      node = node.parentNode;
    }

    // If no paragraph found, look for the closest block-level element
    node = selection.getRangeAt(0).startContainer;
    while (node && node !== this.editor) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        if (
          ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote"].includes(
            tagName
          )
        ) {
          return node;
        }
      }
      node = node.parentNode;
    }

    // If still no element found, try to wrap content in a paragraph
    try {
      this.wrapContentInParagraph();
      // Try again after wrapping
      const newSelection = window.getSelection();
      if (newSelection.rangeCount > 0) {
        node = newSelection.getRangeAt(0).startContainer;
        while (node && node !== this.editor) {
          if (node.nodeType === Node.ELEMENT_NODE && this.isParagraphElement(node)) {
            return node;
          }
          node = node.parentNode;
        }
      }
    } catch (error) {
      console.warn("Failed to wrap content in paragraph:", error);
    }

    return null;
  }

  isParagraphElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    const blockElements = [
      "p",
      "div",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "li",
      "blockquote",
    ];
    return blockElements.includes(element.tagName.toLowerCase());
  }

  wrapContentInParagraph() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    let container = range.startContainer;

    // If we're in a text node, get its parent
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentNode;
    }

    // Check if we're directly in the editor (not in a block element)
    if (container === this.editor) {
      // Wrap the content in a paragraph
      const p = document.createElement("p");
      
      // Get all direct text nodes and inline elements
      const childNodes = Array.from(this.editor.childNodes);
      childNodes.forEach((node) => {
        if (
          node.nodeType === Node.TEXT_NODE ||
          (node.nodeType === Node.ELEMENT_NODE &&
            !this.isParagraphElement(node))
        ) {
          p.appendChild(node.cloneNode(true));
          node.remove();
        }
      });

      if (p.childNodes.length > 0) {
        this.editor.insertBefore(p, this.editor.firstChild);
        
        // Update selection to be in the new paragraph
        const newRange = document.createRange();
        newRange.selectNodeContents(p);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    }
  }

  setElementLineSpacing(element, spacing) {
    if (element && element.style) {
      element.style.lineHeight = spacing;
    }
  }

  applySpacingToSelection(spacing) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const elements = this.getParagraphElementsInRange(range);

    elements.forEach((element) => {
      this.setElementLineSpacing(element, spacing);
    });

    console.log(`Applied spacing ${spacing} to ${elements.length} selected elements`);
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
                },
            }
        );

        let node;
        while ((node = walker.nextNode())) {
            elements.push(node);
        }

        return elements;
    }

    wrapContentInParagraph() {
        // If there's loose text content in the editor, wrap it in a paragraph
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);

        // Get the current cursor position
        const currentNode = range.startContainer;

        // If we're in a text node directly in the editor
        if (
            currentNode.parentNode === this.editor ||
            (currentNode === this.editor && this.editor.childNodes.length > 0)
        ) {
            // Create a paragraph element
            const p = document.createElement("p");

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

    adjustParagraphSpacing(position, value) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const currentElement = this.getCurrentParagraphElement();
    if (currentElement) {
      this.setParagraphSpacing(currentElement, position, value);
    }
  }

  setParagraphSpacing(element, position, value) {
    if (position === "before") {
      element.style.marginTop = value + "pt";
    } else if (position === "after") {
      element.style.marginBottom = value + "pt";
    }
  }

  // Set specific line spacing values
  setSingleSpacing() {
    this.applyLineSpacing("1");
  }

  setOnePointFiveSpacing() {
    this.applyLineSpacing("1.5");
  }

  setDoubleSpacing() {
    this.applyLineSpacing("2");
  }

  setTripleSpacing() {
    this.applyLineSpacing("3");
  }

  setCustomSpacing(spacing) {
    // Validate the spacing value
    const numericSpacing = parseFloat(spacing);
    if (isNaN(numericSpacing) || numericSpacing < 0.5 || numericSpacing > 5) {
      this.notificationManager.showNotification(
        "Invalid line spacing. Please enter a value between 0.5 and 5",
        "error"
      );
      return false;
    }

    this.applyLineSpacing(spacing.toString());
    return true;
  }

  // Increase line spacing
  increaseLineSpacing() {
    const current = parseFloat(this.currentLineSpacing);
    const newSpacing = Math.min(current + 0.1, 5); // Max 5x spacing
    this.applyLineSpacing(newSpacing.toFixed(1));
  }

  // Decrease line spacing
  decreaseLineSpacing() {
    const current = parseFloat(this.currentLineSpacing);
    const newSpacing = Math.max(current - 0.1, 0.5); // Min 0.5x spacing
    this.applyLineSpacing(newSpacing.toFixed(1));
  }

  // Toggle between common line spacing values
  toggleLineSpacing() {
    const spacingCycle = ["1", "1.5", "2", "3"];
    const currentIndex = spacingCycle.indexOf(this.currentLineSpacing);
    const nextIndex = (currentIndex + 1) % spacingCycle.length;
    this.applyLineSpacing(spacingCycle[nextIndex]);
  }

  // Show line spacing modal/dropdown
  showLineSpacingOptions() {
    const modal = document.getElementById("line-spacing-modal");
    if (modal) {
      modal.style.display = "block";
      this.populateLineSpacingModal();
    } else {
      this.createLineSpacingModal();
    }
  }

  createLineSpacingModal() {
    const modal = document.createElement("div");
    modal.id = "line-spacing-modal";
    modal.className = "modal";
    modal.style.cssText = `
      display: block;
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.5);
    `;

    modal.innerHTML = `
      <div class="modal-content" style="
        background-color: #fefefe;
        margin: 15% auto;
        padding: 20px;
        border: none;
        border-radius: 8px;
        width: 300px;
        max-width: 90%;
      ">
        <div class="modal-header" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 1px solid #eee;
          padding-bottom: 15px;
        ">
          <h3 style="margin: 0; color: #333;">Line Spacing</h3>
          <span class="close" style="
            color: #aaa;
            font-size: 24px;
            font-weight: bold;
            cursor: pointer;
          ">&times;</span>
        </div>
        <div class="line-spacing-options" style="
          display: flex;
          flex-direction: column;
          gap: 10px;
        ">
          <button class="spacing-btn" data-spacing="1" style="
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            text-align: left;
            transition: background-color 0.2s;
          ">
            <span style="font-weight: bold;">1.0</span> Single spacing
          </button>
          <button class="spacing-btn" data-spacing="1.5" style="
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            text-align: left;
            transition: background-color 0.2s;
          ">
            <span style="font-weight: bold;">1.5</span> One and a half spacing
          </button>
          <button class="spacing-btn" data-spacing="2" style="
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            text-align: left;
            transition: background-color 0.2s;
          ">
            <span style="font-weight: bold;">2.0</span> Double spacing
          </button>
          <button class="spacing-btn" data-spacing="3" style="
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            text-align: left;
            transition: background-color 0.2s;
          ">
            <span style="font-weight: bold;">3.0</span> Triple spacing
          </button>
          <div style="
            border-top: 1px solid #eee;
            margin-top: 10px;
            padding-top: 15px;
          ">
            <label style="
              display: block;
              margin-bottom: 5px;
              font-weight: bold;
              color: #333;
            ">Custom spacing:</label>
            <div style="display: flex; gap: 10px; align-items: center;">
              <input type="number" id="custom-spacing" min="0.5" max="5" step="0.1" 
                     placeholder="1.5" style="
                flex: 1;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
              ">
              <button id="apply-custom-spacing" style="
                padding: 8px 15px;
                background-color: #007cba;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
              ">Apply</button>
            </div>
            <small style="color: #666; font-size: 12px;">
              Enter a value between 0.5 and 5.0
            </small>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    const closeBtn = modal.querySelector(".close");
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });

    // Spacing button listeners
    const spacingBtns = modal.querySelectorAll(".spacing-btn");
    spacingBtns.forEach((btn) => {
      btn.addEventListener("mouseenter", () => {
        btn.style.backgroundColor = "#f0f0f0";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.backgroundColor = "white";
      });
      btn.addEventListener("click", () => {
        const spacing = btn.getAttribute("data-spacing");
        this.applyLineSpacing(spacing);
        modal.style.display = "none";
      });
    });

    // Custom spacing listener
    const customInput = modal.querySelector("#custom-spacing");
    const applyBtn = modal.querySelector("#apply-custom-spacing");

    applyBtn.addEventListener("click", () => {
      const customSpacing = customInput.value;
      if (this.setCustomSpacing(customSpacing)) {
        modal.style.display = "none";
      }
    });

    customInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const customSpacing = customInput.value;
        if (this.setCustomSpacing(customSpacing)) {
          modal.style.display = "none";
        }
      }
    });

    // Close modal when clicking outside
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
      }
    });

    document.body.appendChild(modal);
    this.populateLineSpacingModal();
  }

  populateLineSpacingModal() {
    const modal = document.getElementById("line-spacing-modal");
    if (!modal) return;

    // Highlight current spacing
    const spacingBtns = modal.querySelectorAll(".spacing-btn");
    spacingBtns.forEach((btn) => {
      const spacing = btn.getAttribute("data-spacing");
      if (spacing === this.currentLineSpacing) {
        btn.style.backgroundColor = "#e3f2fd";
        btn.style.borderColor = "#007cba";
      } else {
        btn.style.backgroundColor = "white";
        btn.style.borderColor = "#ddd";
      }
    });

    // Set current value in custom input
    const customInput = modal.querySelector("#custom-spacing");
    if (customInput) {
      customInput.value = this.currentLineSpacing;
    }
  }

  // Update line spacing button state in toolbar
  updateLineSpacingButton() {
    const lineSpacingBtn = document.getElementById("line-spacing-btn");
    if (lineSpacingBtn) {
      // Update button text or tooltip to show current spacing
      lineSpacingBtn.title = `Line Spacing: ${this.currentLineSpacing}`;
      
      // Update button text if it shows the current value
      const btnText = lineSpacingBtn.querySelector(".spacing-value");
      if (btnText) {
        btnText.textContent = this.currentLineSpacing;
      }
    }

    // Update dropdown button if it exists
    const dropdownBtn = document.getElementById("line-spacing-dropdown");
    if (dropdownBtn) {
      dropdownBtn.title = `Current line spacing: ${this.currentLineSpacing}`;
    }
  }

  // Apply line spacing to selected text only
  applyLineSpacingToSelection(spacing) {
    const selection = window.getSelection();
    if (!selection.rangeCount) {
      this.notificationManager.showNotification(
        "Please select text to apply line spacing",
        "warning"
      );
      return;
    }

    try {
      const range = selection.getRangeAt(0);
      const selectedContent = range.extractContents();
      
      // Create a wrapper with the line spacing
      const wrapper = document.createElement("div");
      wrapper.style.lineHeight = spacing;
      wrapper.appendChild(selectedContent);
      
      // Insert the wrapped content back
      range.insertNode(wrapper);
      
      // Clear selection
      selection.removeAllRanges();
      
      this.notificationManager.showNotification(
        `Line spacing ${spacing} applied to selection`,
        "success"
      );
    } catch (error) {
      console.error("Error applying line spacing to selection:", error);
      this.notificationManager.showNotification(
        "Failed to apply line spacing to selection",
        "error"
      );
    }
  }

  // Remove line spacing (reset to normal)
  removeLineSpacing() {
    this.applyLineSpacing("normal");
  }

  // Get current line spacing
  getCurrentLineSpacing() {
    return this.currentLineSpacing;
  }

  // Set line spacing from external source (e.g., loading document)
  setLineSpacing(spacing, silent = false) {
    this.currentLineSpacing = spacing;
    this.editor.style.lineHeight = spacing;
    
    if (!silent) {
      this.updateLineSpacingButton();
      this.notificationManager.showNotification(
        `Line spacing set to ${spacing}`,
        "info"
      );
    }
  }

  // Save line spacing preference
  saveLineSpacingPreference() {
    localStorage.setItem("preferred-line-spacing", this.currentLineSpacing);
  }

  // Load line spacing preference
  loadLineSpacingPreference() {
    const savedSpacing = localStorage.getItem("preferred-line-spacing");
    if (savedSpacing) {
      this.setLineSpacing(savedSpacing, true);
    }
  }

  // Apply line spacing to new content (useful for dynamic content)
  applyLineSpacingToNewContent(element) {
    if (element && element.style) {
      element.style.lineHeight = this.currentLineSpacing;
    }
  }

  // Reset line spacing to default
  resetToDefault() {
    this.applyLineSpacing("1.5");
  }

  // Get available line spacing options
  getLineSpacingOptions() {
    return [
      { value: "1", label: "Single (1.0)" },
      { value: "1.5", label: "One and a half (1.5)" },
      { value: "2", label: "Double (2.0)" },
      { value: "3", label: "Triple (3.0)" },
    ];
  }

  // Additional line spacing methods
  updateLineSpacingButton(spacing) {
    // Update button text to show current spacing
    const btn = document.getElementById("line-spacing-btn");
    if (btn) {
      const icon = btn.querySelector("i:first-child");
      const chevron = btn.querySelector("i:last-child");
      // You could update the button to show current spacing
      // For now, we'll keep the icon as is
    }
  }

  showLineSpacingModal() {
    const modal = document.getElementById("line-spacing-modal");
    // Get current spacing values from selection
    this.populateLineSpacingModal();
    modal.style.display = "block";
    // Focus first input
    setTimeout(() => {
      const firstInput = modal.querySelector("select, input");
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
      if (lineHeight && lineHeight !== "normal") {
        const fontSize = parseFloat(computedStyle.fontSize);
        const lineHeightValue = parseFloat(lineHeight);
        const ratio = lineHeightValue / fontSize;

        document.getElementById("line-spacing-value").value = ratio.toFixed(1);

        // Set appropriate type
        if (Math.abs(ratio - 1.0) < 0.1) {
          document.getElementById("line-spacing-type").value = "single";
        } else if (Math.abs(ratio - 1.5) < 0.1) {
          document.getElementById("line-spacing-type").value = "1.5";
        } else if (Math.abs(ratio - 2.0) < 0.1) {
          document.getElementById("line-spacing-type").value = "double";
        } else {
          document.getElementById("line-spacing-type").value = "multiple";
        }
      }
      // Parse margins
      const marginTop = parseFloat(computedStyle.marginTop) || 0;
      const marginBottom = parseFloat(computedStyle.marginBottom) || 0;

      document.getElementById("space-before").value = Math.round(marginTop * 0.75);
      document.getElementById("space-after").value = Math.round(marginBottom * 0.75);
    }
    this.updateSpacingPreview();
  }

  setupLineSpacingModalEvents() {
    // Type selection change
    document.getElementById("line-spacing-type").addEventListener("change", (e) => {
      const type = e.target.value;
      const valueInput = document.getElementById("line-spacing-value");
      const unitSpan = document.getElementById("line-spacing-unit");

      switch (type) {
        case "single":
          valueInput.value = "1.0";
          valueInput.disabled = true;
          unitSpan.textContent = "lines";
          break;
        case "1.5":
          valueInput.value = "1.5";
          valueInput.disabled = true;
          unitSpan.textContent = "lines";
          break;
        case "double":
          valueInput.value = "2.0";
          valueInput.disabled = true;
          unitSpan.textContent = "lines";
          break;
        case "multiple":
          valueInput.disabled = false;
          unitSpan.textContent = "lines";
          break;
        case "at-least":
          valueInput.disabled = false;
          unitSpan.textContent = "pt";
          break;
        case "exactly":
          valueInput.disabled = false;
          unitSpan.textContent = "pt";
          break;
      }
      this.updateSpacingPreview();
    });

    // Value changes
    ["line-spacing-value", "space-before", "space-after"].forEach((id) => {
      document.getElementById(id).addEventListener("input", () => {
        this.updateSpacingPreview();
      });
    });

    // Modal buttons
    document.getElementById("apply-spacing-btn").addEventListener("click", () => {
      this.applyDetailedSpacing();
      this.closeLineSpacingModal();
    });

    document.getElementById("cancel-spacing-btn").addEventListener("click", () => {
      this.closeLineSpacingModal();
    });
  }

  updateSpacingPreview() {
    const preview = document.getElementById("spacing-preview");
    if (!preview) return;
    
    const type = document.getElementById("line-spacing-type").value;
    const value = parseFloat(document.getElementById("line-spacing-value").value) || 1.0;
    const spaceBefore = parseFloat(document.getElementById("space-before").value) || 0;
    const spaceAfter = parseFloat(document.getElementById("space-after").value) || 0;

    // Calculate line height
    let lineHeight;
    switch (type) {
      case "single": lineHeight = "1.0"; break;
      case "1.5": lineHeight = "1.5"; break;
      case "double": lineHeight = "2.0"; break;
      case "multiple": lineHeight = value.toString(); break;
      case "at-least": lineHeight = value + "pt"; break;
      case "exactly": lineHeight = value + "pt"; break;
      default: lineHeight = "1.15";
    }

    // Apply styles to preview
    const paragraphs = preview.querySelectorAll("p");
    paragraphs.forEach((p, index) => {
      p.style.lineHeight = lineHeight;
      p.style.marginTop = (index === 0 ? 0 : spaceBefore) + "pt";
      p.style.marginBottom = spaceAfter + "pt";
    });
  }

  closeLineSpacingModal() {
    const modal = document.getElementById("line-spacing-modal");
    modal.style.display = "none";
  }

  toggleLineSpacingMenu() {
    const menu = document.getElementById("line-spacing-menu");
    menu.classList.toggle("show");
  }

  closeLineSpacingMenu(event) {
    const menu = document.getElementById("line-spacing-menu");
    if (!event || !event.target.closest(".line-spacing-dropdown")) {
      menu.classList.remove("show");
    }
  }

  setupLineSpacingEventListeners() {
    // Quick spacing options
    document.getElementById("spacing-single")?.addEventListener("click", () => this.applyLineSpacing("1"));
    document.getElementById("spacing-1-5")?.addEventListener("click", () => this.applyLineSpacing("1.5"));
    document.getElementById("spacing-double")?.addEventListener("click", () => this.applyLineSpacing("2"));

    // More spacing options
    document.getElementById("spacing-more")?.addEventListener("click", () => {
      this.showLineSpacingModal();
      this.closeLineSpacingMenu();
    });

    // Setup modal events
    this.setupLineSpacingModalEvents();
  }
}
