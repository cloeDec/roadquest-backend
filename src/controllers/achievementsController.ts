import { Request, Response } from 'express';
import {
  getAllAchievements,
  getUserAchievementsWithProgress,
  getAchievementStats,
} from '../models/queries/achievements';

/**
 * GET /api/achievements
 * Catalogue complet des achievements (pas besoin d'authentification :
 * c'est une donnée statique commune à tous les utilisateurs).
 */
export const getAllAchievementsHandler = async (req: Request, res: Response) => {
  try {
    const achievements = await getAllAchievements();
    res.status(200).json({ achievements });
  } catch (error) {
    console.error('Erreur lors de la récupération des achievements:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des achievements' });
  }
};

/**
 * GET /api/achievements/user
 * Achievements de l'utilisateur connecté, avec progression calculée.
 */
export const getUserAchievementsHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const achievements = await getUserAchievementsWithProgress(userId);
    res.status(200).json({ achievements });
  } catch (error) {
    console.error('Erreur lors de la récupération des achievements utilisateur:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des achievements' });
  }
};

/**
 * GET /api/achievements/stats
 * Statistiques de progression (total / débloqués / pourcentage).
 */
export const getAchievementStatsHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const stats = await getAchievementStats(userId);
    res.status(200).json(stats);
  } catch (error) {
    console.error('Erreur lors de la récupération des stats achievements:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
};
