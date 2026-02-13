import { Router } from 'express';
import { getProfile } from '../controllers/userController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Route protégée : nécessite un token JWT valide
router.get('/profile', authenticate, getProfile);

export default router;