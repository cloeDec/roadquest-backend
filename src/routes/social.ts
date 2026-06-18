import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middlewares/auth';
import {
  getFeedHandler,
  createPostHandler,
  toggleLikeHandler,
  getCommentsHandler,
  addCommentHandler,
  followUserHandler,
  unfollowUserHandler,
  getPublicProfileHandler,
  getSharedRoutesHandler,
} from '../controllers/socialController';

const router = Router();

/**
 * @swagger
 * /api/social/feed:
 *   get:
 *     summary: Fil d'actualité des trajets partagés
 *     tags: [Social]
 *     responses:
 *       200:
 *         description: Liste des publications, des plus récentes aux plus anciennes
 */
router.get('/feed', optionalAuthenticate, getFeedHandler);

/**
 * @swagger
 * /api/social/posts:
 *   post:
 *     summary: Partager un trajet sur le fil d'actualité
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
router.post('/posts', authenticate, createPostHandler);

/**
 * @swagger
 * /api/social/posts/{postId}/like:
 *   post:
 *     summary: Liker / unliker une publication (toggle)
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
router.post('/posts/:postId/like', authenticate, toggleLikeHandler);

/**
 * @swagger
 * /api/social/posts/{postId}/comments:
 *   get:
 *     summary: Lister les commentaires d'une publication
 *     tags: [Social]
 */
router.get('/posts/:postId/comments', getCommentsHandler);

/**
 * @swagger
 * /api/social/posts/{postId}/comments:
 *   post:
 *     summary: Ajouter un commentaire à une publication
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
router.post('/posts/:postId/comments', authenticate, addCommentHandler);

/**
 * @swagger
 * /api/social/users/{userId}/follow:
 *   post:
 *     summary: Suivre un utilisateur
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
router.post('/users/:userId/follow', authenticate, followUserHandler);

/**
 * @swagger
 * /api/social/users/{userId}/follow:
 *   delete:
 *     summary: Ne plus suivre un utilisateur
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/users/:userId/follow', authenticate, unfollowUserHandler);

/**
 * @swagger
 * /api/social/users/{userId}:
 *   get:
 *     summary: Profil public d'un utilisateur (stats, follow status, trajets récents)
 *     tags: [Social]
 */
router.get('/users/:userId', optionalAuthenticate, getPublicProfileHandler);

/**
 * @swagger
 * /api/social/routes:
 *   get:
 *     summary: Routes partagées par la communauté
 *     tags: [Social]
 */
router.get('/routes', getSharedRoutesHandler);

export default router;
