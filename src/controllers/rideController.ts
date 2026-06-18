import { Request, Response } from 'express';
import { createRide, getRidesByUserId, getRideById, deleteRide, CreateRideData } from '../models/queries/rides';
import { checkAndUnlockAchievements } from '../models/queries/achievements';

/**
 * Créer un nouveau trajet
 */
export const createRideHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const {
      start_location,
      end_location,
      route,
      distance,
      duration,
      avg_speed,
      max_speed,
      destination_name,
      is_public
    } = req.body;

    // Validation des données requises
    if (!start_location || !start_location.latitude || !start_location.longitude) {
      return res.status(400).json({ error: 'start_location est requis avec latitude et longitude' });
    }

    if (!route || !Array.isArray(route)) {
      return res.status(400).json({ error: 'route est requis et doit être un tableau' });
    }

    if (typeof distance !== 'number' || distance < 0) {
      return res.status(400).json({ error: 'distance est requis et doit être un nombre positif' });
    }

    if (typeof duration !== 'number' || duration < 0) {
      return res.status(400).json({ error: 'duration est requis et doit être un nombre positif' });
    }

    const rideData: CreateRideData = {
      user_id: userId,
      start_location,
      end_location,
      route,
      distance,
      duration,
      avg_speed,
      max_speed,
      destination_name,
      is_public: is_public !== undefined ? is_public : true
    };

    const ride = await createRide(rideData);

    // NOUVEAU : vérifie si ce trajet débloque un ou plusieurs achievements
    // (distance/nombre de sorties cumulés). Le calcul de l'XP de distance
    // reste géré par le trigger PL/pgSQL ; ceci ne gère que les achievements.
    let unlockedAchievements: Awaited<ReturnType<typeof checkAndUnlockAchievements>> = [];
    try {
      unlockedAchievements = await checkAndUnlockAchievements(userId);
    } catch (achievementError) {
      // Un échec de cette vérification ne doit jamais faire échouer la création du trajet
      console.error('Erreur lors de la vérification des achievements:', achievementError);
    }

    res.status(201).json({
      message: 'Trajet créé avec succès',
      ride,
      unlocked_achievements: unlockedAchievements
    });
  } catch (error) {
    console.error('Erreur lors de la création du trajet:', error);
    res.status(500).json({ error: 'Erreur lors de la création du trajet' });
  }
};

/**
 * Récupérer tous les trajets de l'utilisateur connecté
 */
export const getUserRidesHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const rides = await getRidesByUserId(userId);

    res.status(200).json({
      count: rides.length,
      rides
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des trajets:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des trajets' });
  }
};

/**
 * Récupérer un trajet spécifique
 */
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

    const ride = await getRideById(rideId, userId);

    if (!ride) {
      return res.status(404).json({ error: 'Trajet non trouvé' });
    }

    res.status(200).json({ ride });
  } catch (error) {
    console.error('Erreur lors de la récupération du trajet:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du trajet' });
  }
};

/**
 * Supprimer un trajet
 */
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

    const deleted = await deleteRide(rideId, userId);

    if (!deleted) {
      return res.status(404).json({ error: 'Trajet non trouvé ou déjà supprimé' });
    }

    res.status(200).json({ message: 'Trajet supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du trajet:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du trajet' });
  }
};
