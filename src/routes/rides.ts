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
 * @route   POST /api/rides
 * @desc    Créer un nouveau trajet
 * @access  Private
 */
router.post('/', authenticate, createRideHandler);

/**
 * @route   GET /api/rides
 * @desc    Récupérer tous les trajets de l'utilisateur
 * @access  Private
 */
router.get('/', authenticate, getUserRidesHandler);

/**
 * @route   GET /api/rides/:rideId
 * @desc    Récupérer un trajet spécifique
 * @access  Private
 */
router.get('/:rideId', authenticate, getRideHandler);

/**
 * @route   DELETE /api/rides/:rideId
 * @desc    Supprimer un trajet
 * @access  Private
 */
router.delete('/:rideId', authenticate, deleteRideHandler);

export default router;
