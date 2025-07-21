# Media and Links

The Web Docs Editor supports inserting images and hyperlinks to enhance your documents with multimedia content and external references.

## Inserting Links

### Link Creation Process
1. **Select Text**: Highlight the text you want to turn into a link (optional)
2. **Click Link Button**: Click the link icon in the toolbar
3. **Enter Details**: Fill in the link modal with required information
4. **Insert Link**: Click "Insert" to add the link to your document

### Link Modal Fields
- **Link Text**: The visible text that will be clickable
  - Pre-filled with selected text if any
  - Can be customized to be more descriptive
- **Link URL**: The destination URL
  - Must include protocol (http:// or https://)
  - Supports various URL types (websites, email, etc.)

### Link Types Supported
- **Web URLs**: https://example.com
- **Email Links**: mailto:user@example.com
- **Phone Links**: tel:+1234567890
- **File Links**: Links to downloadable files
- **Anchor Links**: Links to sections within the same page

### Link Behavior
- **New Tab Opening**: Links open in new tabs by default (target="_blank")
- **Visual Styling**: Links appear in blue with underline
- **Hover Effects**: Links change color on hover
- **Accessibility**: Proper ARIA attributes for screen readers

## Inserting Images

### Image Sources
The editor supports two methods for adding images:

#### 1. From URL
- **Web Images**: Link to images hosted online
- **Direct URLs**: Must be direct links to image files
- **Supported Formats**: JPG, PNG, GIF, WebP
- **External Hosting**: Images remain on their original servers

#### 2. File Upload
- **Local Files**: Upload images from your device
- **Drag and Drop**: Drag image files directly into the upload area
- **File Browser**: Click to browse and select files
- **File Size Limit**: Maximum 5MB per image

### Image Modal Interface

#### Tab Navigation
- **From URL Tab**: Enter image URL directly
- **Upload File Tab**: Upload from local device

#### URL Tab Fields
- **Image URL**: Direct link to the image file
- **Alt Text**: Description for accessibility (recommended)
- **Width**: Optional width specification in pixels

#### Upload Tab Features
- **File Input**: Traditional file selection button
- **Drag & Drop Zone**: Visual area for dragging files
- **File Validation**: Automatic checking of file type and size
- **Image Preview**: Shows selected image before insertion
- **File Information**: Displays filename and file size

### Image Properties
- **Alt Text**: Descriptive text for accessibility and SEO
  - Describes the image content
  - Used by screen readers
  - Shown if image fails to load
- **Width Control**: Optional width specification
  - Specified in pixels
  - Maintains aspect ratio automatically
  - Responsive behavior on smaller screens

### Image Handling
- **Automatic Sizing**: Images automatically fit within document width
- **Responsive Design**: Images scale appropriately on different devices
- **Quality Preservation**: Original image quality maintained
- **Format Support**: Handles all common web image formats

## File Upload Features

### Drag and Drop
- **Visual Feedback**: Drop zone highlights when dragging files
- **File Validation**: Immediate feedback on file compatibility
- **Multiple Files**: Can handle multiple files (processes first valid image)
- **Error Handling**: Clear messages for invalid files

### File Validation
- **Type Checking**: Only image files accepted
- **Size Limits**: 5MB maximum file size
- **Format Support**: JPG, PNG, GIF, WebP formats
- **Error Messages**: Clear feedback for validation failures

### Upload Process
1. **File Selection**: Choose file via browse or drag & drop
2. **Validation**: Automatic file type and size checking
3. **Preview**: Image preview with file information
4. **Processing**: File converted to data URL for embedding
5. **Insertion**: Image embedded directly in document

## Media Management

### Image Optimization
- **Automatic Resizing**: Images sized appropriately for documents
- **Responsive Behavior**: Images adapt to different screen sizes
- **Performance**: Efficient handling of image data
- **Quality Balance**: Maintains quality while optimizing size

### Storage Considerations
- **Embedded Images**: Uploaded images are embedded as data URLs
- **Document Size**: Images increase overall document size
- **Performance Impact**: Large images may affect editor performance
- **Backup Implications**: Images included in document backups

## Best Practices

### Link Best Practices
- **Descriptive Text**: Use meaningful link text, not "click here"
- **URL Validation**: Verify links work before inserting
- **External Links**: Clearly indicate when links go to external sites
- **Accessibility**: Always provide context for links

### Image Best Practices
- **Alt Text**: Always provide descriptive alt text
- **File Size**: Optimize images before upload to reduce file size
- **Appropriate Sizing**: Use width settings to control image display
- **Copyright**: Only use images you have rights to use
- **Format Choice**: Use appropriate formats (JPG for photos, PNG for graphics)

### Performance Optimization
- **Image Compression**: Compress images before upload
- **Appropriate Dimensions**: Don't upload oversized images
- **Format Selection**: Choose optimal format for each image type
- **Quantity Management**: Don't overload documents with too many images

## Accessibility Features

### Link Accessibility
- **Keyboard Navigation**: Links accessible via keyboard
- **Screen Reader Support**: Proper ARIA labels and descriptions
- **Focus Indicators**: Clear visual focus indicators
- **Context Information**: Links provide context about their destination

### Image Accessibility
- **Alt Text Requirement**: Prompts for descriptive alt text
- **Screen Reader Support**: Images properly described to screen readers
- **Keyboard Navigation**: Images don't interfere with keyboard navigation
- **High Contrast**: Images work well with high contrast modes

## Troubleshooting

### Common Link Issues
- **Broken Links**: Links don't work or go to wrong destination
  - Solution: Verify URL is correct and complete
- **Formatting Problems**: Links don't appear correctly
  - Solution: Check HTML formatting and try reinserting
- **Security Warnings**: Browser warns about unsafe links
  - Solution: Ensure links use HTTPS when possible

### Common Image Issues
- **Upload Failures**: Images won't upload
  - Solution: Check file size (under 5MB) and format (JPG, PNG, GIF, WebP)
- **Display Problems**: Images don't show correctly
  - Solution: Verify image URL is accessible or re-upload file
- **Size Issues**: Images too large or small
  - Solution: Use width setting or resize image before upload
- **Performance Issues**: Editor slow with images
  - Solution: Reduce image file sizes or quantity

### Error Messages
- **"Please select an image file"**: File type not supported
- **"Image file is too large"**: File exceeds 5MB limit
- **"Please enter an image URL"**: URL field is empty
- **"Failed to insert image"**: General insertion error

### Recovery Options
- **Re-upload**: Try uploading image again
- **Different Format**: Convert image to different format
- **Resize Image**: Reduce image dimensions or quality
- **Alternative Source**: Try different image URL or file