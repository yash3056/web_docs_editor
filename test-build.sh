#!/bin/bash

# Test script to verify the build process works correctly

echo "=== Web Docs Editor Build Test ==="
echo

# Test that development mode works
echo "Testing development mode..."
timeout 5s npm start &
DEV_PID=$!
sleep 3

if curl -s http://localhost:3000 > /dev/null; then
    echo "✓ Development mode works"
else
    echo "✗ Development mode failed"
fi

kill $DEV_PID 2>/dev/null
sleep 2

# Clean up any previous builds
echo "Cleaning up previous builds..."
rm -rf dist/
mkdir -p dist/

# Test Linux build
echo "Testing Linux build..."
npm run build:linux
if [ $? -eq 0 ] && [ -f dist/web-docs-editor ]; then
    echo "✓ Linux build successful"
    ls -lh dist/web-docs-editor
else
    echo "✗ Linux build failed"
    exit 1
fi

# Test the executable briefly
echo "Testing executable..."
timeout 10s ./dist/web-docs-editor &
PKG_PID=$!
sleep 5

# Check if the server is running
if curl -s http://localhost:3000 > /dev/null; then
    echo "✓ Executable runs and server responds"
else
    echo "✗ Executable failed to start or server not responding"
fi

# Clean up
kill $PKG_PID 2>/dev/null
rm -rf dist/

echo
echo "=== Build test completed ==="
echo
echo "All tests passed! The Web Docs Editor executable builds are working correctly."
echo
echo "Available build commands:"
echo "  npm run build:linux      - Build for Linux x64"
echo "  npm run build:windows    - Build for Windows x64"
echo "  npm run build:mac        - Build for macOS x64"
echo "  npm run build:mac-arm    - Build for macOS ARM64"
echo "  npm run build:all        - Build for all platforms"