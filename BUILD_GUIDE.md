# Web Docs Editor - Executable Builds

This document explains how to build and use the Web Docs Editor executables.

## Overview

The Web Docs Editor can be packaged into standalone executables for Windows, Linux, and macOS using the `pkg` package.

## Building Executables

### Prerequisites

- Node.js 18 or higher
- npm

### Available Build Scripts

```bash
# Build for all platforms
npm run build:all

# Build for specific platforms
npm run build:linux      # Linux x64
npm run build:windows    # Windows x64
npm run build:mac        # macOS x64
npm run build:mac-arm    # macOS ARM64
```

### Manual Build

You can also build manually:

```bash
# Install dependencies
npm install

# Build for specific target
npx pkg . --targets node18-linux-x64 --out-path dist
```

## Using the Executables

### Running the Application

1. Download the appropriate executable for your platform
2. Make it executable (Linux/macOS): `chmod +x web-docs-editor-*`
3. Run the executable: `./web-docs-editor-*`
4. Open your browser to `http://localhost:3000`

### Features

- Web-based document editor with rich text formatting
- User authentication and management
- Document versioning and collaboration
- Export to multiple formats (HTML, PDF, DOCX)
- AI-powered security classification

### Troubleshooting

If you encounter issues with the executable:

1. **Native module errors**: The executable includes all dependencies, but some native modules may need to be rebuilt for the target platform.

2. **Database errors**: The application uses SQLite for data storage. The database file will be created in the same directory as the executable.

3. **Port conflicts**: If port 3000 is already in use, you'll need to stop the conflicting service or modify the server configuration.

## Automated Builds

The project includes a GitHub Actions workflow that automatically builds executables for all platforms when a tag is pushed:

```bash
# Create and push a tag
git tag v1.0.0
git push origin v1.0.0
```

This will trigger the build workflow and create a release with downloadable executables.

## Development

For development, use the regular Node.js commands:

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Start in production mode
npm start
```

## Known Issues

- **Native modules**: Some native modules (like better-sqlite3) may cause issues with pkg. The workflow includes fallback options for these cases.
- **File paths**: Static assets are bundled into the executable, but the database file is created in the execution directory.

## Support

For issues and questions, please refer to the main project repository or create an issue on GitHub.