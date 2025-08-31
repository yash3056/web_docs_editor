/**
 * NavigationManager - Handles navigation between different parts of the application
 */
export class NavigationManager {
  constructor(editor, documentTitle, saveManager) {
    this.editor = editor;
    this.documentTitle = documentTitle;
    this.saveManager = saveManager;
    this.isNavigating = false;
  }

  openVersionControl() {
    // Save current document state before opening version control
    const currentDoc = {
      id: localStorage.getItem("currentDocumentId"),
      title: this.documentTitle.value,
      content: [this.editor.innerHTML],
      lastModified: Date.now(),
    };

    localStorage.setItem("currentDocument", JSON.stringify(currentDoc));

    // Open version control in same window
    window.location.href = "../version-control/version-control.html";
  }

  async goToDashboard() {
    console.log("Dashboard button clicked"); // Debug log

    try {
      // Set flag to indicate programmatic navigation
      this.isNavigating = true;

      // Clear any pending auto-saves
      this.saveManager.cleanupAutoSave();

      // Save current document before navigating
      await this.saveManager.saveDocument(false);

      console.log("Navigating to dashboard"); // Debug log
      // Navigate to dashboard
      window.location.href = "/dashboard";
    } catch (error) {
      console.error("Error in goToDashboard:", error);
      // Still navigate even if save fails
      console.log("Navigating to dashboard after error"); // Debug log
      window.location.href = "/dashboard";
    }
  }

  getIsNavigating() {
    return this.isNavigating;
  }
}
