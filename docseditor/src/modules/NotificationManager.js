/**
 * NotificationManager - Handles all notification and alert functionality
 */
export class NotificationManager {
  constructor() {
    this.initializeStyles();
  }

  initializeStyles() {
    // Add animation styles if not already added
    if (!document.querySelector("#alert-styles")) {
      const style = document.createElement("style");
      style.id = "alert-styles";
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      border-radius: 4px;
      color: white;
      font-weight: 500;
      z-index: 1000;
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;

    if (type === "success") {
      notification.style.background = "#4CAF50";
    } else if (type === "error") {
      notification.style.background = "#f44336";
    } else if (type === "warning") {
      notification.style.background = "#ff9800";
    } else {
      notification.style.background = "#2196F3";
    }

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.transform = "translateX(0)";
    }, 100);

    setTimeout(() => {
      notification.style.transform = "translateX(100%)";
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  showAlert(message, type = "info") {
    // Remove existing alert
    const existingAlert = document.querySelector(".editor-alert");
    if (existingAlert) {
      existingAlert.remove();
    }

    // Create alert element
    const alert = document.createElement("div");
    alert.className = `editor-alert editor-alert-${type}`;

    const colors = {
      success: "#28a745",
      error: "#dc3545",
      info: "#007bff",
      warning: "#ffc107",
    };

    alert.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 400px;
      font-size: 14px;
      animation: slideInRight 0.3s ease-out;
    `;

    alert.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <i class="fas fa-${
          type === "success"
            ? "check-circle"
            : type === "error"
            ? "exclamation-circle"
            : "info-circle"
        }"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; font-size: 16px; cursor: pointer; margin-left: auto;">&times;</button>
      </div>
    `;

    document.body.appendChild(alert);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (alert.parentNode) {
        alert.style.animation = "slideInRight 0.3s ease-out reverse";
        setTimeout(() => alert.remove(), 300);
      }
    }, 5000);
  }
}
