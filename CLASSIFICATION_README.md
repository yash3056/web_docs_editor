# Document Classification Feature

## Overview

The Web Docs Editor now includes a powerful document security classification system based on Indian Government security standards. This feature allows you to analyze PDF documents and automatically classify them into appropriate security levels.

## Features

### 1. Document Classification Levels

The system classifies documents into five security levels based on Indian Government standards:

- **🔴 TOP SECRET**: Exceptionally grave damage to national security
- **🟠 SECRET**: Serious damage or embarrassment to government  
- **🟡 CONFIDENTIAL**: Damage or prejudice to national security
- **🔵 RESTRICTED**: Official use only, no public disclosure
- **⚪ UNCLASSIFIED**: No security classification required

### 2. AI-Powered Analysis

The system uses Google's Gemini AI to analyze document content and identify:
- Strategic locations and infrastructure references
- Military and defense information
- Personnel security details
- Intelligence and surveillance content
- Diplomatic and foreign relations data
- Economic and strategic resources
- Cybersecurity and communications details
- Nuclear and WMD information

### 3. Watermarked PDF Export

After classification, the system automatically:
- Adds appropriate watermarks to the PDF
- Uses color-coded watermarks based on classification level
- Applies 50% opacity watermarks covering 70% of the page
- Provides secure download of the watermarked document

## How to Use

### Step 1: Start the Services

1. **Start the main web server:**
   ```bash
   npm start
   ```
   This runs on http://localhost:3000

2. **Start the classification API:**
   ```bash
   npx ts-node classification-api.ts
   ```
   This runs on http://localhost:3003

### Step 2: Access the Classification Feature

1. Open your browser to http://localhost:3000
2. On the dashboard, click the **"Classify Docs"** button (purple button with shield icon)
3. The classification modal will open

### Step 3: Upload and Classify a Document

1. **Upload Method 1**: Click "Drop PDF here or click to select" and choose a PDF file
2. **Upload Method 2**: Drag and drop a PDF file directly onto the upload area
3. The system will automatically:
   - Upload the document
   - Analyze it using AI
   - Determine the appropriate classification level
   - Generate a watermarked PDF

### Step 4: Review Results

The classification results include:
- **Classification Level**: The determined security level
- **Confidence Score**: How confident the AI is in its classification
- **Reasoning**: Detailed explanation of why this classification was chosen
- **Key Risk Factors**: Specific sensitive elements identified
- **Handling Recommendations**: Specific recommendations for document handling

### Step 5: Download Watermarked PDF

- Click "Download Watermarked PDF" to get the secure version
- The watermark will be applied based on the classification level:
  - TOP SECRET: Red watermark
  - SECRET: Orange watermark  
  - CONFIDENTIAL: Yellow watermark
  - RESTRICTED: Blue watermark
  - UNCLASSIFIED: Black watermark

## Technical Details

### API Endpoints

The classification service provides these endpoints:

- `POST /api/classify-document`: Classify a document without watermarking
- `POST /api/classify-and-watermark`: Classify and generate watermarked PDF
- `GET /api/download/:filename`: Download classified documents
- `GET /api/classification-health`: Service health check

### File Handling

- **Supported Format**: PDF files only
- **Size Limit**: 50MB maximum
- **Security**: Files are automatically deleted after processing
- **Storage**: Watermarked files are stored in `classified-exports/` directory

### Configuration

You can configure the service by setting environment variables:

```bash
export GEMINI_API_KEY="your-api-key-here"
export CLASSIFICATION_PORT="3003"
```

## Security Considerations

1. **API Key**: Ensure your Gemini API key is kept secure
2. **Network**: The service should be run on secure networks only
3. **Access Control**: Implement proper access controls for classified documents
4. **Audit**: All classification activities should be logged and audited
5. **Disposal**: Ensure temporary files are properly disposed of

## Classification Criteria

The AI analyzes documents based on these critical areas:

### Strategic Content
- Military installations and bases
- Critical infrastructure details
- Border areas and sensitive regions
- Government facilities

### Operational Information
- Troop movements and deployments
- Weapons systems specifications
- Defense strategies and plans
- Intelligence operations

### Personnel Information
- Government officials and activities
- Military and intelligence personnel
- Diplomatic staff details
- Security clearance information

### Technical Details
- Communication protocols
- Encryption methods
- IT infrastructure details
- Cybersecurity measures

## Troubleshooting

### Common Issues

1. **Service not starting**: Check if ports 3000 and 3003 are available
2. **Classification failing**: Ensure Gemini API key is valid and set
3. **Upload failing**: Check file size (must be under 50MB) and format (PDF only)
4. **Watermark not applying**: Verify PDF-lib dependencies are installed

### Error Messages

- `"No file uploaded"`: Select a PDF file before submitting
- `"File size must be less than 50MB"`: Reduce file size or split document
- `"Classification service unavailable"`: Start the classification API service
- `"Invalid API key"`: Check your Gemini API key configuration

## Development

### Dependencies

```json
{
  "@google/generative-ai": "^0.21.0",
  "express": "^4.18.2",
  "multer": "^1.4.5-lts.1",
  "pdf-lib": "^1.17.1",
  "typescript": "^5.0.0"
}
```

### Project Structure

```
├── classification-api.ts      # Main classification service
├── dashboard.js              # Frontend classification logic
├── dashboard.css             # Classification UI styles
├── index.html               # Dashboard with classification button
├── uploads/                 # Temporary upload directory
└── classified-exports/      # Watermarked document output
```

## License

This classification system is designed for government and authorized use only. Ensure compliance with local regulations and security policies.
