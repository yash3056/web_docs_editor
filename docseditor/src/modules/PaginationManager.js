/**
 * PaginationManager - Handles pagination functionality
 */
export class PaginationManager {
  constructor(editor, notificationManager) {
    this.editor = editor;
    this.notificationManager = notificationManager;
    this.pageHeight = 11 * 96; // 11 inches * 96 DPI
    this.currentPage = 1;
    this.totalPages = 1;
    this.paginationMode = true;
    this.isUpdatingLayout = false;
    this.PAGE_BREAK_HEIGHT = 20;
    this.PAGE_BREAK_MARGIN = 40;
  }

  togglePaginationMode() {
    console.log(
      "Toggling pagination mode from",
      this.paginationMode,
      "to",
      !this.paginationMode
    );

    this.paginationMode = !this.paginationMode;
    this.updatePageLayout();
    if (this.paginationMode) {
      this.notificationManager.showNotification("Pagination mode enabled", "success");
    } else {
      this.notificationManager.showNotification("Continuous mode enabled", "success");
    }
  }

  updatePageLayout() {
    if (this.isUpdatingLayout) {
      return;
    }
    this.isUpdatingLayout = true;
    requestAnimationFrame(() => {
      const contentHeight = this.editor.scrollHeight;
      const pageHeight = this.pageHeight;
      const requiredPages = Math.max(1, Math.ceil(contentHeight / pageHeight));

      this.totalPages = requiredPages;
      this.updatePageInfo();

      // Ensure editor container fits the pages
      const minHeight = requiredPages * pageHeight;
      if (this.editor.style.minHeight !== minHeight + "px") {
        this.editor.style.minHeight = minHeight + "px";
      }

      this.adjustNumberOfPages(requiredPages, this.paginationMode);
      this.isUpdatingLayout = false;
    });
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
    try {
      // Get cursor position to determine which page the cursor is on
      const selection = window.getSelection();
      if (selection.rangeCount === 0) {
        this.currentPage = 1;
        this.updatePageInfo();
        return 1;
      }

      const range = selection.getRangeAt(0);
      const cursorNode = range.startContainer;

      // Find the actual element containing the cursor
      let cursorElement =
        cursorNode.nodeType === Node.TEXT_NODE
          ? cursorNode.parentElement
          : cursorNode;

      // Make sure we're working within the editor
      if (!this.editor.contains(cursorElement)) {
        cursorElement = this.editor;
      }

      // Get the offset of the cursor element relative to the editor
      let offsetTop = 0;
      let element = cursorElement;

      while (element && element !== this.editor) {
        offsetTop += element.offsetTop || 0;
        element = element.offsetParent;
      }

      // Add any additional offset from the range within the element
      if (range.getBoundingClientRect) {
        const rect = range.getBoundingClientRect();
        const editorRect = this.editor.getBoundingClientRect();
        if (rect.top >= editorRect.top) {
          offsetTop = rect.top - editorRect.top + this.editor.scrollTop;
        }
      }

      // Calculate which page based on the cursor position
      const pageHeight = this.pageHeight;
      const currentPage = Math.max(1, Math.floor(offsetTop / pageHeight) + 1);

      // Store current page and update display
      this.currentPage = currentPage;
      this.updatePageInfo();

      return currentPage;
    } catch (error) {
      console.warn("Error updating current page:", error);
      this.currentPage = 1;
      this.updatePageInfo();
      return 1;
    }
  }

  updatePageInfo() {
    const pageInfoElement = document.getElementById("page-info");
    if (pageInfoElement) {
      const currentPage = this.currentPage || 1;
      const totalPages = this.totalPages || 1;
      pageInfoElement.textContent = `Page ${currentPage} of ${totalPages}`;
    }
  }

  getCurrentPage() {
    return this.currentPage;
  }

  getTotalPages() {
    return this.totalPages;
  }

  getPaginationMode() {
    return this.paginationMode;
  }
}
