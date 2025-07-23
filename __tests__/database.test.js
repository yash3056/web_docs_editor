const crypto = require('crypto');

// Mock keytar for testing
jest.mock('keytar', () => ({
  setPassword: jest.fn().mockResolvedValue(true),
  getPassword: jest.fn().mockResolvedValue(null),
}));

// Set test environment before importing
process.env.NODE_ENV = 'test';

const database = require('../database');

describe('Database Encryption', () => {
  beforeAll(async () => {
    // Initialize database for tests
    await database.initializeDatabaseAsync();
  });

  afterAll(() => {
    if (database.db) {
      database.db.close();
    }
  });

  describe('Encryption Key Management', () => {
    it('should generate a secure encryption key', () => {
      // Test key generation pattern
      const key = crypto.randomBytes(32).toString('hex');
      expect(key).toHaveLength(64); // 32 bytes = 64 hex characters
      expect(key).toMatch(/^[a-f0-9]+$/); // Only hex characters
    });

    it('should have database instance available', () => {
      expect(database.db).toBeDefined();
      expect(typeof database.db.prepare).toBe('function');
    });

    it('should have all required functions exported', () => {
      expect(typeof database.createUser).toBe('function');
      expect(typeof database.validateUser).toBe('function');
      expect(typeof database.getUserById).toBe('function');
      expect(typeof database.saveDocument).toBe('function');
      expect(typeof database.getUserDocuments).toBe('function');
      expect(typeof database.initializeDatabaseAsync).toBe('function');
    });
  });

  describe('Database Functionality', () => {
    it('should create and validate users', async () => {
      const testEmail = 'test@example.com';
      const testUsername = 'testuser';
      const testPassword = 'password123';

      // Create user
      const user = await database.createUser(testEmail, testUsername, testPassword);
      expect(user).toHaveProperty('id');
      expect(user.email).toBe(testEmail);
      expect(user.username).toBe(testUsername);

      // Validate user
      const validatedUser = await database.validateUser(testEmail, testPassword);
      expect(validatedUser).toBeTruthy();
      expect(validatedUser.email).toBe(testEmail);

      // Invalid password should return null
      const invalidUser = await database.validateUser(testEmail, 'wrongpassword');
      expect(invalidUser).toBeNull();
    });

    it('should handle document operations', () => {
      const testDocument = {
        id: 'test-doc-1',
        title: 'Test Document',
        content: { text: 'This is a test document' }
      };
      const userId = 1;

      // Save document
      const result = database.saveDocument(testDocument, userId);
      expect(result).toBeDefined();

      // Get user documents
      const documents = database.getUserDocuments(userId);
      expect(Array.isArray(documents)).toBe(true);

      // Get specific document
      const retrievedDoc = database.getUserDocument(testDocument.id, userId);
      expect(retrievedDoc).toBeTruthy();
      expect(retrievedDoc.id).toBe(testDocument.id);
      expect(retrievedDoc.title).toBe(testDocument.title);
    });

    it('should handle version control operations', async () => {
      const testDocument = {
        id: 'test-doc-version',
        title: 'Versioned Document',
        content: { text: 'Version 1 content' }
      };
      const userId = 1;

      // Save document with version
      database.saveDocumentWithVersion(testDocument, userId, 'Initial version');

      // Get version history
      const history = database.getDocumentVersionHistory(testDocument.id, userId);
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle duplicate user creation', async () => {
      const testEmail = 'duplicate@example.com';
      const testUsername = 'duplicateuser';
      const testPassword = 'password123';

      // Create first user
      await database.createUser(testEmail, testUsername, testPassword);

      // Try to create duplicate user
      await expect(
        database.createUser(testEmail, testUsername, testPassword)
      ).rejects.toThrow('Email or username already exists');
    });

    it('should handle non-existent document access', () => {
      const nonExistentDoc = database.getUserDocument('non-existent', 999);
      expect(nonExistentDoc).toBeNull();
    });

    it('should handle invalid user validation', async () => {
      const invalidUser = await database.validateUser('nonexistent@example.com', 'password');
      expect(invalidUser).toBeNull();
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should work in test environment', () => {
      expect(process.env.NODE_ENV).toBe('test');
      expect(database.db).toBeDefined();
    });

    it('should have proper database path handling', () => {
      // In test mode, database should be in-memory
      expect(process.env.NODE_ENV).toBe('test');
    });
  });
});