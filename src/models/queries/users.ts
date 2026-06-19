import { pool } from '../../config/database';
import bcrypt from 'bcrypt';

export interface User {
  user_id: string;
  email: string;
  username: string;
  avatar_url?: string;
  xp: number;
  level: number;
  total_distance: number;
  total_rides: number;
  motorcycle_brand?: string;
  motorcycle_model?: string;
  motorcycle_year?: number;
  motorcycle_photo_url?: string;
  created_at: Date;
}

export interface UserStatistics {
  total_trips: number;
  total_distance: number;
  pois_discovered: number;
  achievements_unlocked: number;
  regions_explored: number;
}

export const createUser = async (
  email: string,
  password: string,
  username: string
): Promise<User> => {
  const hashedPassword = await bcrypt.hash(password, 10);

  const query = `
    INSERT INTO users (email, password, username)
    VALUES ($1, $2, $3)
    RETURNING user_id, email, username, avatar_url, xp, level,
              total_distance, total_rides, created_at
  `;

  const result = await pool.query(query, [email, hashedPassword, username]);
  return result.rows[0];
};

export const findUserByEmail = async (email: string): Promise<any | null> => {
  const query = 'SELECT * FROM users WHERE email = $1';
  const result = await pool.query(query, [email]);
  return result.rows[0] || null;
};

export const findUserById = async (userId: string): Promise<User | null> => {
  const query = `
    SELECT user_id, email, username, avatar_url, xp, level,
           total_distance, total_rides, created_at,
           motorcycle_brand, motorcycle_model, motorcycle_year, motorcycle_photo_url
    FROM users
    WHERE user_id = $1
  `;
  const result = await pool.query(query, [userId]);
  return result.rows[0] || null;
};

export const getUserStatistics = async (userId: string): Promise<UserStatistics | null> => {
  // Note : on s'appuie sur les colonnes réelles du schéma (rides.distance,
  // table ride_poi) et non sur distance_km / visited_pois qui n'existent pas.
  // Les POI visités se comptent en remontant ride_poi -> rides (l'utilisateur
  // propriétaire du trajet), car ride_poi n'a pas de colonne user_id directe.
  const query = `
    SELECT
      COALESCE(COUNT(DISTINCT r.ride_id), 0)::int as total_trips,
      COALESCE(ROUND(SUM(r.distance)::numeric, 2), 0)::float as total_distance,
      COALESCE((
        SELECT COUNT(DISTINCT rp.poi_id)
        FROM ride_poi rp
        INNER JOIN rides r2 ON rp.ride_id = r2.ride_id
        WHERE r2.user_id = $1
      ), 0)::int as pois_discovered,
      COALESCE((
        SELECT COUNT(*)
        FROM user_achievements ua
        WHERE ua.user_id = $1 AND ua.unlocked_at IS NOT NULL
      ), 0)::int as achievements_unlocked,
      0::int as regions_explored
    FROM users u
    LEFT JOIN rides r ON u.user_id = r.user_id
    WHERE u.user_id = $1
    GROUP BY u.user_id
  `;
  const result = await pool.query(query, [userId]);
  return result.rows[0] || null;
};

export const updateUserMotorcycle = async (
  userId: string,
  brand: string,
  model: string,
  year: number,
  photoUrl?: string
): Promise<boolean> => {
  const query = `
    UPDATE users
    SET
      motorcycle_brand = $2,
      motorcycle_model = $3,
      motorcycle_year = $4,
      motorcycle_photo_url = $5,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
  `;
  const result = await pool.query(query, [userId, brand, model, year, photoUrl]);
  return result.rowCount ? result.rowCount > 0 : false;
};

export const verifyPassword = async (
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(plainPassword, hashedPassword);
};
