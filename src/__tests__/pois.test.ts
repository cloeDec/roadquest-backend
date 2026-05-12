import request from 'supertest';
import app from '../app';
import { pool } from '../config/database';

describe('POIs API', () => {
  let authToken: string;
  let userId: string;
  let createdPoiId: string;

  const testUser = {
    email: `pois_test_${Date.now()}@roadquest.com`,
    password: 'TestPassword123',
    username: `poisuser_${Date.now()}`
  };

  const validPoi = {
    name: 'Col du Galibier Test',
    type: 'col',
    description: 'Un des plus beaux cols des Alpes françaises',
    latitude: 45.064167,
    longitude: 6.407778,
    rating: 4.8,
    image_url: 'https://example.com/galibier.jpg'
  };

  beforeAll(async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    authToken = response.body.token;
    userId = response.body.user.user_id;
  });

  afterAll(async () => {
    try {
      if (createdPoiId) {
        await pool.query('DELETE FROM pois WHERE poi_id = $1', [createdPoiId]);
      }
      await pool.query('DELETE FROM users WHERE email = $1', [testUser.email]);
    } catch (error) {}
  });

  describe('GET /api/pois', () => {
    it('devrait récupérer tous les POIs', async () => {
      const response = await request(app)
        .get('/api/pois')
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('pois');
      expect(Array.isArray(response.body.pois)).toBe(true);
    });
  });

  describe('GET /api/pois/nearby', () => {
    it('devrait récupérer les POIs à proximité', async () => {
      const response = await request(app)
        .get('/api/pois/nearby')
        .query({
          latitude: 45.188529,
          longitude: 5.724524,
          radius: 100000
        })
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('pois');
      expect(response.body).toHaveProperty('center');
      expect(response.body).toHaveProperty('radius_meters', 100000);
      expect(Array.isArray(response.body.pois)).toBe(true);
    });

    it('devrait rejeter une requête sans latitude', async () => {
      const response = await request(app)
        .get('/api/pois/nearby')
        .query({
          longitude: 5.724524,
          radius: 100000
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter une requête sans longitude', async () => {
      const response = await request(app)
        .get('/api/pois/nearby')
        .query({
          latitude: 45.188529,
          radius: 100000
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait utiliser un radius par défaut si non spécifié', async () => {
      const response = await request(app)
        .get('/api/pois/nearby')
        .query({
          latitude: 45.188529,
          longitude: 5.724524
        })
        .expect(200);

      expect(response.body).toHaveProperty('radius_meters', 50000);
    });

    it('devrait rejeter des coordonnées invalides', async () => {
      const response = await request(app)
        .get('/api/pois/nearby')
        .query({
          latitude: 'invalid',
          longitude: 5.724524
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/pois', () => {
    it('devrait créer un nouveau POI avec succès', async () => {
      const response = await request(app)
        .post('/api/pois')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validPoi)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'POI créé avec succès');
      expect(response.body).toHaveProperty('poi');
      expect(response.body.poi).toHaveProperty('poi_id');
      expect(response.body.poi).toHaveProperty('name', validPoi.name);
      expect(response.body.poi).toHaveProperty('type', validPoi.type);

      createdPoiId = response.body.poi.poi_id;
    });

    it('devrait rejeter une requête sans authentification', async () => {
      const response = await request(app)
        .post('/api/pois')
        .send(validPoi)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter un POI sans nom', async () => {
      const invalidPoi = { ...validPoi };
      delete (invalidPoi as any).name;

      const response = await request(app)
        .post('/api/pois')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPoi)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter un type de POI invalide', async () => {
      const invalidPoi = { ...validPoi, type: 'invalid_type' };

      const response = await request(app)
        .post('/api/pois')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPoi)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter des coordonnées hors limites', async () => {
      const invalidPoi = { ...validPoi, latitude: 200 };

      const response = await request(app)
        .post('/api/pois')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPoi)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter un rating hors limites', async () => {
      const invalidPoi = { ...validPoi, rating: 10 };

      const response = await request(app)
        .post('/api/pois')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPoi)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait accepter tous les types de POI valides', async () => {
      const validTypes = ['col', 'route_panoramique', 'virage', 'spot_photo', 'monument', 'autre'];

      for (const type of validTypes) {
        const poi = {
          ...validPoi,
          name: `Test POI ${type} ${Date.now()}`,
          type,
          latitude: 45.0 + Math.random() * 0.1,
          longitude: 6.0 + Math.random() * 0.1
        };

        const response = await request(app)
          .post('/api/pois')
          .set('Authorization', `Bearer ${authToken}`)
          .send(poi);

        expect(response.status).toBe(201);

        if (response.body.poi?.poi_id) {
          await pool.query('DELETE FROM pois WHERE poi_id = $1', [response.body.poi.poi_id]);
        }
      }
    });
  });

  describe('GET /api/pois/visited', () => {
    it('devrait récupérer les POIs visités par l\'utilisateur', async () => {
      const response = await request(app)
        .get('/api/pois/visited')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('pois');
      expect(Array.isArray(response.body.pois)).toBe(true);
    });

    it('devrait rejeter une requête sans authentification', async () => {
      const response = await request(app)
        .get('/api/pois/visited')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});
