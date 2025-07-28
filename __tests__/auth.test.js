const request = require('supertest');
const { generateToken } = require('../auth/auth');

// Mock keytar for testing to avoid credential storage during tests
jest.mock('keytar', () => ({
  setPassword: jest.fn().mockResolvedValue(true),
  getPassword: jest.fn().mockResolvedValue(null),
}));

const database = require('../database/database');
const { getAdapter } = require('../database/DatabaseManager');
const createTestApp = require('../test-utils/test-server');

let app, db, adapter;

beforeAll(async () => {
  // Initialize test server with database
  app = await createTestApp();
  adapter = getAdapter();
  db = database.db; // Keep for direct SQL operations in tests
});

afterAll(async () => {
  if (adapter) {
    await adapter.disconnect();
  }
});

describe('Auth API', () => {
  let token;
  let user;

  beforeEach(async () => {
    // Clear users table
    if (db) {
      db.exec('DELETE FROM users');
    }
    // Create test user using the adapter
    user = await adapter.createUser('test@example.com', 'testuser', 'password123');
    token = generateToken(user);
  });

  describe('POST /api/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/register')
        .send({
          email: 'newuser@example.com',
          username: 'newuser',
          password: 'password123',
        });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
    });

    it('should not register a user with an existing email', async () => {
      const res = await request(app)
        .post('/api/register')
        .send({
          email: 'test@example.com',
          username: 'anotheruser',
          password: 'password123',
        });
      expect(res.statusCode).toEqual(400);
    });
  });

  describe('POST /api/login', () => {
    it('should login a user with valid credentials', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
    });

    it('should not login a user with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('GET /api/documents', () => {
    it('should not allow access to protected routes without a token', async () => {
      const res = await request(app).get('/api/documents');
      expect(res.statusCode).toEqual(401);
    });

    it('should allow access to protected routes with a valid token', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toEqual(200);
    });
  });
});