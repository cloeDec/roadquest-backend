import request from 'supertest';
import app from '../app';
import { pool } from '../config/database';

describe('Rides API', () => {
  let authToken: string;
  let userId: string;
  let createdRideId: string;

  const testUser = {
    email: `rides_test_${Date.now()}@roadquest.com`,
    password: 'TestPassword123',
    username: `ridesuser_${Date.now()}`
  };

  const validRide = {
    start_location: {
      latitude: 45.764043,
      longitude: 4.835659
    },
    end_location: {
      latitude: 45.188529,
      longitude: 5.724524
    },
    route: [
      { latitude: 45.764043, longitude: 4.835659, timestamp: Date.now() },
      { latitude: 45.5, longitude: 5.0, timestamp: Date.now() + 1000 },
      { latitude: 45.188529, longitude: 5.724524, timestamp: Date.now() + 2000 }
    ],
    distance: 115.5,
    duration: 5400,
    avg_speed: 77,
    destination_name: 'Grenoble',
    is_public: true
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
      await pool.query('DELETE FROM rides WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM users WHERE email = $1', [testUser.email]);
    } catch (error) {}
  });

  describe('POST /api/rides', () => {
    it('devrait créer un nouveau trajet avec succès', async () => {
      const response = await request(app)
        .post('/api/rides')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validRide)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Trajet créé avec succès');
      expect(response.body).toHaveProperty('ride');
      expect(response.body.ride).toHaveProperty('ride_id');
      expect(response.body.ride).toHaveProperty('distance');
      expect(response.body.ride).toHaveProperty('duration', validRide.duration);
      expect(typeof response.body.ride.distance).toBe('number');

      createdRideId = response.body.ride.ride_id;
    });

    it('devrait rejeter une requête sans authentification', async () => {
      const response = await request(app)
        .post('/api/rides')
        .send(validRide)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter un trajet sans start_location', async () => {
      const invalidRide = { ...validRide };
      delete (invalidRide as any).start_location;

      const response = await request(app)
        .post('/api/rides')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRide)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter un trajet sans route', async () => {
      const invalidRide = { ...validRide };
      delete (invalidRide as any).route;

      const response = await request(app)
        .post('/api/rides')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRide)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter un trajet avec distance négative', async () => {
      const invalidRide = { ...validRide, distance: -10 };

      const response = await request(app)
        .post('/api/rides')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRide)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter un trajet avec duration négative', async () => {
      const invalidRide = { ...validRide, duration: -100 };

      const response = await request(app)
        .post('/api/rides')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRide)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/rides', () => {
    it('devrait récupérer les trajets de l\'utilisateur', async () => {
      const response = await request(app)
        .get('/api/rides')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('rides');
      expect(Array.isArray(response.body.rides)).toBe(true);
      expect(response.body.count).toBeGreaterThanOrEqual(1);
    });

    it('devrait rejeter une requête sans authentification', async () => {
      const response = await request(app)
        .get('/api/rides')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/rides/:rideId', () => {
    it('devrait récupérer un trajet spécifique', async () => {
      expect(createdRideId).toBeDefined();

      const response = await request(app)
        .get(`/api/rides/${createdRideId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('ride');
      expect(response.body.ride).toHaveProperty('ride_id', createdRideId);
    });

    it('devrait retourner 404 pour un trajet inexistant', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .get(`/api/rides/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter une requête sans authentification', async () => {
      const response = await request(app)
        .get(`/api/rides/${createdRideId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/rides/:rideId', () => {
    it('devrait supprimer un trajet avec succès', async () => {
      const createResponse = await request(app)
        .post('/api/rides')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validRide);

      const rideToDelete = createResponse.body.ride.ride_id;

      const response = await request(app)
        .delete(`/api/rides/${rideToDelete}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Trajet supprimé avec succès');
    });

    it('devrait retourner 404 pour un trajet inexistant', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .delete(`/api/rides/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait rejeter une requête sans authentification', async () => {
      const response = await request(app)
        .delete(`/api/rides/${createdRideId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});
