import { Request, Response } from 'express';
import * as rideService from '../services/rideService';

export const createRideHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const result = await rideService.createRide(userId, req.body);

    res.status(201).json({
      message: 'Trajet créé avec succès',
      ride: result.ride,
      unlocked_achievements: result.unlocked_achievements
    });
  } catch (error) {
    if (error instanceof rideService.ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Erreur lors de la création du trajet:', error);
    res.status(500).json({ error: 'Erreur lors de la création du trajet' });
  }
};

export const getUserRidesHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const rides = await rideService.getUserRides(userId);

    res.status(200).json({
      count: rides.length,
      rides
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des trajets:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des trajets' });
  }
};

export const getRideHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { rideId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    if (!rideId) {
      return res.status(400).json({ error: 'rideId est requis' });
    }

    const ride = await rideService.getRideById(rideId, userId);

    if (!ride) {
      return res.status(404).json({ error: 'Trajet non trouvé' });
    }

    res.status(200).json({ ride });
  } catch (error) {
    console.error('Erreur lors de la récupération du trajet:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du trajet' });
  }
};

export const deleteRideHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { rideId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    if (!rideId) {
      return res.status(400).json({ error: 'rideId est requis' });
    }

    const deleted = await rideService.deleteRide(rideId, userId);

    if (!deleted) {
      return res.status(404).json({ error: 'Trajet non trouvé ou déjà supprimé' });
    }

    res.status(200).json({ message: 'Trajet supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du trajet:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du trajet' });
  }
};
