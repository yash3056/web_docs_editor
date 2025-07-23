#!/bin/bash

# Web Docs Editor Version Control Demo Setup

echo "🚀 Setting up Web Docs Editor with Version Control..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p documents
mkdir -p exports

# Initialize database
echo "🗄️ Initializing database..."
node -e "
const { initDatabase } = require('./database/database');
try {
    initDatabase();
    console.log('✅ Database initialized successfully');
} catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
}
"

# Start the server
echo "🌐 Starting server..."
echo "📝 Your Web Docs Editor with Version Control is ready!"
echo ""
echo "🔗 Open your browser and navigate to:"
echo "   http://localhost:3000"
echo ""
echo "✨ Features available:"
echo "   • Document creation and editing"
echo "   • Version control (like Git)"
echo "   • Document history tracking"
echo "   • Version comparison"
echo "   • Tagging and branching"
echo "   • User authentication"
echo "   • Export to PDF/DOCX/HTML"
echo ""
echo "🎯 To test version control:"
echo "   1. Create a new document"
echo "   2. Edit and save multiple times"
echo "   3. Click the version control button (branch icon)"
echo "   4. View version history and restore old versions"
echo ""

# Start the server
npm start
