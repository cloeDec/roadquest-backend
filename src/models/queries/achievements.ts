import { pool } from '../../config/database';

/**
 * NOTE IMPORTANTE :
 * La migration 004_add_rpg_system_v2.sql ajoute des colonnes (achievement_key,
 * badge_icon, category, requirement_type, requirement_value) et une vue qui
 * référence des colonnes inexistantes (rides.status, rides.distance_km,
 * poi_visits) sur le schéma réellement généré par Looping. Comme ce fichier
 * SQL est exécuté en une seule transaction implicite, il est probable que
 * cette migration n'ait jamais été appliquée avec succès.
 *
 * Pour ne pas dépendre de cette incertitude, ce repository s'appuie
 * uniquement sur les colonnes garanties par database/create_tables_from_looping.sql
 * (achievement_id, name, description, icon_url, xp_reward, condition_type,
 * condition_value, rarity) et les "alias" vers les noms attendus par
 * l'interface Achievement du store mobile (achievementsSlice.ts).
 *
 * Si tu confirmes que 004_add_rpg_system_v2.sql a bien tourné chez toi
 * (colonnes category/requirement_type présentes), on pourra basculer sur les
 * vraies colonnes dédiées plutôt que sur ces alias.
 */

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

/**
 * Tous les achievements disponibles dans le jeu
 */
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

/**
 * Achievements de l'utilisateur connecté, avec progression calculée
 * en fonction de son type de condition (condition_type) :
 *  - 'distance' : total_distance de l'utilisateur
 *  - 'rides'    : total_rides de l'utilisateur
 *  - 'pois'     : nombre de POI visités
 * Tout autre type retombe sur la table user_achievements (progress stocké).
 */
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

/**
 * Vérifie les conditions et débloque automatiquement les achievements
 * nouvellement atteints pour un utilisateur (appelé après une sortie ou
 * une visite de POI). Retourne la liste des achievements nouvellement
 * débloqués (pour notification côté mobile).
 */
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

/**
 * Statistiques globales de progression des achievements pour un utilisateur
 */
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
