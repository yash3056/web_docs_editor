# Web Docs Editor - Server Setup Guide

This guide explains how to set up server-side document storage for the Web Docs Editor.

## Current Storage Method

**Before Setup (Browser Only):**
- Documents are stored in browser's localStorage
- Limited to ~5-10MB storage
- Documents lost if browser data is cleared
- No cross-device synchronization

**After Setup (Server Storage):**
- Documents stored on your server
- Virtually unlimited storage space
- Documents persist and can be accessed from any device
- Automatic backup and export functionality

## Installation Steps

### 1. Install Node.js
Download and install Node.js from [nodejs.org](https://nodejs.org/)

### 2. Install Dependencies
Navigate to your project directory and run:
```bash
npm install
```

### 3. Start the Server
```bash
npm start
```

The server will start on http://localhost:3000

### 4. Directory Structure
After starting the server, these directories will be created automatically:
- `documents/` - Stores all user documents as JSON files
- `exports/` - Stores exported DOCX/PDF files

## How It Works

### Document Storage
- Each document is saved as a JSON file: `documents/doc-12345.json`
- Contains document content, metadata, and formatting
- Automatically synced between browser and server

### File Exports
- When you export a document as DOCX/PDF, it's saved in `exports/`
- Files are timestamped: `My Document_2025-07-07T10-30-00.docx`
- Available for download through the web interface

### Backup Strategy
- All documents are stored as individual JSON files
- Easy to backup the entire `documents/` folder
- Can be restored by copying files back to the server

## Features

### Automatic Fallback
- If the server is not available, the app falls back to localStorage
- Documents are automatically synced when the server comes back online
- Status indicator shows whether you're online or offline

### Export Management
- All exported files are stored on the server
- Access previous exports through the API
- Organized by timestamp for easy retrieval

## API Endpoints

- `GET /api/documents` - Get all documents
- `POST /api/documents` - Save/update a document
- `DELETE /api/documents/:id` - Delete a document
- `POST /api/documents/:id/export` - Export document to server
- `GET /api/exports` - List all exports
- `GET /api/exports/:filename` - Download exported file

## Production Deployment

For production deployment:

1. Set environment variables:
   ```bash
   export PORT=80
   export NODE_ENV=production
   ```

2. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "web-docs-editor"
   ```

3. Set up nginx reverse proxy (optional):
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

## Security Considerations

- Documents are stored as plain JSON files
- Consider adding authentication for production use
- Regular backups of the `documents/` directory recommended
- File permissions should be properly configured

## Troubleshooting

### Server Not Starting
- Check if port 3000 is available
- Verify Node.js is installed correctly
- Check console for error messages

### Documents Not Saving
- Verify server is running
- Check browser console for error messages
- Ensure `documents/` directory has write permissions

### Large File Exports
- Server has a 50MB upload limit
- Increase if needed by modifying `express.json({ limit: '50mb' })`

## File Locations

### Documents
```
documents/
├── doc-1704636000000.json  (Project Proposal)
├── doc-1704722400000.json  (Meeting Notes)
└── doc-1704808800000.json  (Budget Report)
```

### Exports
```
exports/
├── Project_Proposal_2025-07-07T10-30-00.docx
├── Meeting_Notes_2025-07-07T11-15-30.pdf
└── Budget_Report_2025-07-07T14-45-15.docx
```

## Next Steps

1. Start the server with `npm start`
2. Open your web editor
3. Create or edit a document
4. Check the `documents/` folder to see your saved files
5. Export a document and check the `exports/` folder

Your documents are now safely stored on your server!
