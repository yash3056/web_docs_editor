# Web Docs Editor

## Security Improvements

This application now uses the system's secure credential store to manage database encryption keys instead of storing them in local files. This provides several security benefits:

1. Keys are stored in the operating system's secure credential vault:
   - Windows: Windows Credential Manager
   - macOS: Keychain
   - Linux: Secret Service API/libsecret

2. Keys are encrypted by the operating system
3. Keys are tied to the user account
4. Protection from malware that scans the filesystem

## Setup

Install dependencies:

```
npm install
```

## Dependencies

- `keytar`: Native Node module for accessing the system's credential store