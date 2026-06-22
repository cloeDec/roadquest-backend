import { Request, Response } from 'express';
import * as achievementService from '../services/achievementService';

export const getAllAchievementsHandler = async (req: Request, res: Response) => {
  try {
    const achievements = await achievementService.getAllAchievements();
    res.status(200).json({ achievements });
  } catch (error) {
    console.error('Erreur lors de la récupération des achievements:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des achievements' });
  }
};

export const getUserAchievementsHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const achievements = await achievementService.getUserAchievements(userId);
    res.status(200).json({ achievements });
  } catch (error) {
    console.error('Erreur lors de la récupération des achievements utilisateur:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des achievements' });
  }
};

export const getAchievementStatsHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const stats = await achievementService.getAchievementStats(userId);
    res.status(200).json(stats);
  } catch (error) {
    console.error('Erreur lors de la récupération des stats achievements:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
};
