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
 * @route   GET /api/pois
 * @desc    Récupérer tous les POIs
 * @access  Public
 */
router.get('/', getAllPOIsHandler);

/**
 * @route   GET /api/pois/nearby
 * @desc    Récupérer les POIs à proximité
 * @query   latitude, longitude, radius (optionnel, défaut 50km)
 * @access  Public (mais retourne les POIs visités si authentifié)
 */
router.get('/nearby', getNearbyPOIsHandler);

/**
 * @route   GET /api/pois/visited
 * @desc    Récupérer les POIs visités par l'utilisateur
 * @access  Private
 */
router.get('/visited', authenticate, getVisitedPOIsHandler);

/**
 * @route   POST /api/pois
 * @desc    Créer un nouveau POI
 * @access  Private
 */
router.post('/', authenticate, createPOIHandler);

/**
 * @route   POST /api/pois/:poiId/visit
 * @desc    Marquer un POI comme visité
 * @access  Private
 */
router.post('/:poiId/visit', authenticate, markPOIAsVisitedHandler);

export default router;
