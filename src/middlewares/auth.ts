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

/**
 * NOUVEAU : variant non bloquant de authenticate, pour les routes publiques
 * dont le contenu peut être personnalisé si l'utilisateur est connecté
 * (ex : fil social affichant is_liked, profil public affichant is_following).
 * Si le token est absent ou invalide, la requête continue simplement sans
 * req.userId, plutôt que d'être rejetée avec un 401.
 */
export const optionalAuthenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      req.userId = decoded.userId;
      req.userEmail = decoded.email;
    }
  } catch (error) {
    // Token invalide : on ignore et on continue sans utilisateur authentifié
  }

  next();
};
