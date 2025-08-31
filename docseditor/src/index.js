/**
 * Main DocsEditor Module Index
 * This file imports and exports all DocsEditor modules for easy access
 */

// Import all modules
import { NotificationManager } from './modules/NotificationManager.js';
import { Utils } from './modules/Utils.js';
import { TextFormatter } from './modules/TextFormatter.js';
import { PaginationManager } from './modules/PaginationManager.js';
import { SaveManager } from './modules/SaveManager.js';
import { NavigationManager } from './modules/NavigationManager.js';
import { LineSpacingManager } from './modules/LineSpacingManager.js';
import { ModalManager } from './modules/ModalManager.js';
import { WatermarkManager } from './modules/WatermarkManager.js';
import { ExportManager } from './modules/ExportManager.js';
import { ContextMenuManager } from './modules/ContextMenuManager.js';
import { AIManager } from './modules/AIManager.js';

// Export all modules
export {
  NotificationManager,
  Utils,
  TextFormatter,
  PaginationManager,
  SaveManager,
  NavigationManager,
  LineSpacingManager,
  ModalManager,
  WatermarkManager,
  ExportManager,
  ContextMenuManager,
  AIManager
};

/**
 * DocsEditorModules - Main class that initializes and manages all modules
 */
export class DocsEditorModules {
  constructor(editorElement) {
    this.editor = editorElement;
    this.modules = {};
    
    // Initialize modules in dependency order
    this.initializeModules();
  }

  initializeModules() {
    // Core modules first (no dependencies)
    this.modules.notificationManager = new NotificationManager();
    this.modules.modalManager = new ModalManager(this.modules.notificationManager);
    
    // Utility modules
    this.modules.utils = new Utils(this.editor, this.modules.notificationManager);
    
    // Content manipulation modules
    this.modules.textFormatter = new TextFormatter(this.editor, this.modules.notificationManager);
    this.modules.lineSpacingManager = new LineSpacingManager(this.editor, this.modules.notificationManager);
    
    // Document management modules
    this.modules.saveManager = new SaveManager(this.editor, this.modules.notificationManager);
    this.modules.paginationManager = new PaginationManager(this.editor, this.modules.notificationManager);
    
    // Advanced feature modules
    this.modules.watermarkManager = new WatermarkManager(this.editor, this.modules.notificationManager);
    this.modules.exportManager = new ExportManager(
      this.editor,
      this.modules.notificationManager,
      this.modules.watermarkManager,
      this.modules.saveManager
    );
    
    // UI modules
    this.modules.navigationManager = new NavigationManager(this.modules.notificationManager);
    this.modules.contextMenuManager = new ContextMenuManager(
      this.editor,
      this.modules.textFormatter,
      this.modules.saveManager,
      this.modules.exportManager,
      this.modules.notificationManager
    );
    
    // AI module
    this.modules.aiManager = new AIManager(
      this.editor,
      this.modules.notificationManager,
      this.modules.textFormatter,
      this.modules.saveManager,
      this.modules.utils,
      this.modules.paginationManager
    );
    
    // Initialize AI manager
    this.modules.aiManager.initialize();
    
    console.log('All DocsEditor modules initialized successfully');
  }

  // Getter methods for easy access to modules
  get notificationManager() {
    return this.modules.notificationManager;
  }

  get modalManager() {
    return this.modules.modalManager;
  }

  get utils() {
    return this.modules.utils;
  }

  get textFormatter() {
    return this.modules.textFormatter;
  }

  get lineSpacingManager() {
    return this.modules.lineSpacingManager;
  }

  get saveManager() {
    return this.modules.saveManager;
  }

  get paginationManager() {
    return this.modules.paginationManager;
  }

  get watermarkManager() {
    return this.modules.watermarkManager;
  }

  get exportManager() {
    return this.modules.exportManager;
  }

  get navigationManager() {
    return this.modules.navigationManager;
  }

  get contextMenuManager() {
    return this.modules.contextMenuManager;
  }

  get aiManager() {
    return this.modules.aiManager;
  }

  // Get all modules
  getAllModules() {
    return this.modules;
  }

  // Initialize specific module
  reinitializeModule(moduleName) {
    if (this.modules[moduleName]) {
      // Re-initialize the specific module if it has an initialize method
      if (typeof this.modules[moduleName].initialize === 'function') {
        this.modules[moduleName].initialize();
      }
    }
  }

  // Destroy all modules (cleanup)
  destroy() {
    Object.values(this.modules).forEach(module => {
      if (typeof module.destroy === 'function') {
        module.destroy();
      }
    });
    this.modules = {};
  }
}
