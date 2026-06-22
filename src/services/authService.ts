import * as userRepository from '../repositories/userRepository';
import { generateToken } from '../utils/jwt';
import { revokeToken } from '../utils/tokenBlacklist';
import { User } from '../repositories/userRepository';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  public remainingAttempts?: number;

  constructor(message: string, remainingAttempts?: number) {
    super(message);
    this.name = 'AuthenticationError';
    this.remainingAttempts = remainingAttempts;
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends Error {
  public remainingTime: number;

  constructor(message: string, remainingTime: number) {
    super(message);
    this.name = 'RateLimitError';
    this.remainingTime = remainingTime;
  }
}

const loginAttempts: Map<string, { attempts: number; lockUntil: number }> = new Map();
const ipAttempts: Map<string, { attempts: number; lockUntil: number }> = new Map();

const MAX_LOGIN_ATTEMPTS = 10;
const MAX_IP_ATTEMPTS = 20;
const LOCK_TIME = 15 * 60 * 1000;

export const isAccountLocked = (email: string): { locked: boolean; remainingTime?: number } => {
  const record = loginAttempts.get(email);
  if (!record) return { locked: false };

  if (record.lockUntil && Date.now() > record.lockUntil) {
    loginAttempts.delete(email);
    return { locked: false };
  }

  if (record.attempts >= MAX_LOGIN_ATTEMPTS && record.lockUntil) {
    const remainingTime = Math.ceil((record.lockUntil - Date.now()) / 1000 / 60);
    return { locked: true, remainingTime };
  }

  return { locked: false };
};

export const isIpLocked = (ip: string): { locked: boolean; remainingTime?: number } => {
  const record = ipAttempts.get(ip);
  if (!record) return { locked: false };

  if (record.lockUntil && Date.now() > record.lockUntil) {
    ipAttempts.delete(ip);
    return { locked: false };
  }

  if (record.attempts >= MAX_IP_ATTEMPTS && record.lockUntil) {
    const remainingTime = Math.ceil((record.lockUntil - Date.now()) / 1000 / 60);
    return { locked: true, remainingTime };
  }

  return { locked: false };
};

export const recordFailedAttempt = (email: string): number => {
  const record = loginAttempts.get(email) || { attempts: 0, lockUntil: 0 };
  record.attempts += 1;

  if (record.attempts >= MAX_LOGIN_ATTEMPTS) {
    record.lockUntil = Date.now() + LOCK_TIME;
  }

  loginAttempts.set(email, record);
  return MAX_LOGIN_ATTEMPTS - record.attempts;
};

export const recordFailedIpAttempt = (ip: string): number => {
  const record = ipAttempts.get(ip) || { attempts: 0, lockUntil: 0 };
  record.attempts += 1;

  if (record.attempts >= MAX_IP_ATTEMPTS) {
    record.lockUntil = Date.now() + LOCK_TIME;
  }

  ipAttempts.set(ip, record);
  return MAX_IP_ATTEMPTS - record.attempts;
};

export const resetAttempts = (email: string): void => {
  loginAttempts.delete(email);
};

export interface RegisterInput {
  email: string;
  password: string;
  username: string;
}

export interface AuthResult {
  user: {
    user_id: string;
    email: string;
    username: string;
    xp: number;
    level: number;
  };
  token: string;
}

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const register = async (input: RegisterInput): Promise<AuthResult> => {
  const { email, password, username } = input;

  if (!email || !password || !username) {
    throw new ValidationError('Email, password and username are required');
  }

  if (!validateEmail(email)) {
    throw new ValidationError('Invalid email format');
  }

  if (password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters long');
  }

  const existingUser = await userRepository.findUserByEmail(email);
  if (existingUser) {
    throw new ConflictError('Email already registered');
  }

  const hashedPassword = await userRepository.hashPassword(password);
  const user = await userRepository.createUser(email, hashedPassword, username);

  const token = generateToken({
    userId: user.user_id,
    email: user.email,
  });

  return {
    user: {
      user_id: user.user_id,
      email: user.email,
      username: user.username,
      xp: user.xp,
      level: user.level,
    },
    token,
  };
};

export interface LoginInput {
  email: string;
  password: string;
  clientIp: string;
}

export const login = async (input: LoginInput): Promise<AuthResult> => {
  const { email, password, clientIp } = input;

  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }

  const ipLockStatus = isIpLocked(clientIp);
  if (ipLockStatus.locked) {
    throw new RateLimitError(
      `Trop de tentatives depuis cette adresse. Réessayez dans ${ipLockStatus.remainingTime} minutes.`,
      ipLockStatus.remainingTime!
    );
  }

  const lockStatus = isAccountLocked(email);
  if (lockStatus.locked) {
    throw new RateLimitError(
      `Compte temporairement bloqué. Réessayez dans ${lockStatus.remainingTime} minutes.`,
      lockStatus.remainingTime!
    );
  }

  const user = await userRepository.findUserByEmail(email);
  if (!user) {
    const remainingAttempts = recordFailedAttempt(email);
    recordFailedIpAttempt(clientIp);

    if (remainingAttempts <= 0) {
      throw new RateLimitError(
        'Compte bloqué pendant 15 minutes suite à trop de tentatives échouées.',
        15
      );
    }

    throw new AuthenticationError('Invalid credentials', remainingAttempts);
  }

  const isValidPassword = await userRepository.verifyPassword(password, user.password);
  if (!isValidPassword) {
    const remainingAttempts = recordFailedAttempt(email);
    recordFailedIpAttempt(clientIp);

    if (remainingAttempts <= 0) {
      throw new RateLimitError(
        'Compte bloqué pendant 15 minutes suite à trop de tentatives échouées.',
        15
      );
    }

    throw new AuthenticationError('Invalid credentials', remainingAttempts);
  }

  resetAttempts(email);

  const token = generateToken({
    userId: user.user_id,
    email: user.email,
  });

  return {
    user: {
      user_id: user.user_id,
      email: user.email,
      username: user.username,
      xp: user.xp,
      level: user.level,
    },
    token,
  };
};

export const logout = (token?: string): void => {
  if (token) {
    revokeToken(token);
  }
};
