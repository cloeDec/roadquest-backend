import request from 'supertest';
import app from '../app';
import { pool } from '../config/database';

describe('Achievements API', () => {
  let authToken: string;
  let testUserId: string;
  const testUser = {
    email: `test_achievements_${Date.now()}@roadquest.com`,
    password: 'TestPassword123',
    username: `testachievements_${Date.now()}`
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
      await pool.query('DELETE FROM user_achievements WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM users WHERE email = $1', [testUser.email]);
    } catch (error) {}
  });

  describe('GET /api/achievements', () => {
    it('devrait retourner la liste de tous les achievements', async () => {
      const response = await request(app)
        .get('/api/achievements')
        .expect(200);

      expect(response.body).toHaveProperty('achievements');
      expect(Array.isArray(response.body.achievements)).toBe(true);
    });

    it('devrait retourner des achievements avec les bons champs', async () => {
      const response = await request(app)
        .get('/api/achievements')
        .expect(200);

      if (response.body.achievements.length > 0) {
        const achievement = response.body.achievements[0];
        expect(achievement).toHaveProperty('achievement_id');
        expect(achievement).toHaveProperty('name');
        expect(achievement).toHaveProperty('description');
        expect(achievement).toHaveProperty('xp_reward');
        expect(achievement).toHaveProperty('icon_url');
        expect(achievement).toHaveProperty('condition_type');
        expect(achievement).toHaveProperty('condition_value');
        expect(achievement).toHaveProperty('rarity');
      }
    });
  });

  describe('GET /api/achievements/user', () => {
    it('devrait retourner les achievements de l\'utilisateur connecté', async () => {
      const response = await request(app)
        .get('/api/achievements/user')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('achievements');
      expect(Array.isArray(response.body.achievements)).toBe(true);
    });

    it('devrait rejeter une requête sans token', async () => {
      const response = await request(app)
        .get('/api/achievements/user')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter un token invalide', async () => {
      const response = await request(app)
        .get('/api/achievements/user')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait retourner des achievements avec progression', async () => {
      const response = await request(app)
        .get('/api/achievements/user')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (response.body.achievements.length > 0) {
        const achievement = response.body.achievements[0];
        expect(achievement).toHaveProperty('progress');
        expect(achievement).toHaveProperty('is_unlocked');
      }
    });
  });

  describe('GET /api/achievements/stats', () => {
    it('devrait retourner les statistiques d\'achievements', async () => {
      const response = await request(app)
        .get('/api/achievements/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('unlocked');
      expect(response.body).toHaveProperty('progress_percentage');
      expect(typeof response.body.total).toBe('number');
      expect(typeof response.body.unlocked).toBe('number');
      expect(typeof response.body.progress_percentage).toBe('number');
    });

    it('devrait rejeter une requête sans token', async () => {
      const response = await request(app)
        .get('/api/achievements/stats')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait avoir un pourcentage entre 0 et 100', async () => {
      const response = await request(app)
        .get('/api/achievements/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.progress_percentage).toBeGreaterThanOrEqual(0);
      expect(response.body.progress_percentage).toBeLessThanOrEqual(100);
    });
  });
});
