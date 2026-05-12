import request from 'supertest';
import app from '../app';
import { pool } from '../config/database';

describe('Auth API', () => {
  const testUser = {
    email: `test_${Date.now()}@roadquest.com`,
    password: 'TestPassword123',
    username: `testuser_${Date.now()}`
  };

  let authToken: string;

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM users WHERE email = $1', [testUser.email]);
    } catch (error) {}
  });

  describe('POST /api/auth/register', () => {
    it('devrait créer un nouvel utilisateur avec succès', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'User created successfully');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('email', testUser.email);
      expect(response.body.user).toHaveProperty('username', testUser.username);
      expect(response.body.user).toHaveProperty('xp', 0);
      expect(response.body.user).toHaveProperty('level', 1);

      authToken = response.body.token;
    });

    it('devrait rejeter un email déjà utilisé', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body).toHaveProperty('error', 'Email already registered');
    });

    it('devrait rejeter une requête sans email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ password: 'Test123', username: 'test' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter une requête sans password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@test.com', username: 'test' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter une requête sans username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@test.com', password: 'Test123' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/login', () => {
    it('devrait connecter un utilisateur existant', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('email', testUser.email);
    });

    it('devrait rejeter un email inexistant', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'Test123'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('devrait rejeter un mot de passe incorrect', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('devrait rejeter une requête sans email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'Test123' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter une requête sans password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
