# Authentication System

## Overview

Your Web Docs Editor now includes a complete authentication system that resolves the issue where documents weren't shared between different browsers. Now all documents are stored in a SQLite database and are associated with user accounts.

## What's New

### 🔐 User Authentication
- **Login & Register**: Users can create accounts and log in
- **JWT Tokens**: Secure authentication using JSON Web Tokens
- **Password Security**: Passwords are hashed using bcrypt
- **Session Management**: Automatic logout on token expiration

### 🗄️ Database Storage
- **SQLite Database**: Lightweight, serverless database (app.db)
- **User Management**: Stores user accounts securely
- **Document Storage**: All documents are now stored per user
- **Data Persistence**: Documents persist across browsers and sessions

### 🛡️ Security Features
- **Protected Routes**: All document operations require authentication
- **Token Validation**: Server validates tokens on every request
- **Auto-Redirect**: Unauthenticated users redirected to login
- **Error Handling**: Proper error messages for failed operations

## How It Works

### Before (Problem)
```
Browser 1: localStorage → Document A ❌ Not visible to Browser 2
Browser 2: localStorage → Empty      ❌ Cannot see Document A
```

### After (Solution)
```
Browser 1: User Login → Database → Document A ✅ Stored in database
Browser 2: Same User Login → Database → Document A ✅ Same document visible
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Documents Table
```sql
CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
)
```

## API Endpoints

### Authentication
- `POST /api/register` - Create new user account
- `POST /api/login` - Login and get JWT token

### Documents (Protected)
- `GET /api/documents` - Get all user documents
- `GET /api/documents/:id` - Get specific document
- `POST /api/documents` - Save/update document
- `DELETE /api/documents/:id` - Delete document
- `POST /api/documents/:id/export` - Export document

## Usage

### First Time Setup
1. Start the server: `npm start`
2. Go to `http://localhost:3000`
3. You'll be redirected to login page
4. Click "Sign up" to create an account
5. Login with your credentials
6. Create and save documents

### Accessing from Different Browsers
1. Open any browser
2. Go to `http://localhost:3000`
3. Login with the same account
4. All your documents will be there!

## File Structure
```
web_docs_editor/
├── app.db              # SQLite database (auto-created)
├── server.js           # Main server with auth routes
├── database.js         # Database operations
├── auth/
│   ├── auth.js         # JWT authentication
│   └── login.html      # Login/register page
├── api-client.js       # Updated with auth headers
├── dashboard.js        # Updated with auth check
├── docseditor\docseditor.js       # Updated with auth check
└── ...
```

## Deployment to Vercel

The authentication system works perfectly with Vercel:

1. **Database**: SQLite file is included in deployment
2. **Environment Variables**: Set JWT_SECRET in Vercel dashboard
3. **Serverless**: All routes work with Vercel's serverless functions

## Security Notes

- Change `JWT_SECRET` in production (currently using default)
- Passwords are hashed with bcrypt (salt rounds: 10)
- Tokens expire after 7 days
- All routes validate user authentication
- Foreign key constraints ensure data integrity

## Benefits

✅ **Cross-Browser Access**: Documents available everywhere
✅ **User Isolation**: Each user sees only their documents  
✅ **Data Persistence**: No more lost documents
✅ **Scalable**: Supports multiple users
✅ **Secure**: Industry-standard authentication
✅ **Vercel Ready**: Deploys seamlessly

Your app now behaves like a proper cloud document editor where users can access their documents from anywhere!
