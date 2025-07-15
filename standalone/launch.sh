#!/bin/bash

echo "=========================================="
echo "  Web Docs Editor - Standalone Version"
echo "=========================================="
echo ""
echo "Starting Web Docs Editor..."
echo ""
echo "This will open the application in your default web browser."
echo "The application runs entirely in your browser without needing"
echo "an internet connection or server installation."
echo ""
echo "Demo account:"
echo "  Email: demo@example.com"
echo "  Password: demo123"
echo ""
echo "Press Enter to continue..."
read -r

# Try to open with different browsers
if command -v xdg-open > /dev/null; then
    xdg-open index.html
elif command -v open > /dev/null; then
    open index.html
elif command -v start > /dev/null; then
    start index.html
else
    echo "Please open index.html in your web browser manually."
fi

echo ""
echo "Application launched in your browser!"
echo ""
echo "To use the application:"
echo "1. Login with the demo account or create a new account"
echo "2. Create and edit documents"
echo "3. All data is stored locally in your browser"
echo "4. Export documents as HTML, PDF, or RTF"
echo ""
echo "Press Enter to exit this launcher..."
read -r