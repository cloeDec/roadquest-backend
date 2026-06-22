import * as achievementRepository from '../repositories/achievementRepository';
import { AchievementRow, UserAchievementRow } from '../repositories/achievementRepository';

export const getAllAchievements = async (): Promise<AchievementRow[]> => {
  return achievementRepository.getAllAchievements();
};

export const getUserAchievements = async (userId: string): Promise<UserAchievementRow[]> => {
  return achievementRepository.getUserAchievementsWithProgress(userId);
};

export interface AchievementStats {
  total: number;
  unlocked: number;
  progress_percentage: number;
}

export const getAchievementStats = async (userId: string): Promise<AchievementStats> => {
  return achievementRepository.getAchievementStats(userId);
};

export const checkAndUnlockAchievements = async (userId: string): Promise<AchievementRow[]> => {
  return achievementRepository.checkAndUnlockAchievements(userId);
};
