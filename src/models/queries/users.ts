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
  created_at: Date;
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
           total_distance, total_rides, created_at
    FROM users 
    WHERE user_id = $1
  `;
  const result = await pool.query(query, [userId]);
  return result.rows[0] || null;
};

export const verifyPassword = async (
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(plainPassword, hashedPassword);
};