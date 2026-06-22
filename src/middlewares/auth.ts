import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { isTokenRevoked } from '../utils/tokenBlacklist';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      token?: string;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    if (isTokenRevoked(token)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    const decoded = verifyToken(token);

    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.token = token;

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
