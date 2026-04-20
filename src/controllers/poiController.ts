import { Request, Response } from 'express';
import {
  getAllPOIs,
  getNearbyPOIs,
  markPOIAsVisited,
  getVisitedPOIs,
  createPOI
} from '../models/queries/pois';

/**
 * Récupérer tous les POIs
 */
export const getAllPOIsHandler = async (req: Request, res: Response) => {
  try {
    const pois = await getAllPOIs();

    res.status(200).json({
      count: pois.length,
      pois
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des POIs:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des POIs' });
  }
};

/**
 * Récupérer les POIs à proximité d'une position
 */
export const getNearbyPOIsHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { latitude, longitude, radius } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'latitude et longitude sont requis'
      });
    }

    const lat = parseFloat(latitude as string);
    const lon = parseFloat(longitude as string);
    const radiusMeters = radius ? parseFloat(radius as string) : 50000;

    if (isNaN(lat) || isNaN(lon) || isNaN(radiusMeters)) {
      return res.status(400).json({
        error: 'latitude, longitude et radius doivent être des nombres valides'
      });
    }

    const pois = await getNearbyPOIs(lat, lon, radiusMeters, userId);

    res.status(200).json({
      count: pois.length,
      center: { latitude: lat, longitude: lon },
      radius_meters: radiusMeters,
      pois
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des POIs à proximité:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des POIs' });
  }
};

/**
 * Marquer un POI comme visité
 */
export const markPOIAsVisitedHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const { poiId, rideId } = req.body;

    if (!poiId || !rideId) {
      return res.status(400).json({
        error: 'poiId et rideId sont requis'
      });
    }

    const success = await markPOIAsVisited(userId, poiId, rideId);

    if (!success) {
      return res.status(404).json({
        error: 'POI ou trajet non trouvé, ou trajet non associé à cet utilisateur'
      });
    }

    res.status(200).json({
      message: 'POI marqué comme visité avec succès',
      poi_id: poiId,
      ride_id: rideId
    });
  } catch (error) {
    console.error('Erreur lors du marquage du POI:', error);
    res.status(500).json({ error: 'Erreur lors du marquage du POI' });
  }
};

/**
 * Récupérer les POIs visités par l'utilisateur
 */
export const getVisitedPOIsHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const pois = await getVisitedPOIs(userId);

    res.status(200).json({
      count: pois.length,
      pois
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des POIs visités:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des POIs visités' });
  }
};

/**
 * Créer un nouveau POI
 */
export const createPOIHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const {
      name,
      type,
      description,
      latitude,
      longitude,
      rating,
      image_url
    } = req.body;

    // Validation des données requises
    if (!name || !type || !description || !latitude || !longitude) {
      return res.status(400).json({
        error: 'name, type, description, latitude et longitude sont requis'
      });
    }

    // Validation du type
    const validTypes = ['col', 'route_panoramique', 'virage', 'spot_photo', 'monument', 'autre'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `type doit être l'un de: ${validTypes.join(', ')}`
      });
    }

    // Validation des coordonnées
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({
        error: 'latitude et longitude doivent être des coordonnées valides'
      });
    }

    // Validation du rating
    const ratingValue = rating !== undefined ? parseFloat(rating) : 3.0;
    if (isNaN(ratingValue) || ratingValue < 0 || ratingValue > 5) {
      return res.status(400).json({
        error: 'rating doit être un nombre entre 0 et 5'
      });
    }

    const poi = await createPOI(
      name,
      type,
      description,
      lat,
      lon,
      ratingValue,
      image_url,
      userId
    );

    res.status(201).json({
      message: 'POI créé avec succès',
      poi
    });
  } catch (error) {
    console.error('Erreur lors de la création du POI:', error);
    res.status(500).json({ error: 'Erreur lors de la création du POI' });
  }
};
