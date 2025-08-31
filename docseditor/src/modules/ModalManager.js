/**
 * ModalManager - Handles all modal dialogs and their interactions
 */
export class ModalManager {
  constructor(notificationManager) {
    this.notificationManager = notificationManager;
    this.openModals = new Set();
    this.initializeModalHandlers();
  }

  initializeModalHandlers() {
    // Global escape key handler for modals
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeTopModal();
      }
    });

    // Global click handler for modal backgrounds
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal")) {
        this.closeModal(e.target.id);
      }
    });
  }

  // Generic method to create a modal
  createModal(id, title, content, options = {}) {
    const {
      width = "500px",
      height = "auto",
      closable = true,
      backdrop = true,
      className = "",
    } = options;

    // Remove existing modal with same ID
    this.removeModal(id);

    const modal = document.createElement("div");
    modal.id = id;
    modal.className = `modal ${className}`;
    modal.style.cssText = `
      display: none;
      position: fixed;
      z-index: ${1000 + this.openModals.size};
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: ${backdrop ? "rgba(0,0,0,0.5)" : "transparent"};
    `;

    const modalContent = document.createElement("div");
    modalContent.className = "modal-content";
    modalContent.style.cssText = `
      background-color: #fefefe;
      margin: 5% auto;
      padding: 0;
      border: none;
      border-radius: 8px;
      width: ${width};
      height: ${height};
      max-width: 95%;
      max-height: 90vh;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    // Create header
    if (title || closable) {
      const header = document.createElement("div");
      header.className = "modal-header";
      header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid #eee;
        background-color: #f8f9fa;
      `;

      if (title) {
        const titleElement = document.createElement("h3");
        titleElement.textContent = title;
        titleElement.style.cssText = `
          margin: 0;
          color: #333;
          font-size: 18px;
          font-weight: 600;
        `;
        header.appendChild(titleElement);
      }

      if (closable) {
        const closeBtn = document.createElement("span");
        closeBtn.className = "modal-close";
        closeBtn.innerHTML = "&times;";
        closeBtn.style.cssText = `
          color: #aaa;
          font-size: 28px;
          font-weight: bold;
          cursor: pointer;
          transition: color 0.2s;
          line-height: 1;
        `;
        closeBtn.addEventListener("mouseenter", () => {
          closeBtn.style.color = "#333";
        });
        closeBtn.addEventListener("mouseleave", () => {
          closeBtn.style.color = "#aaa";
        });
        closeBtn.addEventListener("click", () => {
          this.closeModal(id);
        });
        header.appendChild(closeBtn);
      }

      modalContent.appendChild(header);
    }

    // Create body
    const body = document.createElement("div");
    body.className = "modal-body";
    body.style.cssText = `
      flex: 1;
      padding: 20px;
      overflow-y: auto;
    `;

    if (typeof content === "string") {
      body.innerHTML = content;
    } else if (content instanceof Node) {
      body.appendChild(content);
    }

    modalContent.appendChild(body);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    return modal;
  }

  // Show a modal
  showModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = "block";
      this.openModals.add(id);
      
      // Focus first input or button in modal
      const firstFocusable = modal.querySelector(
        'input, button, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 100);
      }

      return true;
    }
    return false;
  }

  // Close a modal
  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = "none";
      this.openModals.delete(id);
      return true;
    }
    return false;
  }

  // Close the topmost modal
  closeTopModal() {
    if (this.openModals.size > 0) {
      const modals = Array.from(this.openModals);
      const topModal = modals[modals.length - 1];
      this.closeModal(topModal);
    }
  }

  // Remove a modal from DOM
  removeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.remove();
      this.openModals.delete(id);
    }
  }

  // Close all modals
  closeAllModals() {
    this.openModals.forEach((id) => {
      this.closeModal(id);
    });
  }

  // Create confirmation dialog
  showConfirmDialog(title, message, onConfirm, onCancel = null) {
    const id = "confirm-dialog-" + Date.now();
    
    const content = `
      <div style="margin-bottom: 20px; font-size: 16px; line-height: 1.5;">
        ${message}
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="${id}-cancel" style="
          padding: 10px 20px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">Cancel</button>
        <button id="${id}-confirm" style="
          padding: 10px 20px;
          border: none;
          background: #dc3545;
          color: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">Confirm</button>
      </div>
    `;

    const modal = this.createModal(id, title, content, { width: "400px" });

    // Add event listeners
    const confirmBtn = document.getElementById(`${id}-confirm`);
    const cancelBtn = document.getElementById(`${id}-cancel`);

    confirmBtn.addEventListener("click", () => {
      this.closeModal(id);
      this.removeModal(id);
      if (onConfirm) onConfirm();
    });

    cancelBtn.addEventListener("click", () => {
      this.closeModal(id);
      this.removeModal(id);
      if (onCancel) onCancel();
    });

    this.showModal(id);
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
      this.removeModal(id);
    }, 30000);
  }

  // Create alert dialog
  showAlert(title, message, type = "info") {
    const id = "alert-dialog-" + Date.now();
    
    const icons = {
      info: "fas fa-info-circle",
      success: "fas fa-check-circle",
      warning: "fas fa-exclamation-triangle",
      error: "fas fa-times-circle",
    };

    const colors = {
      info: "#17a2b8",
      success: "#28a745",
      warning: "#ffc107",
      error: "#dc3545",
    };

    const content = `
      <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <i class="${icons[type]}" style="
          font-size: 24px;
          color: ${colors[type]};
          margin-right: 15px;
        "></i>
        <div style="font-size: 16px; line-height: 1.5;">
          ${message}
        </div>
      </div>
      <div style="display: flex; justify-content: center;">
        <button id="${id}-ok" style="
          padding: 10px 30px;
          border: none;
          background: #007cba;
          color: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">OK</button>
      </div>
    `;

    const modal = this.createModal(id, title, content, { width: "400px" });

    // Add event listener
    const okBtn = document.getElementById(`${id}-ok`);
    okBtn.addEventListener("click", () => {
      this.closeModal(id);
      this.removeModal(id);
    });

    this.showModal(id);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      this.removeModal(id);
    }, 10000);
  }

  // Create input dialog
  showInputDialog(title, message, defaultValue = "", onSubmit = null, onCancel = null) {
    const id = "input-dialog-" + Date.now();
    
    const content = `
      <div style="margin-bottom: 15px; font-size: 16px; line-height: 1.5;">
        ${message}
      </div>
      <input type="text" id="${id}-input" value="${defaultValue}" style="
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        margin-bottom: 20px;
        box-sizing: border-box;
      ">
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="${id}-cancel" style="
          padding: 10px 20px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">Cancel</button>
        <button id="${id}-submit" style="
          padding: 10px 20px;
          border: none;
          background: #007cba;
          color: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">OK</button>
      </div>
    `;

    const modal = this.createModal(id, title, content, { width: "400px" });

    // Add event listeners
    const input = document.getElementById(`${id}-input`);
    const submitBtn = document.getElementById(`${id}-submit`);
    const cancelBtn = document.getElementById(`${id}-cancel`);

    const handleSubmit = () => {
      const value = input.value.trim();
      this.closeModal(id);
      this.removeModal(id);
      if (onSubmit) onSubmit(value);
    };

    const handleCancel = () => {
      this.closeModal(id);
      this.removeModal(id);
      if (onCancel) onCancel();
    };

    submitBtn.addEventListener("click", handleSubmit);
    cancelBtn.addEventListener("click", handleCancel);
    
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleSubmit();
      }
    });

    this.showModal(id);
    input.focus();
    input.select();
    
    // Auto-remove after 60 seconds
    setTimeout(() => {
      this.removeModal(id);
    }, 60000);
  }

  // Create loading modal
  showLoadingModal(title = "Loading...", message = "Please wait...") {
    const id = "loading-modal";
    
    const content = `
      <div style="text-align: center; padding: 20px;">
        <div style="
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #007cba;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        "></div>
        <div style="font-size: 16px; color: #333; margin-bottom: 10px;">
          ${title}
        </div>
        <div style="font-size: 14px; color: #666;">
          ${message}
        </div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;

    const modal = this.createModal(id, "", content, { 
      width: "300px", 
      closable: false,
      backdrop: true 
    });

    this.showModal(id);
    return id;
  }

  // Hide loading modal
  hideLoadingModal() {
    this.closeModal("loading-modal");
    this.removeModal("loading-modal");
  }

  // Create custom modal with form
  showFormModal(title, fields, onSubmit, onCancel = null) {
    const id = "form-modal-" + Date.now();
    
    let formHTML = '<form id="' + id + '-form">';
    
    fields.forEach((field, index) => {
      const fieldId = `${id}-field-${index}`;
      formHTML += `
        <div style="margin-bottom: 15px;">
          <label for="${fieldId}" style="
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #333;
          ">${field.label}:</label>
      `;
      
      if (field.type === "textarea") {
        formHTML += `
          <textarea id="${fieldId}" name="${field.name}" 
                    placeholder="${field.placeholder || ''}" 
                    ${field.required ? 'required' : ''} style="
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            resize: vertical;
            min-height: 80px;
            box-sizing: border-box;
          ">${field.value || ''}</textarea>
        `;
      } else if (field.type === "select") {
        formHTML += `<select id="${fieldId}" name="${field.name}" ${field.required ? 'required' : ''} style="
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
          ">`;
        field.options.forEach(option => {
          formHTML += `<option value="${option.value}" ${option.selected ? 'selected' : ''}>${option.text}</option>`;
        });
        formHTML += `</select>`;
      } else {
        formHTML += `
          <input type="${field.type || 'text'}" id="${fieldId}" name="${field.name}" 
                 value="${field.value || ''}" 
                 placeholder="${field.placeholder || ''}" 
                 ${field.required ? 'required' : ''} style="
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
          ">
        `;
      }
      
      formHTML += '</div>';
    });
    
    formHTML += `
      </form>
      <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
        <button id="${id}-cancel" type="button" style="
          padding: 10px 20px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">Cancel</button>
        <button id="${id}-submit" type="submit" style="
          padding: 10px 20px;
          border: none;
          background: #007cba;
          color: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">Submit</button>
      </div>
    `;

    const modal = this.createModal(id, title, formHTML, { width: "500px" });

    // Add event listeners
    const form = document.getElementById(`${id}-form`);
    const submitBtn = document.getElementById(`${id}-submit`);
    const cancelBtn = document.getElementById(`${id}-cancel`);

    const handleSubmit = (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = {};
      for (let [key, value] of formData.entries()) {
        data[key] = value;
      }
      this.closeModal(id);
      this.removeModal(id);
      if (onSubmit) onSubmit(data);
    };

    const handleCancel = () => {
      this.closeModal(id);
      this.removeModal(id);
      if (onCancel) onCancel();
    };

    form.addEventListener("submit", handleSubmit);
    submitBtn.addEventListener("click", handleSubmit);
    cancelBtn.addEventListener("click", handleCancel);

    this.showModal(id);
    
    // Focus first input
    const firstInput = form.querySelector('input, textarea, select');
    if (firstInput) {
      firstInput.focus();
    }
    
    // Auto-remove after 5 minutes
    setTimeout(() => {
      this.removeModal(id);
    }, 300000);
  }

  // Check if any modal is open
  hasOpenModals() {
    return this.openModals.size > 0;
  }

  // Get list of open modals
  getOpenModals() {
    return Array.from(this.openModals);
  }
}
