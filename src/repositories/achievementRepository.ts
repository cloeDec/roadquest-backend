import { pool } from '../config/database';

export interface AchievementRow {
  achievement_id: string;
  achievement_key: string;
  name: string;
  description: string;
  xp_reward: number;
  badge_icon: string;
  category: string;
  requirement_type: string;
  requirement_value: number;
  rarity: string;
}

export interface UserAchievementRow extends AchievementRow {
  unlocked_at: string | null;
  progress: number;
  is_unlocked: boolean;
}

export const getAllAchievements = async (): Promise<AchievementRow[]> => {
  const query = `
    SELECT
      achievement_id,
      achievement_id::text as achievement_key,
      name,
      description,
      xp_reward,
      icon_url as badge_icon,
      'general' as category,
      condition_type as requirement_type,
      condition_value as requirement_value,
      rarity
    FROM achievements
    ORDER BY
      CASE rarity
        WHEN 'bronze' THEN 1
        WHEN 'silver' THEN 2
        WHEN 'gold' THEN 3
        WHEN 'platinum' THEN 4
        ELSE 5
      END,
      condition_value ASC
  `;

  const result = await pool.query(query);
  return result.rows;
};

export const getUserAchievementsWithProgress = async (
  userId: string
): Promise<UserAchievementRow[]> => {
  const query = `
    WITH user_stats AS (
      SELECT
        u.total_distance,
        u.total_rides,
        (SELECT COUNT(*) FROM ride_poi rp
          INNER JOIN rides r ON rp.ride_id = r.ride_id
          WHERE r.user_id = u.user_id) as pois_visited
      FROM users u
      WHERE u.user_id = $1
    )
    SELECT
      a.achievement_id,
      a.achievement_id::text as achievement_key,
      a.name,
      a.description,
      a.xp_reward,
      a.icon_url as badge_icon,
      'general' as category,
      a.condition_type as requirement_type,
      a.condition_value as requirement_value,
      a.rarity,
      ua.unlocked_at,
      CASE
        WHEN ua.unlocked_at IS NOT NULL THEN a.condition_value
        WHEN a.condition_type = 'distance' THEN LEAST(user_stats.total_distance, a.condition_value)
        WHEN a.condition_type = 'rides' THEN LEAST(user_stats.total_rides, a.condition_value)
        WHEN a.condition_type = 'pois' THEN LEAST(user_stats.pois_visited, a.condition_value)
        ELSE COALESCE(ua.progress, 0)
      END as progress,
      (ua.unlocked_at IS NOT NULL) as is_unlocked
    FROM achievements a
    CROSS JOIN user_stats
    LEFT JOIN user_achievements ua
      ON ua.achievement_id = a.achievement_id AND ua.user_id = $1
    ORDER BY is_unlocked DESC, progress DESC
  `;

  const result = await pool.query(query, [userId]);
  return result.rows;
};

export const checkAndUnlockAchievements = async (
  userId: string
): Promise<AchievementRow[]> => {
  const query = `
    WITH user_stats AS (
      SELECT
        u.total_distance,
        u.total_rides,
        (SELECT COUNT(*) FROM ride_poi rp
          INNER JOIN rides r ON rp.ride_id = r.ride_id
          WHERE r.user_id = u.user_id) as pois_visited
      FROM users u
      WHERE u.user_id = $1
    ),
    newly_unlocked AS (
      SELECT a.achievement_id, a.xp_reward
      FROM achievements a
      CROSS JOIN user_stats
      WHERE a.achievement_id NOT IN (
        SELECT achievement_id FROM user_achievements WHERE user_id = $1
      )
      AND (
        (a.condition_type = 'distance' AND user_stats.total_distance >= a.condition_value) OR
        (a.condition_type = 'rides' AND user_stats.total_rides >= a.condition_value) OR
        (a.condition_type = 'pois' AND user_stats.pois_visited >= a.condition_value)
      )
    ),
    inserted AS (
      INSERT INTO user_achievements (user_id, achievement_id, progress)
      SELECT $1, achievement_id, 100 FROM newly_unlocked
      RETURNING achievement_id
    ),
    xp_credited AS (
      UPDATE users SET xp = xp + (SELECT COALESCE(SUM(xp_reward), 0) FROM newly_unlocked)
      WHERE user_id = $1 AND EXISTS (SELECT 1 FROM newly_unlocked)
      RETURNING user_id
    )
    SELECT
      a.achievement_id,
      a.achievement_id::text as achievement_key,
      a.name,
      a.description,
      a.xp_reward,
      a.icon_url as badge_icon,
      'general' as category,
      a.condition_type as requirement_type,
      a.condition_value as requirement_value,
      a.rarity
    FROM achievements a
    INNER JOIN inserted i ON i.achievement_id = a.achievement_id
  `;

  const result = await pool.query(query, [userId]);
  return result.rows;
};

export const getAchievementStats = async (userId: string) => {
  const query = `
    SELECT
      COUNT(*)::int as total,
      COUNT(ua.unlocked_at)::int as unlocked
    FROM achievements a
    LEFT JOIN user_achievements ua
      ON ua.achievement_id = a.achievement_id AND ua.user_id = $1
  `;
  const result = await pool.query(query, [userId]);
  const row = result.rows[0];
  const total = row?.total || 0;
  const unlocked = row?.unlocked || 0;

  return {
    total,
    unlocked,
    progress_percentage: total > 0 ? Math.round((unlocked / total) * 100) : 0,
  };
};
