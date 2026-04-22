import { Router } from 'express';
import { getProfile, updateMotorcycle, getStatistics } from '../controllers/userController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Routes protégées : nécessitent un token JWT valide
router.get('/profile', authenticate, getProfile);
router.put('/motorcycle', authenticate, updateMotorcycle);
router.get('/statistics', authenticate, getStatistics);

export default router;