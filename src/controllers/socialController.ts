import { Request, Response } from 'express';
import {
  getFeed,
  createPost,
  toggleLike,
  getComments,
  addComment,
  followUser,
  unfollowUser,
  getPublicProfile,
  getSharedRoutes,
} from '../models/queries/social';

export const getFeedHandler = async (req: Request, res: Response) => {
  try {
    const posts = await getFeed(req.userId);
    res.status(200).json({ posts });
  } catch (error) {
    console.error('Erreur lors du chargement du feed:', error);
    res.status(500).json({ error: 'Erreur lors du chargement du feed' });
  }
};

export const createPostHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const { ride_id, title, description, photos } = req.body;

    if (!ride_id || !title) {
      return res.status(400).json({ error: 'ride_id et title sont requis' });
    }

    const post = await createPost(userId, ride_id, title, description, photos);

    if (!post) {
      return res.status(404).json({ error: 'Trajet non trouvé ou non associé à cet utilisateur' });
    }

    res.status(201).json({ message: 'Publication créée avec succès', post });
  } catch (error) {
    console.error('Erreur lors de la création de la publication:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la publication' });
  }
};

export const toggleLikeHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { postId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const result = await toggleLike(postId, userId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Erreur lors du like:', error);
    res.status(500).json({ error: 'Erreur lors du like' });
  }
};

export const getCommentsHandler = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const comments = await getComments(postId);
    res.status(200).json({ comments });
  } catch (error) {
    console.error('Erreur lors de la récupération des commentaires:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des commentaires' });
  }
};

export const addCommentHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { postId } = req.params;
    const { content } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }
    if (!content) {
      return res.status(400).json({ error: 'content est requis' });
    }

    const comment = await addComment(postId, userId, content);
    res.status(201).json({ comment });
  } catch (error) {
    console.error("Erreur lors de l'ajout du commentaire:", error);
    res.status(500).json({ error: "Erreur lors de l'ajout du commentaire" });
  }
};

export const followUserHandler = async (req: Request, res: Response) => {
  try {
    const followerId = req.userId;
    const { userId: followingId } = req.params;

    if (!followerId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const success = await followUser(followerId, followingId);
    if (!success) {
      return res.status(400).json({ error: 'Impossible de se suivre soi-même' });
    }

    res.status(200).json({ message: 'Utilisateur suivi avec succès' });
  } catch (error) {
    console.error('Erreur lors du follow:', error);
    res.status(500).json({ error: 'Erreur lors du follow' });
  }
};

export const unfollowUserHandler = async (req: Request, res: Response) => {
  try {
    const followerId = req.userId;
    const { userId: followingId } = req.params;

    if (!followerId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    await unfollowUser(followerId, followingId);
    res.status(200).json({ message: 'Utilisateur non suivi avec succès' });
  } catch (error) {
    console.error('Erreur lors du unfollow:', error);
    res.status(500).json({ error: 'Erreur lors du unfollow' });
  }
};

export const getPublicProfileHandler = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const profile = await getPublicProfile(userId, req.userId);

    if (!profile) {
      return res.status(404).json({ error: 'Profil non trouvé' });
    }

    res.status(200).json({ profile });
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
  }
};

export const getSharedRoutesHandler = async (req: Request, res: Response) => {
  try {
    const routes = await getSharedRoutes();
    res.status(200).json({ routes });
  } catch (error) {
    console.error('Erreur lors de la récupération des routes partagées:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des routes' });
  }
};
