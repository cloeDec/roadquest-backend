import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  getAllAchievementsHandler,
  getUserAchievementsHandler,
  getAchievementStatsHandler,
} from '../controllers/achievementsController';

const router = Router();

/**
 * @swagger
 * /api/achievements:
 *   get:
 *     summary: Liste de tous les achievements disponibles
 *     tags: [Achievements]
 *     responses:
 *       200:
 *         description: Catalogue des achievements
 */
router.get('/', getAllAchievementsHandler);

/**
 * @swagger
 * /api/achievements/user:
 *   get:
 *     summary: Achievements de l'utilisateur connecté avec progression
 *     tags: [Achievements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Achievements avec progression et statut de déblocage
 *       401:
 *         description: Non authentifié
 */
router.get('/user', authenticate, getUserAchievementsHandler);

/**
 * @swagger
 * /api/achievements/stats:
 *   get:
 *     summary: Statistiques de progression des achievements
 *     tags: [Achievements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Total, débloqués et pourcentage de progression
 *       401:
 *         description: Non authentifié
 */
router.get('/stats', authenticate, getAchievementStatsHandler);

export default router;
