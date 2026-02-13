import { Request, Response } from 'express';
import { findUserById } from '../models/queries/users';

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!; // Le ! dit à TypeScript que userId existe (garanti par le middleware)

    const user = await findUserById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        user_id: user.user_id,
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url,
        xp: user.xp,
        level: user.level,
        total_distance: user.total_distance,
        total_rides: user.total_rides,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};