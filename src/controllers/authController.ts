import { Request, Response } from 'express';
import { createUser, findUserByEmail, verifyPassword } from '../models/queries/users';
import { generateToken } from '../utils/jwt';

// ============================================================
// PROTECTION CONTRE LES ATTAQUES PAR FORCE BRUTE
// ============================================================
// Stocke les tentatives de connexion échouées par email
// Clé: email, Valeur: { attempts: nombre d'essais, lockUntil: date de déblocage }
const loginAttempts: Map<string, { attempts: number; lockUntil: number }> = new Map();

// Stocke les tentatives de connexion échouées par adresse IP
// Protège contre les attaquants qui changent d'email à chaque tentative
const ipAttempts: Map<string, { attempts: number; lockUntil: number }> = new Map();

const MAX_LOGIN_ATTEMPTS = 10;        // Nombre maximum de tentatives par email
const MAX_IP_ATTEMPTS = 20;           // Nombre maximum de tentatives par IP
const LOCK_TIME = 15 * 60 * 1000;     // Durée du blocage: 15 minutes (en millisecondes)

/**
 * Extrait l'adresse IP de la requête (gère les proxys)
 */
const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

/**
 * Vérifie si un compte est bloqué suite à trop de tentatives (par email)
 */
const isAccountLocked = (email: string): { locked: boolean; remainingTime?: number } => {
  const record = loginAttempts.get(email);

  if (!record) {
    return { locked: false };
  }

  // Si le temps de blocage est passé, on réinitialise
  if (record.lockUntil && Date.now() > record.lockUntil) {
    loginAttempts.delete(email);
    return { locked: false };
  }

  // Si on a atteint le max de tentatives et qu'on est encore dans la période de blocage
  if (record.attempts >= MAX_LOGIN_ATTEMPTS && record.lockUntil) {
    const remainingTime = Math.ceil((record.lockUntil - Date.now()) / 1000 / 60); // en minutes
    return { locked: true, remainingTime };
  }

  return { locked: false };
};

/**
 * Vérifie si une adresse IP est bloquée suite à trop de tentatives
 */
const isIpLocked = (ip: string): { locked: boolean; remainingTime?: number } => {
  const record = ipAttempts.get(ip);

  if (!record) {
    return { locked: false };
  }

  // Si le temps de blocage est passé, on réinitialise
  if (record.lockUntil && Date.now() > record.lockUntil) {
    ipAttempts.delete(ip);
    return { locked: false };
  }

  // Si on a atteint le max de tentatives et qu'on est encore dans la période de blocage
  if (record.attempts >= MAX_IP_ATTEMPTS && record.lockUntil) {
    const remainingTime = Math.ceil((record.lockUntil - Date.now()) / 1000 / 60); // en minutes
    return { locked: true, remainingTime };
  }

  return { locked: false };
};

/**
 * Enregistre une tentative de connexion échouée (par email)
 */
const recordFailedAttempt = (email: string): number => {
  const record = loginAttempts.get(email) || { attempts: 0, lockUntil: 0 };
  record.attempts += 1;

  // Si on atteint le maximum, on bloque le compte
  if (record.attempts >= MAX_LOGIN_ATTEMPTS) {
    record.lockUntil = Date.now() + LOCK_TIME;
  }

  loginAttempts.set(email, record);
  return MAX_LOGIN_ATTEMPTS - record.attempts; // Retourne le nombre de tentatives restantes
};

/**
 * Enregistre une tentative de connexion échouée (par IP)
 */
const recordFailedIpAttempt = (ip: string): number => {
  const record = ipAttempts.get(ip) || { attempts: 0, lockUntil: 0 };
  record.attempts += 1;

  // Si on atteint le maximum, on bloque l'IP
  if (record.attempts >= MAX_IP_ATTEMPTS) {
    record.lockUntil = Date.now() + LOCK_TIME;
  }

  ipAttempts.set(ip, record);
  return MAX_IP_ATTEMPTS - record.attempts; // Retourne le nombre de tentatives restantes
};

/**
 * Réinitialise les tentatives après une connexion réussie
 */
const resetAttempts = (email: string): void => {
  loginAttempts.delete(email);
};

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, username } = req.body;

    // Validation
    if (!email || !password || !username) {
      return res.status(400).json({ 
        error: 'Email, password and username are required' 
      });
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Create user
    const user = await createUser(email, password, username);

    // Generate JWT using helper
    const token = generateToken({
      userId: user.user_id,
      email: user.email,
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        user_id: user.user_id,
        email: user.email,
        username: user.username,
        xp: user.xp,
        level: user.level,
      },
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // ============================================================
    // VÉRIFICATION DU BLOCAGE (protection force brute)
    // ============================================================
    const clientIp = getClientIp(req);

    // Vérifier d'abord si l'IP est bloquée
    const ipLockStatus = isIpLocked(clientIp);
    if (ipLockStatus.locked) {
      return res.status(429).json({
        error: `Trop de tentatives depuis cette adresse. Réessayez dans ${ipLockStatus.remainingTime} minutes.`
      });
    }

    // Vérifier si l'email est bloqué
    const lockStatus = isAccountLocked(email);
    if (lockStatus.locked) {
      return res.status(429).json({
        error: `Compte temporairement bloqué. Trop de tentatives échouées. Réessayez dans ${lockStatus.remainingTime} minutes.`
      });
    }

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      // On enregistre la tentative par email ET par IP
      recordFailedAttempt(email);
      recordFailedIpAttempt(clientIp);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      // Enregistrer l'échec par email ET par IP
      const remainingAttempts = recordFailedAttempt(email);
      recordFailedIpAttempt(clientIp);

      if (remainingAttempts <= 0) {
        return res.status(429).json({
          error: `Compte bloqué pendant 15 minutes suite à trop de tentatives échouées.`
        });
      }

      return res.status(401).json({
        error: 'Invalid credentials',
        remainingAttempts: remainingAttempts > 0 ? remainingAttempts : 0
      });
    }

    // ============================================================
    // CONNEXION RÉUSSIE : réinitialiser les tentatives
    // ============================================================
    resetAttempts(email);

    // Generate JWT using helper
    const token = generateToken({
      userId: user.user_id,
      email: user.email,
    });

    res.json({
      message: 'Login successful',
      user: {
        user_id: user.user_id,
        email: user.email,
        username: user.username,
        xp: user.xp,
        level: user.level,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};