import { Request, Response } from 'express';
import * as poiService from '../services/poiService';

export const getAllPOIsHandler = async (req: Request, res: Response) => {
  try {
    const pois = await poiService.getAllPOIs();

    res.status(200).json({
      count: pois.length,
      pois
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des POIs:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des POIs' });
  }
};

export const getNearbyPOIsHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    const parsed = poiService.validateAndParseNearbyInput({
      latitude: req.query.latitude as string | undefined,
      longitude: req.query.longitude as string | undefined,
      radius: req.query.radius as string | undefined
    });

    const result = await poiService.getNearbyPOIs(
      parsed.lat,
      parsed.lon,
      parsed.radiusMeters,
      userId
    );

    res.status(200).json({
      count: result.pois.length,
      center: result.center,
      radius_meters: result.radius_meters,
      pois: result.pois
    });
  } catch (error) {
    if (error instanceof poiService.ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erreur lors de la récupération des POIs à proximité:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des POIs' });
  }
};

export const markPOIAsVisitedHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const { poiId, rideId } = req.body;

    const result = await poiService.markPOIAsVisited(userId, poiId, rideId);

    res.status(200).json({
      message: 'POI marqué comme visité avec succès',
      poi_id: result.poi_id,
      ride_id: result.ride_id,
      unlocked_achievements: result.unlocked_achievements
    });
  } catch (error) {
    if (error instanceof poiService.ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof poiService.NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Erreur lors du marquage du POI:', error);
    res.status(500).json({ error: 'Erreur lors du marquage du POI' });
  }
};

export const getVisitedPOIsHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const pois = await poiService.getVisitedPOIs(userId);

    res.status(200).json({
      count: pois.length,
      pois
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des POIs visités:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des POIs visités' });
  }
};

export const createPOIHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    const poi = await poiService.createPOI(req.body, userId);

    res.status(201).json({
      message: 'POI créé avec succès',
      poi
    });
  } catch (error) {
    if (error instanceof poiService.ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erreur lors de la création du POI:', error);
    res.status(500).json({ error: 'Erreur lors de la création du POI' });
  }
};
