import request from 'supertest';
import app from '../app';
import { pool } from '../config/database';

describe('User API', () => {
  let authToken: string;
  let testUserId: string;
  const testUser = {
    email: `test_user_${Date.now()}@roadquest.com`,
    password: 'TestPassword123',
    username: `testuser_${Date.now()}`
  };

  beforeAll(async () => {
    // Créer un utilisateur de test et récupérer le token
    const response = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    authToken = response.body.token;
    testUserId = response.body.user.user_id;
  });

  afterAll(async () => {
    try {
      await pool.query('DELETE FROM users WHERE email = $1', [testUser.email]);
    } catch (error) {}
  });

  describe('GET /api/user/profile', () => {
    it('devrait retourner le profil de l\'utilisateur connecté', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('user_id', testUserId);
      expect(response.body.user).toHaveProperty('email', testUser.email);
      expect(response.body.user).toHaveProperty('username', testUser.username);
      expect(response.body.user).toHaveProperty('xp');
      expect(response.body.user).toHaveProperty('level');
    });

    it('devrait rejeter une requête sans token', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter un token invalide', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait contenir les statistiques utilisateur', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.user).toHaveProperty('total_distance');
      expect(response.body.user).toHaveProperty('total_trips');
      expect(response.body.user).toHaveProperty('regions_explored');
      expect(response.body.user).toHaveProperty('pois_discovered');
    });
  });

  describe('PUT /api/user/motorcycle', () => {
    const validMotorcycle = {
      brand: 'Yamaha',
      model: 'MT-07',
      year: 2023
    };

    it('devrait mettre à jour les informations moto', async () => {
      const response = await request(app)
        .put('/api/user/motorcycle')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validMotorcycle)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Motorcycle information updated successfully');
      expect(response.body).toHaveProperty('motorcycle');
      expect(response.body.motorcycle).toHaveProperty('brand', validMotorcycle.brand);
      expect(response.body.motorcycle).toHaveProperty('model', validMotorcycle.model);
      expect(response.body.motorcycle).toHaveProperty('year', validMotorcycle.year);
    });

    it('devrait rejeter une requête sans token', async () => {
      const response = await request(app)
        .put('/api/user/motorcycle')
        .send(validMotorcycle)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter une requête sans brand', async () => {
      const response = await request(app)
        .put('/api/user/motorcycle')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ model: 'MT-07', year: 2023 })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter une requête sans model', async () => {
      const response = await request(app)
        .put('/api/user/motorcycle')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ brand: 'Yamaha', year: 2023 })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter une requête sans year', async () => {
      const response = await request(app)
        .put('/api/user/motorcycle')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ brand: 'Yamaha', model: 'MT-07' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter une année invalide (trop ancienne)', async () => {
      const response = await request(app)
        .put('/api/user/motorcycle')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ brand: 'Yamaha', model: 'MT-07', year: 1800 })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter une année invalide (dans le futur lointain)', async () => {
      const response = await request(app)
        .put('/api/user/motorcycle')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ brand: 'Yamaha', model: 'MT-07', year: 2050 })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait accepter une photo_url optionnelle', async () => {
      const response = await request(app)
        .put('/api/user/motorcycle')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...validMotorcycle,
          photo_url: 'https://example.com/photo.jpg'
        })
        .expect(200);

      expect(response.body.motorcycle).toHaveProperty('photo_url', 'https://example.com/photo.jpg');
    });
  });

  describe('GET /api/user/statistics', () => {
    it('devrait retourner les statistiques utilisateur', async () => {
      const response = await request(app)
        .get('/api/user/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('statistics');
      expect(response.body.statistics).toHaveProperty('total_distance');
      expect(response.body.statistics).toHaveProperty('total_trips');
      expect(response.body.statistics).toHaveProperty('regions_explored');
      expect(response.body.statistics).toHaveProperty('pois_discovered');
    });

    it('devrait rejeter une requête sans token', async () => {
      const response = await request(app)
        .get('/api/user/statistics')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait retourner des valeurs numériques', async () => {
      const response = await request(app)
        .get('/api/user/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(typeof response.body.statistics.total_distance).toBe('number');
      expect(typeof response.body.statistics.total_trips).toBe('number');
      expect(typeof response.body.statistics.regions_explored).toBe('number');
      expect(typeof response.body.statistics.pois_discovered).toBe('number');
    });
  });
});
