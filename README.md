# Web Docs Editor

A modern, feature-rich web-based document editor built with HTML, CSS, and JavaScript. Create, edit, and format documents directly in your browser with a professional Microsoft Word-like interface and advanced dashboard for document management.

## 🎯 Microsoft Word-Like Dashboard

The Web Docs Editor now features a comprehensive dashboard inspired by Microsoft Word's interface:

### 🏠 Dashboard Features

**Navigation & Search**
- **Top Navigation Bar**: Professional layout with app branding and user controls
- **Global Search**: Search across all documents with real-time filtering  
- **User Menu**: Settings, help, and sign-out options

**Document Management**
- **Multiple Views**: Switch between grid and list views
- **Smart Sorting**: Sort by name, date created, last modified, or file size
- **Bulk Operations**: Select multiple documents for batch actions
- **Context Menus**: Right-click for quick actions (open, rename, duplicate, export, delete)

**Template System**
- **Built-in Templates**: Blank document, business report, formal letter, resume
- **Template Previews**: Visual template selection with descriptions
- **Custom Content**: Pre-filled content for faster document creation

## Features

### ✨ Rich Text Editing
- **Text Formatting**: Bold, italic, underline, strikethrough
- **Font Controls**: Multiple font families and sizes
- **Text Alignment**: Left, center, right, and justify
- **Lists**: Bulleted and numbered lists
- **Colors**: Text color and background highlighting
- **Links**: Insert and manage hyperlinks
- **Images**: Embed images from URLs or upload from your computer with drag & drop support

### 🛠️ Editor Tools
- **Undo/Redo**: Full history management with keyboard shortcuts
- **Auto-save**: Automatic saving every 30 seconds
- **Manual Save**: Save documents to local storage
- **Multiple Export Formats**: Export documents as HTML, PDF, or DOCX files
- **Word Count**: Real-time word and character counting
- **Watermark Support**: Add custom watermarks that appear in all export formats

### 🎨 Modern Interface
- **Responsive Design**: Works on desktop and mobile devices
- **Clean UI**: Professional toolbar and editing interface
- **Keyboard Shortcuts**: Standard shortcuts (Ctrl+S, Ctrl+Z, etc.)
- **Status Bar**: Document statistics and save status

## Getting Started

1. **Open the Editor**: Simply open `docseditor.html` in any modern web browser
2. **Start Writing**: Click in the editor area and begin typing
3. **Format Text**: Use the toolbar to format your text
4. **Save Your Work**: Use Ctrl+S or click the Save button
5. **Export**: Click Export dropdown and choose from HTML, PDF, or DOCX formats

## Keyboard Shortcuts

- `Ctrl+S` (or `Cmd+S` on Mac): Save document
- `Ctrl+Z` (or `Cmd+Z` on Mac): Undo
- `Ctrl+Y` or `Ctrl+Shift+Z`: Redo
- `Ctrl+B`: Bold
- `Ctrl+I`: Italic
- `Ctrl+U`: Underline

## File Structure

```
web_docs_editor/
├── docseditor.html          # Main HTML file
├── styles.css          # Stylesheet with modern design
├── script.js           # JavaScript functionality
└── README.md           # This file
```

## Browser Compatibility

This editor works in all modern browsers including:
- Chrome/Chromium
- Firefox
- Safari
- Edge

## Features in Detail

### Document Management
- Documents are automatically saved to browser's local storage
- Auto-save functionality prevents data loss
- Export feature creates downloadable HTML files
- Document title can be edited in the header

### Text Formatting
- Complete rich text formatting suite
- Font family selection (Arial, Times New Roman, Helvetica, Georgia, Verdana)
- Font size options from 12px to 32px
- Text and background color pickers
- Standard formatting options (bold, italic, underline, strikethrough)

### Layout and Alignment
- Four text alignment options
- Bullet and numbered list support
- Clean, distraction-free writing environment
- Responsive design that works on all screen sizes

### Advanced Features
- Link insertion with custom text and URLs
- Image embedding from URLs
- Undo/redo with 50-step history
- Real-time word and character counting
- Print-friendly styles

### Document Export
- **HTML Export**: Clean HTML files with embedded CSS and watermarks
- **PDF Export**: High-quality PDF generation with proper formatting
- **DOCX Export**: Microsoft Word-compatible documents with basic formatting
- All export formats preserve watermarks and basic text formatting
- Exported documents maintain document title and structure

## Customization

The editor can be easily customized by modifying:
- `styles.css` for appearance and theme
- `script.js` for functionality and features
- `docseditor.html` for structure and layout

## Local Development

To run the editor locally:

1. Clone or download the project files
2. Open `docseditor.html` in a web browser
3. Start editing!

No build process or server required - it's a pure client-side application.

## Contributing

Feel free to submit issues and enhancement requests! This is a simple but powerful document editor that can be extended with additional features.

## License

This project is open source and available under the MIT License.

---

**Happy Writing!** 📝
