import { Request, Response } from 'express';
import * as userService from '../services/userService';

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const profile = await userService.getProfile(userId);

    res.json({ user: profile });
  } catch (error) {
    if (error instanceof userService.NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateMotorcycle = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const motorcycle = await userService.updateMotorcycle(userId, req.body);

    res.json({
      message: 'Motorcycle information updated successfully',
      motorcycle,
    });
  } catch (error) {
    if (error instanceof userService.ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof userService.NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Update motorcycle error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStatistics = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const stats = await userService.getStatistics(userId);

    res.json({ statistics: stats });
  } catch (error) {
    if (error instanceof userService.NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get statistics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
