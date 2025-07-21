# Watermarks

The Web Docs Editor includes a comprehensive watermark system that allows you to add custom watermarks to your documents for branding, security, or identification purposes.

## Watermark Overview

### What are Watermarks?
- **Background Text**: Semi-transparent text overlaid on document content
- **Non-intrusive**: Visible but doesn't interfere with document readability
- **Professional**: Adds a professional touch to documents
- **Customizable**: Full control over appearance and positioning

### Use Cases
- **Branding**: Add company names or logos as text
- **Security**: Mark documents as "CONFIDENTIAL" or "DRAFT"
- **Identification**: Add document version or author information
- **Legal**: Mark documents with copyright or ownership information

## Adding Watermarks

### Accessing Watermark Controls
1. **Toolbar Button**: Click the watermark icon (droplet) in the toolbar
2. **Toggle Functionality**: Button acts as add/remove toggle
3. **Modal Interface**: Opens watermark configuration modal

### Watermark Configuration

#### Text Settings
- **Watermark Text**: Enter the text to display as watermark
  - Required field - cannot be empty
  - Supports any text characters
  - Common examples: "DRAFT", "CONFIDENTIAL", "Company Name"
  - Length should be reasonable for display

#### Appearance Controls
- **Opacity**: Control transparency level
  - Range: 0.1 to 0.5 (10% to 50% opacity)
  - Default: 0.2 (20% opacity)
  - Lower values = more transparent
  - Higher values = more visible

- **Size**: Choose watermark text size
  - Small: Subtle, less prominent
  - Medium: Balanced visibility (default)
  - Large: More prominent, highly visible

- **Color**: Select watermark color
  - Color picker interface
  - Default: Light gray (#cccccc)
  - Choose colors that complement document content
  - Consider contrast with document background

- **Angle**: Set rotation angle
  - Range: -45° to +45°
  - Default: -30° (diagonal orientation)
  - Negative values: Counter-clockwise rotation
  - Positive values: Clockwise rotation
  - 0°: Horizontal text

### Applying Watermarks
1. **Configure Settings**: Adjust all watermark properties as desired
2. **Apply Button**: Click "Apply" to add watermark to document
3. **Immediate Effect**: Watermark appears immediately in document
4. **Background Layer**: Watermark appears behind document content

## Managing Watermarks

### Watermark States
- **No Watermark**: Default state, no watermark applied
- **Watermark Active**: Watermark visible in document
- **Button Indicator**: Toolbar button shows active state when watermark is applied

### Removing Watermarks
1. **Toolbar Toggle**: Click watermark button when watermark is active
2. **Modal Remove**: Use "Remove" button in watermark modal
3. **Immediate Removal**: Watermark disappears immediately
4. **Settings Preserved**: Previous settings remembered for re-application

### Modifying Watermarks
1. **Open Modal**: Click watermark button to open configuration
2. **Adjust Settings**: Modify any watermark properties
3. **Re-apply**: Click "Apply" to update watermark with new settings
4. **Live Preview**: Changes apply immediately

## Watermark Display

### Visual Characteristics
- **Positioning**: Centered on each page
- **Layer**: Appears behind document content
- **Transparency**: Semi-transparent overlay
- **Rotation**: Diagonal orientation by default
- **Scaling**: Automatically sized for page dimensions

### Page Coverage
- **All Pages**: Watermark appears on every page of document
- **Consistent**: Same watermark on all pages
- **Print Friendly**: Watermark included in printed documents
- **Export Compatible**: Included in PDF and other exports

### Interaction
- **Non-selectable**: Cannot be selected or edited directly
- **Non-interfering**: Doesn't affect text selection or editing
- **Background Only**: Always stays behind document content
- **Cursor Transparent**: Cursor passes through watermark

## Export Behavior

### PDF Export
- **Included**: Watermarks automatically included in PDF exports
- **Proper Layering**: Maintains background positioning
- **Quality Preservation**: Watermark quality maintained in PDF
- **Print Ready**: Appears correctly when PDF is printed

### Other Formats
- **HTML Export**: Watermark included in HTML output
- **DOCX Export**: Watermark handling depends on format capabilities
- **Consistent Appearance**: Maintains visual properties across formats

## Best Practices

### Text Selection
- **Keep it Short**: Shorter text works better as watermarks
- **Clear Message**: Use clear, concise text
- **Professional Language**: Choose appropriate professional terms
- **Avoid Special Characters**: Stick to standard alphanumeric characters

### Visual Design
- **Subtle Opacity**: Don't make watermarks too dark (0.1-0.3 recommended)
- **Appropriate Size**: Medium size works well for most documents
- **Color Harmony**: Choose colors that complement document theme
- **Consistent Angle**: -30° diagonal is professional and readable

### Usage Guidelines
- **Purpose-Driven**: Only add watermarks when they serve a purpose
- **Document Type**: Consider if watermark is appropriate for document type
- **Audience**: Consider how watermark will be perceived by readers
- **Legal Compliance**: Ensure watermark text complies with legal requirements

## Common Watermark Examples

### Security Watermarks
- "CONFIDENTIAL"
- "INTERNAL USE ONLY"
- "DRAFT - NOT FOR DISTRIBUTION"
- "PRELIMINARY"
- "FOR REVIEW ONLY"

### Branding Watermarks
- Company name
- Department name
- Project name
- "© 2024 Company Name"

### Status Watermarks
- "DRAFT"
- "FINAL"
- "APPROVED"
- "UNDER REVIEW"
- "ARCHIVED"

## Troubleshooting

### Common Issues
- **Watermark Not Visible**: Check opacity setting (may be too low)
- **Text Too Dark**: Reduce opacity or choose lighter color
- **Wrong Position**: Watermark is always centered - this is by design
- **Export Problems**: Watermark may not appear in some export formats

### Solutions
- **Adjust Opacity**: Increase opacity if watermark is too faint
- **Change Color**: Try different colors for better visibility
- **Modify Size**: Adjust size for better fit with document content
- **Re-apply**: Remove and re-add watermark if display issues occur

### Performance Considerations
- **Document Size**: Watermarks may slightly increase document size
- **Rendering**: Complex watermarks may affect rendering performance
- **Export Time**: May slightly increase export processing time
- **Memory Usage**: Minimal impact on memory usage

## Technical Details

### Implementation
- **CSS Positioning**: Uses absolute positioning for placement
- **Z-index**: Proper layering behind document content
- **Transform**: CSS transforms for rotation
- **Opacity**: CSS opacity for transparency effects

### Browser Compatibility
- **Modern Browsers**: Works in all modern browsers
- **Mobile Support**: Fully functional on mobile devices
- **Print Support**: Appears correctly when printing
- **Export Compatibility**: Included in most export formats

### Storage
- **Settings Persistence**: Watermark settings saved with document
- **State Management**: Watermark state tracked in document data
- **Version Control**: Watermark changes tracked in version history
- **Backup Included**: Watermark settings included in document backups