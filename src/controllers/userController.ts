import { Request, Response } from 'express';
import { findUserById, getUserStatistics, updateUserMotorcycle } from '../models/queries/users';

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const user = await findUserById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Récupérer les statistiques complètes
    const stats = await getUserStatistics(userId);

    res.json({
      user: {
        user_id: user.user_id,
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url,
        xp: user.xp,
        level: user.level,
        motorcycle: user.motorcycle_brand ? {
          brand: user.motorcycle_brand,
          model: user.motorcycle_model,
          year: user.motorcycle_year,
          photo_url: user.motorcycle_photo_url,
        } : undefined,
        total_distance: stats?.total_distance || 0,
        total_trips: stats?.total_trips || 0,
        regions_explored: stats?.regions_explored || 0,
        // NOUVEAU : auparavant absent d'ici, ce qui forçait le mobile à
        // figer cette valeur à 12 pour tout utilisateur connecté.
        pois_discovered: stats?.pois_discovered || 0,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateMotorcycle = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { brand, model, year, photo_url } = req.body;

    if (!brand || !model || !year) {
      return res.status(400).json({
        error: 'Missing required fields: brand, model, year'
      });
    }

    if (year < 1900 || year > new Date().getFullYear() + 1) {
      return res.status(400).json({
        error: 'Invalid year'
      });
    }

    const success = await updateUserMotorcycle(
      userId,
      brand,
      model,
      year,
      photo_url
    );

    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Motorcycle information updated successfully',
      motorcycle: {
        brand,
        model,
        year,
        photo_url,
      },
    });
  } catch (error) {
    console.error('Update motorcycle error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStatistics = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const stats = await getUserStatistics(userId);

    if (!stats) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ statistics: stats });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
