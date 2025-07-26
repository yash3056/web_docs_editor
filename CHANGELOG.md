# Changelog

## [1.0.1] - 2025-01-25

### 🚀 New Features
- **GPU Support**: Added Vulkan support for improved graphics performance
- **Page Navigation**: Enhanced page counting with current page number display for cursor
- **Custom Context Menu**: Added custom context menu for docs editor canvas
- **Database Encryption**: Implemented secure database encryption with credential storage

### 🔧 Improvements
- **Build Process**: Enhanced Electron app build process and directory management
- **Project Structure**: Reorganized codebase with better folder structure:
  - Moved dashboard files to specific folders
  - Moved authentication files to dedicated auth folder
  - Moved docseditor code to dedicated folder
  - Moved documentation files to docs folder
- **Page Layout**: Updated `loadDocument()` function to automatically call `updatePageLayout()`
- **UI/UX**: Merged page counting buttons for better user experience
- **Dashboard**: Improved dashboard redirects and path handling

### 🐛 Bug Fixes
- Fixed clean script and excluded additional directories from build
- Fixed paths for dashboard components
- Fixed single delete functionality
- Resolved paths for docseditor components
- Updated GitHub Actions to handle npm install dependency errors

### 🔄 Changes
- Changed AI mode to Qwen for better performance
- Moved `run-electron.bat` to electron folder for better organization
- Removed unnecessary files and cleaned up project structure
- Removed storage limit restrictions

### 🐳 DevOps & Infrastructure
- Added Docker support with Dockerfile
- Added Linux build support with GitHub Actions
- Updated test suite for encrypted database implementation

### 📝 Documentation
- Initial documentation for version 1.0.0
- Improved project structure documentation

---

**Full Changelog**: [1.0.0...1.0.1](https://github.com/[username]/[repository]/compare/1.0.0...1.0.1)