import { Request, Response } from "express";
import { createUser, findUserByEmail, verifyPassword } from "../models/queries/users";
import { generateToken } from "../utils/jwt";

const loginAttempts: Map<string, { attempts: number; lockUntil: number }> = new Map();
const ipAttempts: Map<string, { attempts: number; lockUntil: number }> = new Map();

const MAX_LOGIN_ATTEMPTS = 10;
const MAX_IP_ATTEMPTS = 20;
const LOCK_TIME = 15 * 60 * 1000;

const getClientIp = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
};

const isAccountLocked = (email: string): { locked: boolean; remainingTime?: number } => {
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

const isIpLocked = (ip: string): { locked: boolean; remainingTime?: number } => {
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

const recordFailedAttempt = (email: string): number => {
  const record = loginAttempts.get(email) || { attempts: 0, lockUntil: 0 };
  record.attempts += 1;

  if (record.attempts >= MAX_LOGIN_ATTEMPTS) {
    record.lockUntil = Date.now() + LOCK_TIME;
  }

  loginAttempts.set(email, record);
  return MAX_LOGIN_ATTEMPTS - record.attempts;
};

const recordFailedIpAttempt = (ip: string): number => {
  const record = ipAttempts.get(ip) || { attempts: 0, lockUntil: 0 };
  record.attempts += 1;

  if (record.attempts >= MAX_IP_ATTEMPTS) {
    record.lockUntil = Date.now() + LOCK_TIME;
  }

  ipAttempts.set(ip, record);
  return MAX_IP_ATTEMPTS - record.attempts;
};

const resetAttempts = (email: string): void => {
  loginAttempts.delete(email);
};

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ error: "Email, password and username are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long" });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const user = await createUser(email, password, username);

    const token = generateToken({
      userId: user.user_id,
      email: user.email,
    });

    res.status(201).json({
      message: "User created successfully",
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
    console.error("Register error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const clientIp = getClientIp(req);

    const ipLockStatus = isIpLocked(clientIp);
    if (ipLockStatus.locked) {
      return res.status(429).json({
        error: `Trop de tentatives depuis cette adresse. Réessayez dans ${ipLockStatus.remainingTime} minutes.`,
      });
    }

    const lockStatus = isAccountLocked(email);
    if (lockStatus.locked) {
      return res.status(429).json({
        error: `Compte temporairement bloqué. Réessayez dans ${lockStatus.remainingTime} minutes.`,
      });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      const remainingAttempts = recordFailedAttempt(email);
      recordFailedIpAttempt(clientIp);

      if (remainingAttempts <= 0) {
        return res.status(429).json({
          error: "Compte bloqué pendant 15 minutes suite à trop de tentatives échouées.",
        });
      }

      return res.status(401).json({
        error: "Invalid credentials",
        remainingAttempts: remainingAttempts > 0 ? remainingAttempts : 0,
      });
    }

    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      const remainingAttempts = recordFailedAttempt(email);
      recordFailedIpAttempt(clientIp);

      if (remainingAttempts <= 0) {
        return res.status(429).json({
          error: "Compte bloqué pendant 15 minutes suite à trop de tentatives échouées.",
        });
      }

      return res.status(401).json({
        error: "Invalid credentials",
        remainingAttempts: remainingAttempts > 0 ? remainingAttempts : 0,
      });
    }

    resetAttempts(email);

    const token = generateToken({
      userId: user.user_id,
      email: user.email,
    });

    res.json({
      message: "Login successful",
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
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
