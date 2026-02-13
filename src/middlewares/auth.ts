import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

// Étendre l'interface Request pour ajouter userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Récupérer le token depuis le header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Extraire le token (format: "Bearer TOKEN")
    const token = authHeader.substring(7);

    // Vérifier le token
    const decoded = verifyToken(token);

    // Ajouter userId et email à la requête
    req.userId = decoded.userId;
    req.userEmail = decoded.email;

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};