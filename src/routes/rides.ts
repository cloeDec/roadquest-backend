import express from 'express';
import {
  createRideHandler,
  getUserRidesHandler,
  getRideHandler,
  deleteRideHandler
} from '../controllers/rideController';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

/**
 * @swagger
 * /api/rides:
 *   post:
 *     summary: Créer un nouveau trajet
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - start_location
 *               - route
 *               - distance
 *               - duration
 *             properties:
 *               start_location:
 *                 type: object
 *                 properties:
 *                   latitude:
 *                     type: number
 *                   longitude:
 *                     type: number
 *               end_location:
 *                 type: object
 *                 properties:
 *                   latitude:
 *                     type: number
 *                   longitude:
 *                     type: number
 *               route:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     latitude:
 *                       type: number
 *                     longitude:
 *                       type: number
 *                     timestamp:
 *                       type: number
 *               distance:
 *                 type: number
 *               duration:
 *                 type: integer
 *               avg_speed:
 *                 type: number
 *               destination_name:
 *                 type: string
 *               is_public:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Trajet créé avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non authentifié
 */
router.post('/', authenticate, createRideHandler);

/**
 * @swagger
 * /api/rides:
 *   get:
 *     summary: Récupérer tous les trajets de l'utilisateur
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des trajets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                 rides:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Ride'
 *       401:
 *         description: Non authentifié
 */
router.get('/', authenticate, getUserRidesHandler);

/**
 * @swagger
 * /api/rides/{rideId}:
 *   get:
 *     summary: Récupérer un trajet spécifique
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Détails du trajet
 *       401:
 *         description: Non authentifié
 *       404:
 *         description: Trajet non trouvé
 */
router.get('/:rideId', authenticate, getRideHandler);

/**
 * @swagger
 * /api/rides/{rideId}:
 *   delete:
 *     summary: Supprimer un trajet
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Trajet supprimé avec succès
 *       401:
 *         description: Non authentifié
 *       404:
 *         description: Trajet non trouvé
 */
router.delete('/:rideId', authenticate, deleteRideHandler);

export default router;
