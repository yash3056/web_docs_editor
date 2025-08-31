/**
 * AIManager - Handles AI integration and text enhancement features
 */
export class AIManager {
  constructor(editor, notificationManager, textFormatter, saveManager, utils, paginationManager) {
    this.editor = editor;
    this.notificationManager = notificationManager;
    this.textFormatter = textFormatter;
    this.saveManager = saveManager;
    this.utils = utils;
    this.paginationManager = paginationManager;
    this.aiServerUrl = "http://localhost:5000"; // Default AI server URL
    this.isProcessing = false;
    this.apiKey = null;
    this.selectedModel = "qwen";
    this.conversationHistory = [];
    this.authToken = null; // Auth token for API requests
    this.currentPrompt = null; // Current AI prompt
    this.savedSelection = null; // Saved text selection
    this.currentRefinedText = null; // Current refined text
  }

  // Initialize AI functionality
  initialize() {
    this.loadSettings();
    this.setupEventListeners();
  }

  // Set auth token and other properties from parent editor
  setEditorProperties(authToken, currentPrompt, savedSelection) {
    this.authToken = authToken;
    if (currentPrompt !== undefined) this.currentPrompt = currentPrompt;
    if (savedSelection !== undefined) this.savedSelection = savedSelection;
  }

  // Load AI settings from localStorage
  loadSettings() {
    const settings = localStorage.getItem("ai-settings");
    if (settings) {
      const parsed = JSON.parse(settings);
      this.aiServerUrl = parsed.serverUrl || this.aiServerUrl;
      this.apiKey = parsed.apiKey || null;
      this.selectedModel = parsed.selectedModel || this.selectedModel;
    }
  }

  // Save AI settings to localStorage
  saveSettings() {
    const settings = {
      serverUrl: this.aiServerUrl,
      apiKey: this.apiKey,
      selectedModel: this.selectedModel,
    };
    localStorage.setItem("ai-settings", JSON.stringify(settings));
  }

  setupEventListeners() {
    // Listen for AI button clicks if they exist
    const enhanceBtn = document.getElementById("ai-enhance-btn");
    if (enhanceBtn) {
      enhanceBtn.addEventListener("click", () => this.enhanceSelectedText());
    }

    const summarizeBtn = document.getElementById("ai-summarize-btn");
    if (summarizeBtn) {
      summarizeBtn.addEventListener("click", () => this.summarizeDocument());
    }

    const chatBtn = document.getElementById("ai-chat-btn");
    if (chatBtn) {
      chatBtn.addEventListener("click", () => this.openAIChat());
    }
  }

  // Enhance selected text using AI
  async enhanceSelectedText() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (!selectedText) {
      this.notificationManager.showNotification(
        "Please select text to enhance",
        "warning"
      );
      return;
    }

    if (this.isProcessing) {
      this.notificationManager.showNotification(
        "AI is already processing...",
        "warning"
      );
      return;
    }

    try {
      this.isProcessing = true;
      this.notificationManager.showNotification("Enhancing text with AI...", "info");

      const prompt = `Please enhance and improve the following text while maintaining its original meaning and style. Make it more clear, professional, and well-structured:\n\n${selectedText}`;

      const enhancedText = await this.callAI(prompt);

      if (enhancedText) {
        // Replace the selected text with enhanced version
        this.textFormatter.insertHTML(enhancedText);
        this.notificationManager.showNotification(
          "Text enhanced successfully!",
          "success"
        );
      }
    } catch (error) {
      console.error("Text enhancement error:", error);
      this.notificationManager.showNotification(
        "Failed to enhance text: " + error.message,
        "error"
      );
    } finally {
      this.isProcessing = false;
    }
  }

  // Summarize the entire document
  async summarizeDocument() {
    if (this.isProcessing) {
      this.notificationManager.showNotification(
        "AI is already processing...",
        "warning"
      );
      return;
    }

    const documentText = this.editor.innerText || this.editor.textContent;
    if (!documentText.trim()) {
      this.notificationManager.showNotification(
        "Document is empty",
        "warning"
      );
      return;
    }

    try {
      this.isProcessing = true;
      this.notificationManager.showNotification("Generating summary...", "info");

      const prompt = `Please provide a concise summary of the following document:\n\n${documentText}`;

      const summary = await this.callAI(prompt);

      if (summary) {
        this.showSummaryModal(summary);
        this.notificationManager.showNotification(
          "Summary generated successfully!",
          "success"
        );
      }
    } catch (error) {
      console.error("Summarization error:", error);
      this.notificationManager.showNotification(
        "Failed to generate summary: " + error.message,
        "error"
      );
    } finally {
      this.isProcessing = false;
    }
  }

  // Main AI call function
  async callAI(prompt, options = {}) {
    const {
      maxTokens = 1000,
      temperature = 0.7,
      useHistory = false,
    } = options;

    try {
      // Check if server is available
      await this.checkServerHealth();

      // Prepare the request
      const requestBody = {
        prompt: prompt,
        max_tokens: maxTokens,
        temperature: temperature,
        model: this.selectedModel,
      };

      // Add conversation history if enabled
      if (useHistory && this.conversationHistory.length > 0) {
        requestBody.history = this.conversationHistory;
      }

      const response = await fetch(`${this.aiServerUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Add to conversation history if using history
      if (useHistory) {
        this.conversationHistory.push(
          { role: "user", content: prompt },
          { role: "assistant", content: data.response }
        );

        // Keep history limited to last 10 exchanges
        if (this.conversationHistory.length > 20) {
          this.conversationHistory = this.conversationHistory.slice(-20);
        }
      }

      return data.response;
    } catch (error) {
      console.error("AI API call failed:", error);
      throw error;
    }
  }

  // Check if AI server is available
  async checkServerHealth() {
    try {
      const response = await fetch(`${this.aiServerUrl}/health`, {
        method: "GET",
        timeout: 5000,
      });

      if (!response.ok) {
        throw new Error("Server health check failed");
      }

      return true;
    } catch (error) {
      throw new Error("AI server is not available. Please check your connection and server URL.");
    }
  }

  // Show summary in a modal
  showSummaryModal(summary) {
    // Create modal if it doesn't exist
    let modal = document.getElementById("ai-summary-modal");
    if (!modal) {
      modal = this.createSummaryModal();
    }

    const summaryContent = modal.querySelector(".summary-content");
    summaryContent.innerHTML = this.formatSummary(summary);

    modal.style.display = "block";
  }

  createSummaryModal() {
    const modal = document.createElement("div");
    modal.id = "ai-summary-modal";
    modal.className = "modal";
    modal.style.cssText = `
      display: none;
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
        margin: 5% auto;
        padding: 20px;
        border: none;
        border-radius: 8px;
        width: 80%;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
      ">
        <div class="modal-header" style="
          display: flex;
          justify-content: between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 1px solid #eee;
          padding-bottom: 15px;
        ">
          <h2 style="margin: 0; color: #333;">Document Summary</h2>
          <span class="close" style="
            color: #aaa;
            float: right;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
            margin-left: auto;
          ">&times;</span>
        </div>
        <div class="summary-content" style="
          line-height: 1.6;
          color: #444;
          font-size: 14px;
        "></div>
        <div class="modal-footer" style="
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px solid #eee;
          display: flex;
          gap: 10px;
        ">
          <button id="insert-summary-btn" style="
            background-color: #007cba;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
          ">Insert into Document</button>
          <button id="copy-summary-btn" style="
            background-color: #6c757d;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
          ">Copy to Clipboard</button>
        </div>
      </div>
    `;

    // Add event listeners
    const closeBtn = modal.querySelector(".close");
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });

    const insertBtn = modal.querySelector("#insert-summary-btn");
    insertBtn.addEventListener("click", () => {
      const summary = modal.querySelector(".summary-content").textContent;
      this.textFormatter.insertHTML(`<h3>Summary</h3><p>${summary}</p>`);
      modal.style.display = "none";
      this.notificationManager.showNotification("Summary inserted into document", "success");
    });

    const copyBtn = modal.querySelector("#copy-summary-btn");
    copyBtn.addEventListener("click", async () => {
      const summary = modal.querySelector(".summary-content").textContent;
      try {
        await navigator.clipboard.writeText(summary);
        this.notificationManager.showNotification("Summary copied to clipboard", "success");
      } catch (error) {
        console.error("Copy failed:", error);
        this.notificationManager.showNotification("Failed to copy summary", "error");
      }
    });

    // Close modal when clicking outside
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
      }
    });

    document.body.appendChild(modal);
    return modal;
  }

  formatSummary(summary) {
    // Basic formatting for the summary
    return summary
      .split("\n")
      .map((paragraph) => `<p>${paragraph.trim()}</p>`)
      .join("");
  }

  // Open AI chat interface
  openAIChat() {
    // Create or show AI chat modal
    let chatModal = document.getElementById("ai-chat-modal");
    if (!chatModal) {
      chatModal = this.createChatModal();
    }

    chatModal.style.display = "block";
    const chatInput = chatModal.querySelector("#chat-input");
    if (chatInput) {
      chatInput.focus();
    }
  }

  createChatModal() {
    const modal = document.createElement("div");
    modal.id = "ai-chat-modal";
    modal.className = "modal";
    modal.style.cssText = `
      display: none;
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
        margin: 2% auto;
        padding: 0;
        border: none;
        border-radius: 8px;
        width: 90%;
        max-width: 800px;
        height: 80vh;
        display: flex;
        flex-direction: column;
      ">
        <div class="modal-header" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #eee;
        ">
          <h2 style="margin: 0; color: #333;">AI Assistant</h2>
          <span class="close" style="
            color: #aaa;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
          ">&times;</span>
        </div>
        <div id="chat-messages" style="
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          background-color: #f9f9f9;
        "></div>
        <div class="chat-input-container" style="
          padding: 20px;
          border-top: 1px solid #eee;
          background-color: white;
        ">
          <div style="display: flex; gap: 10px;">
            <input type="text" id="chat-input" placeholder="Ask AI about your document..." style="
              flex: 1;
              padding: 10px;
              border: 1px solid #ddd;
              border-radius: 4px;
              font-size: 14px;
            ">
            <button id="send-chat-btn" style="
              background-color: #007cba;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
            ">Send</button>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    const closeBtn = modal.querySelector(".close");
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });

    const chatInput = modal.querySelector("#chat-input");
    const sendBtn = modal.querySelector("#send-chat-btn");

    const sendMessage = () => {
      const message = chatInput.value.trim();
      if (message) {
        this.sendChatMessage(message);
        chatInput.value = "";
      }
    };

    sendBtn.addEventListener("click", sendMessage);
    chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        sendMessage();
      }
    });

    // Close modal when clicking outside
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
      }
    });

    document.body.appendChild(modal);
    return modal;
  }

  async sendChatMessage(message) {
    const chatMessages = document.getElementById("chat-messages");
    if (!chatMessages) return;

    // Add user message
    this.addChatMessage(message, "user");

    // Add loading indicator
    const loadingId = this.addChatMessage("AI is thinking...", "assistant", true);

    try {
      // Get document context
      const documentContext = this.editor.innerText || this.editor.textContent;
      const contextPrompt = documentContext
        ? `Based on this document content:\n\n${documentContext.substring(0, 2000)}...\n\nUser question: ${message}`
        : message;

      const response = await this.callAI(contextPrompt, {
        useHistory: true,
        maxTokens: 500,
      });

      // Remove loading indicator
      const loadingMsg = document.getElementById(loadingId);
      if (loadingMsg) {
        loadingMsg.remove();
      }

      // Add AI response
      this.addChatMessage(response, "assistant");
    } catch (error) {
      console.error("Chat error:", error);

      // Remove loading indicator
      const loadingMsg = document.getElementById(loadingId);
      if (loadingMsg) {
        loadingMsg.remove();
      }

      this.addChatMessage(
        "Sorry, I encountered an error. Please try again.",
        "assistant"
      );
    }
  }

  addChatMessage(message, sender, isLoading = false) {
    const chatMessages = document.getElementById("chat-messages");
    if (!chatMessages) return;

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const messageDiv = document.createElement("div");
    messageDiv.id = messageId;
    messageDiv.style.cssText = `
      margin-bottom: 15px;
      display: flex;
      ${sender === "user" ? "justify-content: flex-end;" : "justify-content: flex-start;"}
    `;

    const messageBubble = document.createElement("div");
    messageBubble.style.cssText = `
      max-width: 70%;
      padding: 10px 15px;
      border-radius: 15px;
      word-wrap: break-word;
      ${
        sender === "user"
          ? "background-color: #007cba; color: white;"
          : "background-color: white; color: #333; border: 1px solid #ddd;"
      }
      ${isLoading ? "opacity: 0.7;" : ""}
    `;

    messageBubble.textContent = message;
    messageDiv.appendChild(messageBubble);
    chatMessages.appendChild(messageDiv);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return messageId;
  }

  // Configuration methods
  setServerUrl(url) {
    this.aiServerUrl = url;
    this.saveSettings();
  }

  setApiKey(key) {
    this.apiKey = key;
    this.saveSettings();
  }

  setModel(model) {
    this.selectedModel = model;
    this.saveSettings();
  }

  // Get available models from server
  async getAvailableModels() {
    try {
      const response = await fetch(`${this.aiServerUrl}/api/models`);
      if (response.ok) {
        const data = await response.json();
        return data.models || [];
      }
    } catch (error) {
      console.error("Failed to fetch models:", error);
    }
    return [];
  }

  // Clear conversation history
  clearHistory() {
    this.conversationHistory = [];
    this.notificationManager.showNotification("Conversation history cleared", "info");
  }

  // Get processing status
  isAIProcessing() {
    return this.isProcessing;
  }

  // Test AI connection
  async testConnection() {
    try {
      await this.checkServerHealth();
      this.notificationManager.showNotification("AI server connection successful!", "success");
      return true;
    } catch (error) {
      this.notificationManager.showNotification(
        "AI server connection failed: " + error.message,
        "error"
      );
      return false;
    }
  }

  async generateAIContent(prompt) {
    try {
      // Store original prompt for refinements
      this.currentPrompt = prompt;

      // Show loading state
      const resultsContent = document.getElementById("ai-generated-content");
      resultsContent.innerHTML = `
                <div class="ai-loading">
                    <div class="ai-loading-spinner"></div>
                    <span>Generating content...</span>
                </div>
            `;

      this.showAIResultsPopup();

      // Call the classification server for text generation
      const response = await fetch("/api/generate-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          prompt: prompt,
          context: this.getDocumentContext(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Extract content after </think> token
      let generatedText =
        data.generatedText ||
        "Sorry, I couldn't generate content for that prompt. Please try again.";

      // Look for </think> token and extract only content after it
      const thinkEndIndex = generatedText.indexOf("</think>");
      if (thinkEndIndex !== -1) {
        generatedText = generatedText.substring(thinkEndIndex + 8).trim(); // 8 is length of '</think>'
      }

      // Store the generated content for later insertion
      this.lastGeneratedContent = generatedText;

      // Clean up the content (remove extra whitespace, normalize formatting)
      generatedText = this.cleanGeneratedContent(generatedText);

      // Store content for insertion and refinement
      this.currentGeneratedContent = generatedText;

      // Update the results popup with the generated content
      resultsContent.innerHTML = `
                <div class="ai-content-display">
                    <div class="ai-content-text">${generatedText}</div>
                    <div class="ai-actions">
                        <button id="insert-ai-content" class="ai-btn ai-btn-primary">
                            Insert Content
                        </button>
                        <button id="refine-ai-content" class="ai-btn ai-btn-secondary">
                            Refine
                        </button>
                        <button id="regenerate-ai-content" class="ai-btn ai-btn-secondary">
                            Regenerate
                        </button>
                    </div>
                </div>
            `;

      // Add click handlers for the action buttons
      document.getElementById("insert-ai-content").addEventListener("click", () => {
        this.insertAIContent();
        this.hideAIResultsPopup();
      });

      document.getElementById("refine-ai-content").addEventListener("click", () => {
        this.refineContent();
      });

      document.getElementById("regenerate-ai-content").addEventListener("click", () => {
        this.generateAIContent(this.currentPrompt);
      });

      console.log("AI content generated successfully");
    } catch (error) {
      console.error("Error generating AI content:", error);
      const resultsContent = document.getElementById("ai-generated-content");
      resultsContent.innerHTML = `
                <div class="ai-error">
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p>Please check your connection and try again.</p>
                </div>
            `;
      this.notificationManager.showNotification(
        "Failed to generate content: " + error.message,
        "error"
      );
    }
  }

  insertAIContent() {
    const content = document.getElementById("ai-generated-content").innerHTML; // Use innerHTML to get formatted content

    if (content && content.trim()) {
      console.log("=== INSERTING AI CONTENT ===");
      console.log("Content to insert:", content);

      // Focus the editor first
      this.editor.focus();

      // Find the cursor marker
      const marker = this.findCursorMarker();

      if (marker) {
        console.log("✅ Found cursor marker");
        console.log(
          "Marker parent:",
          marker.parentNode.tagName || marker.parentNode.nodeName
        );
        console.log(
          "Marker parent text:",
          marker.parentNode.textContent.substring(0, 50) + "..."
        );

        try {
          // Create a temporary div to parse the HTML content
          const temp = document.createElement("div");
          temp.innerHTML = content;

          // Insert each child node before the marker
          const fragment = document.createDocumentFragment();
          while (temp.firstChild) {
            fragment.appendChild(temp.firstChild);
          }

          // Insert the content before the marker
          marker.parentNode.insertBefore(fragment, marker);

          // Remove the marker
          marker.remove();

          console.log("✅ AI content inserted successfully at marker position");

          // Update editor state
          this.saveState();
          this.updateWordCount();
          this.updatePageLayout();
          this.hideAIResultsPopup();
          return;
        } catch (error) {
          console.error("❌ Error inserting at marker position:", error);
          // Continue to fallback
        }
      } else {
        console.warn("❌ No cursor marker found, using fallback insertion");

        // Fallback: try to use current cursor position or insert at end
        const selection = window.getSelection();

        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);

          // Make sure we're in the editor
          if (this.editor.contains(range.startContainer)) {
            console.log("Using current cursor position");

            // Don't delete existing content - just collapse to insertion point
            if (!range.collapsed) {
              range.collapse(false);
            }

            // Try execCommand first
            try {
              const result = document.execCommand("insertHTML", false, content);
              if (result) {
                console.log("execCommand insertHTML succeeded");
                this.saveState();
                this.updateWordCount();
                this.updatePageLayout();
                this.hideAIResultsPopup();
                return;
              }
            } catch (e) {
              console.warn("execCommand failed:", e);
            }

            // Manual insertion fallback
            try {
              const temp = document.createElement("div");
              temp.innerHTML = content;

              const fragment = document.createDocumentFragment();
              while (temp.firstChild) {
                fragment.appendChild(temp.firstChild);
              }

              range.insertNode(fragment);
              range.collapse(false);
              selection.removeAllRanges();
              selection.addRange(range);

              console.log("Manual insertion succeeded");
            } catch (error) {
              console.error("Manual insertion failed:", error);
              // Last resort: append to end
              const temp = document.createElement("div");
              temp.innerHTML = content;
              while (temp.firstChild) {
                this.editor.appendChild(temp.firstChild);
              }
            }
          } else {
            console.log("Selection not in editor, appending to end");
            const temp = document.createElement("div");
            temp.innerHTML = content;
            while (temp.firstChild) {
              this.editor.appendChild(temp.firstChild);
            }
          }
        } else {
          console.log("No selection, appending to end of editor");
          const temp = document.createElement("div");
          temp.innerHTML = content;
          while (temp.firstChild) {
            this.editor.appendChild(temp.firstChild);
          }
        }
      }

      // Update editor state
      this.saveState();
      this.updateWordCount();
      this.updatePageLayout();

      console.log("AI content insertion completed");

      // Hide popup
      this.hideAIResultsPopup();
    } else {
      console.warn("No AI content to insert");
    }
  }

  // Helper methods that would be needed
  findCursorMarker() {
    return document.querySelector(".cursor-marker");
  }

  getDocumentContext() {
    // Get current selection and surrounding context for better AI understanding
    const selection = window.getSelection();
    let context = "";

    // If there's a selection, provide context around it
    if (selection.rangeCount > 0 && selection.toString().trim()) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const paragraph = container.nodeType === Node.TEXT_NODE 
        ? container.parentElement 
        : container;

      // Get the paragraph containing the selection
      let contextNode = paragraph;
      
      // Try to get a larger context block (like a section or div)
      while (contextNode && contextNode !== this.editor && 
             contextNode.textContent.length < 500) {
        contextNode = contextNode.parentElement;
        if (!contextNode || !this.editor.contains(contextNode)) {
          contextNode = paragraph;
          break;
        }
      }

      context = contextNode.textContent || "";
      
      // If still too short, get surrounding paragraphs
      if (context.length < 200) {
        const allText = this.editor.textContent || "";
        const selectionText = selection.toString();
        const selectionIndex = allText.indexOf(selectionText);
        
        if (selectionIndex !== -1) {
          // Get 500 chars before and after selection
          const start = Math.max(0, selectionIndex - 500);
          const end = Math.min(allText.length, selectionIndex + selectionText.length + 500);
          context = allText.substring(start, end);
          
          // Add ellipsis if truncated
          if (start > 0) context = "..." + context;
          if (end < allText.length) context = context + "...";
        }
      }
    } else {
      // No selection - provide document overview
      const fullText = this.editor.textContent || this.editor.innerText || "";
      
      if (fullText.length <= 1000) {
        // Document is short enough to include entirely
        context = fullText;
      } else {
        // For longer documents, provide beginning and structure
        context = fullText.substring(0, 500);
        
        // Try to find document structure (headings, etc.)
        const headings = this.editor.querySelectorAll('h1, h2, h3, h4, h5, h6');
        if (headings.length > 0) {
          context += "\n\nDocument structure:\n";
          Array.from(headings).slice(0, 10).forEach(heading => {
            context += `${heading.tagName}: ${heading.textContent.trim()}\n`;
          });
        }
        
        // Add a sample from the middle if document is very long
        if (fullText.length > 2000) {
          const midPoint = Math.floor(fullText.length / 2);
          const midSample = fullText.substring(midPoint - 200, midPoint + 200);
          context += "\n\n...middle section...\n" + midSample;
        }
      }
    }

    // Limit total context length and clean up
    if (context.length > 2000) {
      context = context.substring(0, 2000) + "...";
    }

    return context.trim();
  }

  cleanGeneratedContent(content) {
    return content
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n/g, "\n\n")
      .trim();
  }

  showAIResultsPopup() {
    // Implementation would depend on the existing popup system
    console.log("Showing AI results popup");
  }

  hideAIResultsPopup() {
    // Implementation would depend on the existing popup system
    console.log("Hiding AI results popup");
  }

  updatePageLayout() {
    // Delegate to the pagination manager
    if (this.paginationManager) {
      this.paginationManager.updatePageLayout();
    }
  }

  refineContent() {
    // Implementation for content refinement
    console.log("Refining content");
  }

  updateWordCount() {
    // Delegate to the Utils module
    if (this.utils) {
      this.utils.updateWordCount();
    }
  }

  saveState() {
    // Delegate to the SaveManager
    if (this.saveManager) {
      this.saveManager.saveState();
    }
  }

  setupAIWritingEventListeners() {
    // Create button
    document.getElementById("ai-create-btn").addEventListener("click", () => {
      const prompt = document.getElementById("ai-input").value.trim();
      if (prompt) {
        this.generateAIContent(prompt);
      }
    });

    // Close buttons
    document.getElementById("ai-close-btn").addEventListener("click", () => {
      this.hideAIWritingPopup();
    });

    document
      .getElementById("ai-results-close-btn")
      .addEventListener("click", () => {
        this.hideAIResultsPopup();
      });

    // Insert button
    document.getElementById("ai-insert-btn").addEventListener("click", () => {
      this.insertAIContent();
    });

    // Feedback buttons (visual only, no functionality as requested)
    document.getElementById("ai-thumbs-up").addEventListener("click", (e) => {
      e.target.closest("button").classList.toggle("active");
      document.getElementById("ai-thumbs-down").classList.remove("active");
    });

    document.getElementById("ai-thumbs-down").addEventListener("click", (e) => {
      e.target.closest("button").classList.toggle("active");
      document.getElementById("ai-thumbs-up").classList.remove("active");
    });

    // Refine button
    document.getElementById("ai-refine-btn").addEventListener("click", () => {
      const options = document.getElementById("ai-refine-options");
      options.style.display =
        options.style.display === "none" ? "block" : "none";
    });

    // Refine options
    document.querySelectorAll(".refine-option").forEach((option) => {
      option.addEventListener("click", async () => {
        const action = option.dataset.action;
        await this.refineAIContent(action);
        document.getElementById("ai-refine-options").style.display = "none";
      });
    });

    // Enter key in input
    document.getElementById("ai-input").addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        document.getElementById("ai-create-btn").click();
      }
    });

    // Click outside to close popups
    document.addEventListener("click", (e) => {
      // Don't close if clicking on context menu
      if (e.target.closest("#custom-context-menu")) {
        return;
      }

      const writingPopup = document.getElementById("ai-writing-popup");
      const resultsPopup = document.getElementById("ai-results-popup");

      if (
        !writingPopup.contains(e.target) &&
        !resultsPopup.contains(e.target)
      ) {
        if (writingPopup.style.display === "block") {
          this.hideAIWritingPopup();
        }
        if (resultsPopup.style.display === "block") {
          this.hideAIResultsPopup();
        }
      }
    });
  }

  showAIWritingPopup() {
    const popup = document.getElementById("ai-writing-popup");
    const editor = this.editor;

    // Position popup center of the editor
    const editorRect = editor.getBoundingClientRect();
    const centerX = editorRect.left + editorRect.width / 2;
    const centerY = editorRect.top + editorRect.height / 2;

    popup.style.left = centerX - 320 + "px"; // 320 is half the popup width
    popup.style.top = centerY - 200 + "px"; // 200 is estimated half height
    popup.style.display = "block";

    // Add show animation
    setTimeout(() => popup.classList.add("show"), 10);

    // Clear input and focus
    document.getElementById("ai-input").value = "";
    document.getElementById("ai-input").focus();

    // Make popup draggable
    this.makeDraggable(popup);
  }

  hideAIWritingPopup() {
    const popup = document.getElementById("ai-writing-popup");
    popup.classList.remove("show");
    setTimeout(() => (popup.style.display = "none"), 200);
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

  async refineAIContent(action) {
    // Get original prompt from stored value or input field
    const originalPrompt =
      this.currentPrompt ||
      document.getElementById("ai-input").value ||
      "Please help me write content";

    // Create refinement prompts for each action
    let refinementPrompt = "";

    switch (action) {
      case "shorten":
        refinementPrompt = `${originalPrompt}. Please make the response shorter and more concise.`;
        break;
      case "elaborate":
        refinementPrompt = `${originalPrompt}. Please provide a more detailed and elaborate response.`;
        break;
      case "formal":
        refinementPrompt = `${originalPrompt}. Please write in a more formal and professional tone.`;
        break;
      case "casual":
        refinementPrompt = `${originalPrompt}. Please write in a more casual and conversational tone.`;
        break;
      case "bulletize":
        refinementPrompt = `${originalPrompt}. Please format the response as bullet points in markdown format.`;
        break;
      case "summarize":
        refinementPrompt = `${originalPrompt}. Please provide a brief summary.`;
        break;
      case "retry":
        refinementPrompt = originalPrompt; // Just retry with original prompt
        break;
      default:
        refinementPrompt = originalPrompt;
    }

    // Call generateAIContent with the refined prompt
    await this.generateAIContent(refinementPrompt);
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

  generateFallbackContent(prompt) {
    // Simple fallback content generator for demo
    const templates = {
      "world peace":
        "At The Cymbal Foodie, we believe in the power of food to bring people together, transcending cultural differences and fostering understanding. Just as a shared meal can bridge divides, we hope our collective efforts, through authentic storytelling and a celebration of diverse culinary experiences, contribute to a world where respect and harmony are savored by all.",

      "business report":
        "This quarterly report demonstrates significant progress in our key initiatives. Our team has successfully implemented new strategies that have resulted in improved performance metrics across all departments. Moving forward, we will continue to focus on innovation and customer satisfaction.",

      introduction:
        "Welcome to our comprehensive guide. In this document, we will explore the essential concepts and provide you with the knowledge needed to understand the subject matter thoroughly. Let's begin our journey together.",

      conclusion:
        "In conclusion, the evidence presented clearly supports our initial hypothesis. The findings demonstrate the effectiveness of our approach and provide a solid foundation for future development. We recommend continued investment in this area.",

      default: `Based on your request about "${prompt}", here is some generated content that you can use as a starting point. This content is designed to help you get started with your writing and can be customized to fit your specific needs.`,
    };

    // Find best match or use default
    const lowerPrompt = prompt.toLowerCase();
    for (const [key, content] of Object.entries(templates)) {
      if (lowerPrompt.includes(key)) {
        return content;
      }
    }

    return templates.default;
  }

  convertMarkdownToHTML(markdown) {
    // Convert markdown to HTML
    let html = markdown
      // Headers
      .replace(/^### (.*$)/gim, "<h3>$1</h3>")
      .replace(/^## (.*$)/gim, "<h2>$1</h2>")
      .replace(/^# (.*$)/gim, "<h1>$1</h1>")
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
      .replace(/__(.*?)__/gim, "<strong>$1</strong>")
      // Italic
      .replace(/\*(.*?)\*/gim, "<em>$1</em>")
      .replace(/_(.*?)_/gim, "<em>$1</em>")
      // Bullet lists
      .replace(/^\* (.*$)/gim, "<li>$1</li>")
      .replace(/^- (.*$)/gim, "<li>$1</li>")
      // Numbered lists
      .replace(/^\d+\. (.*$)/gim, "<li>$1</li>")
      // Line breaks
      .replace(/\n\n/gim, "</p><p>")
      .replace(/\n/gim, "<br>");

    // Wrap consecutive <li> elements in <ul> or <ol>
    html = html.replace(/(<li>.*?<\/li>)/gims, function (match, p1) {
      if (
        match.includes("<li>") &&
        !match.includes("<ul>") &&
        !match.includes("<ol>")
      ) {
        // Check if it's numbered list items (originally numbered)
        const isNumbered =
          markdown.includes("1. ") ||
          markdown.includes("2. ") ||
          markdown.includes("3. ");
        const tag = isNumbered ? "ol" : "ul";
        return `<${tag}>${match}</${tag}>`;
      }
      return match;
    });

    // Wrap in paragraphs if not already wrapped
    if (
      !html.includes("<p>") &&
      !html.includes("<h") &&
      !html.includes("<ul>") &&
      !html.includes("<ol>")
    ) {
      html = `<p>${html}</p>`;
    }

    return html;
  }

  async shortenText(text) {
    try {
      const prompt = `Please shorten the following text while preserving its main meaning and key points. Make it more concise and direct:

"${text}"

Provide only the shortened text without explanations.`;

      const shortenedText = await this.callAI(prompt, { maxTokens: 300 });
      return shortenedText || this.fallbackShortenText(text);
    } catch (error) {
      console.error("AI shortening failed:", error);
      return this.fallbackShortenText(text);
    }
  }

  async elaborateText(text) {
    try {
      const prompt = `Please elaborate on the following text by adding more detail, examples, and explanations while maintaining the original meaning and tone:

"${text}"

Provide only the elaborated text without explanations.`;

      const elaboratedText = await this.callAI(prompt, { maxTokens: 500 });
      return elaboratedText || this.fallbackElaborateText(text);
    } catch (error) {
      console.error("AI elaboration failed:", error);
      return this.fallbackElaborateText(text);
    }
  }

  async makeFormal(text) {
    try {
      const prompt = `Please rewrite the following text in a formal, professional tone suitable for business or academic contexts:

"${text}"

Provide only the formal version without explanations.`;

      const formalText = await this.callAI(prompt, { maxTokens: 400 });
      return formalText || this.fallbackMakeFormal(text);
    } catch (error) {
      console.error("AI formalization failed:", error);
      return this.fallbackMakeFormal(text);
    }
  }

  async makeCasual(text) {
    try {
      const prompt = `Please rewrite the following text in a casual, conversational tone that's friendly and approachable:

"${text}"

Provide only the casual version without explanations.`;

      const casualText = await this.callAI(prompt, { maxTokens: 400 });
      return casualText || this.fallbackMakeCasual(text);
    } catch (error) {
      console.error("AI casualization failed:", error);
      return this.fallbackMakeCasual(text);
    }
  }

  async convertToBullets(text) {
    try {
      const prompt = `Please convert the following text into a well-organized bullet point list that captures all the key information:

"${text}"

Format as bullet points using • symbols. Provide only the bullet points without explanations.`;

      const bulletText = await this.callAI(prompt, { maxTokens: 400 });
      return bulletText || this.fallbackConvertToBullets(text);
    } catch (error) {
      console.error("AI bullet conversion failed:", error);
      return this.fallbackConvertToBullets(text);
    }
  }

  async summarizeText(text) {
    try {
      const prompt = `Please provide a concise summary of the following text, capturing the main points and essential information:

"${text}"

Provide only the summary without explanations.`;

      const summary = await this.callAI(prompt, { maxTokens: 200 });
      return summary || this.fallbackSummarizeText(text);
    } catch (error) {
      console.error("AI summarization failed:", error);
      return this.fallbackSummarizeText(text);
    }
  }

  // Fallback methods for when AI is unavailable
  fallbackShortenText(text) {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim());
    const targetLength = Math.ceil(sentences.length * 0.6); // Keep 60% of sentences
    return sentences.slice(0, targetLength).join(". ") + (targetLength > 0 ? "." : "");
  }

  fallbackElaborateText(text) {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim());
    return sentences.map(sentence => {
      const trimmed = sentence.trim();
      if (trimmed) {
        return `${trimmed}. This point is particularly important because it provides valuable insights and context that enhance our understanding of the subject matter.`;
      }
      return trimmed;
    }).join(" ");
  }

  fallbackMakeFormal(text) {
    return text
      .replace(/\bcan't\b/gi, "cannot")
      .replace(/\bwon't\b/gi, "will not")
      .replace(/\bdon't\b/gi, "do not")
      .replace(/\bdidn't\b/gi, "did not")
      .replace(/\bisn't\b/gi, "is not")
      .replace(/\baren't\b/gi, "are not")
      .replace(/\bwasn't\b/gi, "was not")
      .replace(/\bweren't\b/gi, "were not")
      .replace(/\bhasn't\b/gi, "has not")
      .replace(/\bhaven't\b/gi, "have not")
      .replace(/\bhadn't\b/gi, "had not")
      .replace(/\bwouldn't\b/gi, "would not")
      .replace(/\bcouldn't\b/gi, "could not")
      .replace(/\bshouldn't\b/gi, "should not")
      .replace(/\bmightn't\b/gi, "might not")
      .replace(/\bi think\b/gi, "it is believed")
      .replace(/\bi believe\b/gi, "it is considered")
      .replace(/\bwe\b/gi, "one")
      .replace(/\byou\b/gi, "one")
      .replace(/\bokay\b/gi, "acceptable")
      .replace(/\bokay\b/gi, "satisfactory")
      .replace(/\bgreat\b/gi, "excellent")
      .replace(/\bawesome\b/gi, "outstanding");
  }

  fallbackMakeCasual(text) {
    return text
      .replace(/\bcannot\b/gi, "can't")
      .replace(/\bwill not\b/gi, "won't")
      .replace(/\bdo not\b/gi, "don't")
      .replace(/\bdid not\b/gi, "didn't")
      .replace(/\bis not\b/gi, "isn't")
      .replace(/\bare not\b/gi, "aren't")
      .replace(/\bwas not\b/gi, "wasn't")
      .replace(/\bwere not\b/gi, "weren't")
      .replace(/\bhas not\b/gi, "hasn't")
      .replace(/\bhave not\b/gi, "haven't")
      .replace(/\bhad not\b/gi, "hadn't")
      .replace(/\bwould not\b/gi, "wouldn't")
      .replace(/\bcould not\b/gi, "couldn't")
      .replace(/\bshould not\b/gi, "shouldn't")
      .replace(/\bmight not\b/gi, "mightn't")
      .replace(/\bit is believed\b/gi, "I think")
      .replace(/\bit is considered\b/gi, "I believe")
      .replace(/\bone should\b/gi, "you should")
      .replace(/\bone must\b/gi, "you have to")
      .replace(/\bone may\b/gi, "you can")
      .replace(/\bexcellent\b/gi, "great")
      .replace(/\boutstanding\b/gi, "awesome")
      .replace(/\bsatisfactory\b/gi, "okay");
  }

  fallbackConvertToBullets(text) {
    // Try to intelligently break text into bullet points
    let bullets = [];
    
    // First try splitting by sentences
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim());
    
    if (sentences.length <= 1) {
      // Single sentence - try splitting by commas or semicolons
      const parts = text.split(/[,;]+/).filter((s) => s.trim());
      bullets = parts.map(part => `• ${part.trim()}`);
    } else if (sentences.length <= 5) {
      // Few sentences - each becomes a bullet
      bullets = sentences.map(sentence => `• ${sentence.trim()}`);
    } else {
      // Many sentences - group related ones
      for (let i = 0; i < sentences.length; i += 2) {
        const group = sentences.slice(i, i + 2).join(". ");
        bullets.push(`• ${group.trim()}`);
      }
    }
    
    return bullets.join("\n");
  }

  fallbackSummarizeText(text) {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim());
    
    if (sentences.length <= 2) return text;
    if (sentences.length <= 4) {
      // Take first and last sentence
      return `${sentences[0].trim()}. ${sentences[sentences.length - 1].trim()}.`;
    }
    
    // For longer text, take first, middle, and last sentences
    const first = sentences[0].trim();
    const middle = sentences[Math.floor(sentences.length / 2)].trim();
    const last = sentences[sentences.length - 1].trim();
    
    return `${first}. ${middle}. ${last}.`;
  }

  setupRefinePopupEventListeners() {
    // Close button
    document
      .getElementById("refine-close-btn")
      .addEventListener("click", () => {
        this.hideRefineResultsPopup();
      });

    // Insert button
    document
      .getElementById("refine-insert-btn")
      .addEventListener("click", () => {
        if (this.currentRefinedText) {
          // Convert markdown to plain text for insertion
          let textToInsert = this.currentRefinedText;
          if (typeof showdown !== "undefined") {
            const converter = new showdown.Converter();
            const htmlContent = converter.makeHtml(textToInsert);
            // Create a temporary div to extract text content
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = htmlContent;
            textToInsert = tempDiv.innerHTML; // Keep HTML for rich text insertion
          }

          this.replaceSelectedText(textToInsert);
          this.hideRefineResultsPopup();
          this.notificationManager.showNotification(
            "Text refined and inserted successfully!",
            "success"
          );
        }
      });

    // Feedback buttons
    document
      .getElementById("refine-thumbs-up")
      .addEventListener("click", (e) => {
        e.target.closest("button").classList.toggle("active");
        document
          .getElementById("refine-thumbs-down")
          .classList.remove("active");
      });

    document
      .getElementById("refine-thumbs-down")
      .addEventListener("click", (e) => {
        e.target.closest("button").classList.toggle("active");
        document.getElementById("refine-thumbs-up").classList.remove("active");
      });

    // Refine dropdown toggle
    document
      .getElementById("refine-action-btn")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        const dropdown = document.getElementById("refine-dropdown-menu");
        const isVisible = dropdown.style.display === "block";
        dropdown.style.display = isVisible ? "none" : "block";
      });

    // Refine dropdown options
    document.querySelectorAll(".refine-dropdown-item").forEach((item) => {
      item.addEventListener("click", async (e) => {
        e.stopPropagation();
        const action = item.getAttribute("data-action");

        // Hide dropdown
        document.getElementById("refine-dropdown-menu").style.display = "none";

        // Perform refinement
        if (this.savedSelection) {
          try {
            this.notificationManager.showNotification(`Refining text (${action})...`, "info");
            const refinedText = await this.refineSelectedText(
              this.savedSelection.text,
              action
            );
            this.showRefineResultsPopup(refinedText, action);
          } catch (error) {
            console.error("Error refining text:", error);
            this.notificationManager.showNotification("Failed to refine text", "error");
          }
        }
      });
    });

    // Refine with custom prompt
    document
      .getElementById("refine-prompt-input")
      .addEventListener("keypress", async (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const promptInput = e.target;
          const customPrompt = promptInput.value.trim();

          if (customPrompt && this.savedSelection) {
            try {
              this.notificationManager.showNotification("Refining with custom prompt...", "info");
              const fullPrompt = `${customPrompt}: "${this.savedSelection.text}"`;
              const response = await this.api.generateText(fullPrompt);

              if (response && response.text) {
                const processedText = this.processAIResponse(response.text);
                this.showRefineResultsPopup(processedText, "Custom");
                promptInput.value = ""; // Clear the input
              }
            } catch (error) {
              console.error("Error with custom refine:", error);
              this.notificationManager.showNotification(
                "Failed to refine with custom prompt",
                "error"
              );
            }
          }
        }
      });

    // Click outside to close popup and dropdown
    document.addEventListener("click", (e) => {
      const refinePopup = document.getElementById("refine-results-popup");
      const dropdown = document.getElementById("refine-dropdown-menu");

      // Close dropdown if clicking outside
      if (!e.target.closest(".refine-dropdown")) {
        dropdown.style.display = "none";
      }

      // Close popup if clicking outside
      if (
        !refinePopup.contains(e.target) &&
        !e.target.closest("#custom-context-menu")
      ) {
        if (refinePopup.style.display === "block") {
          this.hideRefineResultsPopup();
        }
      }
    });
  }

  // Missing methods that are called but not implemented
  async handleRefineText(action) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (!selectedText) {
      this.notificationManager.showNotification("Please select text to refine", "warning");
      return;
    }

    // Save selection for later use
    this.savedSelection = {
      range: selection.getRangeAt(0).cloneRange(),
      text: selectedText
    };

    try {
      const refinedText = await this.refineSelectedText(selectedText, action);
      this.showRefineResultsPopup(refinedText, action);
    } catch (error) {
      console.error("Error refining text:", error);
      this.notificationManager.showNotification("Failed to refine text", "error");
    }
  }

  async refineSelectedText(text, action) {
    let prompt = "";
    
    switch (action) {
      case "shorten":
        return await this.shortenText(text);
      case "elaborate":
        return await this.elaborateText(text);
      case "formal":
        return await this.makeFormal(text);
      case "casual":
        return await this.makeCasual(text);
      case "bulletize":
        return await this.convertToBullets(text);
      case "summarize":
        return await this.summarizeText(text);
      default:
        prompt = `Please improve and refine the following text: "${text}"`;
        return await this.callAI(prompt, { maxTokens: 400 });
    }
  }

  processAIResponse(response) {
    // Clean up AI response - remove thinking tags, extra whitespace, etc.
    let cleaned = response;
    
    // Remove thinking tags if present
    cleaned = cleaned.replace(/<think>.*?<\/think>/gs, "");
    
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    
    // Remove common AI response prefixes
    cleaned = cleaned.replace(/^(Here is|Here's|The refined text is:?)\s*/i, "");
    
    return cleaned;
  }

  showRefineResultsPopup(text, actionTitle) {
    this.currentRefinedText = text;
    
    // Create or get popup
    let popup = document.getElementById("refine-results-popup");
    if (!popup) {
      popup = this.createRefineResultsPopup();
    }

    // Update content
    const contentDiv = popup.querySelector("#refine-results-content");
    const titleDiv = popup.querySelector("#refine-results-title");
    
    if (contentDiv) contentDiv.textContent = text;
    if (titleDiv) titleDiv.textContent = `Refined Text (${actionTitle})`;

    // Position and show popup
    popup.style.display = "block";
    popup.style.left = "50%";
    popup.style.top = "30%";
    popup.style.transform = "translate(-50%, -30%)";
    
    this.makeDraggable(popup);
  }

  hideRefineResultsPopup() {
    const popup = document.getElementById("refine-results-popup");
    if (popup) {
      popup.style.display = "none";
    }
  }

  createRefineResultsPopup() {
    const popup = document.createElement("div");
    popup.id = "refine-results-popup";
    popup.className = "ai-popup";
    popup.style.cssText = `
      position: fixed;
      z-index: 1000;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      width: 500px;
      max-height: 600px;
      display: none;
    `;

    popup.innerHTML = `
      <div class="refine-popup-header" style="
        padding: 15px 20px;
        border-bottom: 1px solid #eee;
        background: #f8f9fa;
        border-radius: 8px 8px 0 0;
        cursor: move;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <h3 id="refine-results-title" style="margin: 0; font-size: 16px; color: #333;">Refined Text</h3>
        <button id="refine-close-btn" style="
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #666;
        ">&times;</button>
      </div>
      <div style="padding: 20px;">
        <div id="refine-results-content" style="
          background: #f9f9f9;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 15px;
          max-height: 300px;
          overflow-y: auto;
          line-height: 1.5;
          border: 1px solid #e0e0e0;
        "></div>
        <div style="display: flex; gap: 10px; justify-content: space-between;">
          <button id="refine-insert-btn" style="
            background: #007cba;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            flex: 1;
          ">Replace Selection</button>
          <div style="display: flex; gap: 5px;">
            <button id="refine-thumbs-up" style="
              background: #28a745;
              color: white;
              border: none;
              padding: 10px;
              border-radius: 4px;
              cursor: pointer;
            ">👍</button>
            <button id="refine-thumbs-down" style="
              background: #dc3545;
              color: white;
              border: none;
              padding: 10px;
              border-radius: 4px;
              cursor: pointer;
            ">👎</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
    return popup;
  }

  replaceSelectedText(newText) {
    if (!this.savedSelection || !this.savedSelection.range) {
      this.notificationManager.showNotification("No text selection to replace", "warning");
      return;
    }

    try {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(this.savedSelection.range);

      // Use execCommand for better compatibility
      if (document.execCommand) {
        const success = document.execCommand('insertText', false, newText);
        if (success) {
          this.editor.focus();
          this.saveState();
          this.updateWordCount();
          return;
        }
      }

      // Fallback to manual replacement
      const range = this.savedSelection.range;
      range.deleteContents();
      range.insertNode(document.createTextNode(newText));
      
      // Clear selection and update
      selection.removeAllRanges();
      this.editor.focus();
      this.saveState();
      this.updateWordCount();

    } catch (error) {
      console.error("Error replacing text:", error);
      this.notificationManager.showNotification("Failed to replace text", "error");
    }
  }
}
