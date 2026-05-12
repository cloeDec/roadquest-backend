import express from 'express';
import {
  getAllPOIsHandler,
  getNearbyPOIsHandler,
  markPOIAsVisitedHandler,
  getVisitedPOIsHandler,
  createPOIHandler
} from '../controllers/poiController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

/**
 * @swagger
 * /api/pois:
 *   get:
 *     summary: Récupérer tous les POIs
 *     tags: [POIs]
 *     responses:
 *       200:
 *         description: Liste des POIs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                 pois:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/POI'
 */
router.get('/', getAllPOIsHandler);

/**
 * @swagger
 * /api/pois/nearby:
 *   get:
 *     summary: Récupérer les POIs à proximité
 *     tags: [POIs]
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 50000
 *         description: Rayon de recherche en mètres (défaut 50km)
 *     responses:
 *       200:
 *         description: Liste des POIs à proximité
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                 center:
 *                   type: object
 *                   properties:
 *                     latitude:
 *                       type: number
 *                     longitude:
 *                       type: number
 *                 radius_meters:
 *                   type: number
 *                 pois:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/POI'
 *       400:
 *         description: Paramètres invalides
 */
router.get('/nearby', getNearbyPOIsHandler);

/**
 * @swagger
 * /api/pois/visited:
 *   get:
 *     summary: Récupérer les POIs visités par l'utilisateur
 *     tags: [POIs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des POIs visités
 *       401:
 *         description: Non authentifié
 */
router.get('/visited', authenticate, getVisitedPOIsHandler);

/**
 * @swagger
 * /api/pois:
 *   post:
 *     summary: Créer un nouveau POI
 *     tags: [POIs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - description
 *               - latitude
 *               - longitude
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [col, route_panoramique, virage, spot_photo, monument, autre]
 *               description:
 *                 type: string
 *               latitude:
 *                 type: number
 *                 minimum: -90
 *                 maximum: 90
 *               longitude:
 *                 type: number
 *                 minimum: -180
 *                 maximum: 180
 *               rating:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 5
 *               image_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: POI créé avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non authentifié
 */
router.post('/', authenticate, createPOIHandler);

/**
 * @swagger
 * /api/pois/{poiId}/visit:
 *   post:
 *     summary: Marquer un POI comme visité
 *     tags: [POIs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: poiId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rideId
 *             properties:
 *               rideId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: POI marqué comme visité
 *       401:
 *         description: Non authentifié
 *       404:
 *         description: POI ou trajet non trouvé
 */
router.post('/:poiId/visit', authenticate, markPOIAsVisitedHandler);

export default router;
