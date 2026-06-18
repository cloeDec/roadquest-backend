import { pool } from '../../config/database';

/**
 * S'appuie sur les tables et vues créées par migrations/006_add_social_system.sql
 * (ride_posts, post_likes, post_comments, user_follows, shared_routes,
 * social_feed, public_profile_stats). Si la table ride_posts n'existe pas
 * encore dans ta base, c'est que cette migration n'a pas encore tourné :
 * lance-la avant de tester ces routes.
 */

export const getFeed = async (currentUserId?: string) => {
  const query = `
    SELECT
      sf.post_id,
      sf.user_id,
      sf.ride_id,
      sf.title,
      sf.description,
      sf.photos,
      sf.likes_count,
      sf.comments_count,
      sf.created_at,
      sf.username,
      sf.avatar_url,
      sf.level,
      sf.distance_km,
      sf.duration_minutes,
      ${currentUserId ? `
      EXISTS (
        SELECT 1 FROM post_likes pl
        WHERE pl.post_id = sf.post_id AND pl.user_id = $1
      ) as is_liked
      ` : 'false as is_liked'}
    FROM social_feed sf
    LIMIT 50
  `;

  const result = currentUserId
    ? await pool.query(query, [currentUserId])
    : await pool.query(query);

  return result.rows.map(row => ({
    post_id: row.post_id,
    user_id: row.user_id,
    author: {
      user_id: row.user_id,
      username: row.username,
      avatar_url: row.avatar_url,
      level: row.level,
    },
    ride_id: row.ride_id,
    title: row.title,
    description: row.description,
    distance_km: row.distance_km,
    duration_minutes: row.duration_minutes,
    photos: row.photos || [],
    likes_count: row.likes_count,
    comments_count: row.comments_count,
    is_liked: row.is_liked,
    created_at: row.created_at,
  }));
};

export const createPost = async (
  userId: string,
  rideId: string,
  title: string,
  description?: string,
  photos?: string[]
) => {
  // Vérifie que le trajet appartient bien à l'utilisateur avant de le publier
  const rideCheck = await pool.query(
    'SELECT ride_id FROM rides WHERE ride_id = $1 AND user_id = $2',
    [rideId, userId]
  );

  if (rideCheck.rows.length === 0) {
    return null;
  }

  const result = await pool.query(
    `INSERT INTO ride_posts (user_id, ride_id, title, description, photos)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING post_id, user_id, ride_id, title, description, photos,
               likes_count, comments_count, created_at`,
    [userId, rideId, title, description || null, photos || []]
  );

  return result.rows[0];
};

export const toggleLike = async (postId: string, userId: string): Promise<{ liked: boolean }> => {
  const existing = await pool.query(
    'SELECT like_id FROM post_likes WHERE post_id = $1 AND user_id = $2',
    [postId, userId]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      'DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );
    return { liked: false };
  }

  await pool.query(
    'INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)',
    [postId, userId]
  );
  return { liked: true };
};

export const getComments = async (postId: string) => {
  const result = await pool.query(
    `SELECT
       pc.comment_id, pc.post_id, pc.user_id, pc.content, pc.created_at,
       u.username, u.avatar_url, u.level
     FROM post_comments pc
     INNER JOIN users u ON pc.user_id = u.user_id
     WHERE pc.post_id = $1
     ORDER BY pc.created_at ASC`,
    [postId]
  );

  return result.rows.map(row => ({
    comment_id: row.comment_id,
    post_id: row.post_id,
    user_id: row.user_id,
    author: { user_id: row.user_id, username: row.username, avatar_url: row.avatar_url, level: row.level },
    content: row.content,
    created_at: row.created_at,
  }));
};

export const addComment = async (postId: string, userId: string, content: string) => {
  const result = await pool.query(
    `INSERT INTO post_comments (post_id, user_id, content)
     VALUES ($1, $2, $3)
     RETURNING comment_id, post_id, user_id, content, created_at`,
    [postId, userId, content]
  );

  const comment = result.rows[0];
  const user = await pool.query(
    'SELECT username, avatar_url, level FROM users WHERE user_id = $1',
    [userId]
  );

  return {
    ...comment,
    author: { user_id: userId, ...user.rows[0] },
  };
};

export const followUser = async (followerId: string, followingId: string): Promise<boolean> => {
  if (followerId === followingId) {
    return false;
  }
  await pool.query(
    `INSERT INTO user_follows (follower_id, following_id)
     VALUES ($1, $2)
     ON CONFLICT (follower_id, following_id) DO NOTHING`,
    [followerId, followingId]
  );
  return true;
};

export const unfollowUser = async (followerId: string, followingId: string): Promise<void> => {
  await pool.query(
    'DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2',
    [followerId, followingId]
  );
};

export const getPublicProfile = async (userId: string, viewerId?: string) => {
  const statsResult = await pool.query(
    'SELECT * FROM public_profile_stats WHERE user_id = $1',
    [userId]
  );

  if (statsResult.rows.length === 0) {
    return null;
  }

  const stats = statsResult.rows[0];

  const motorcycleResult = await pool.query(
    `SELECT motorcycle_brand, motorcycle_model, motorcycle_year, motorcycle_photo_url
     FROM users WHERE user_id = $1`,
    [userId]
  );
  const moto = motorcycleResult.rows[0];

  let isFollowing = false;
  if (viewerId) {
    const followCheck = await pool.query(
      'SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2',
      [viewerId, userId]
    );
    isFollowing = followCheck.rows.length > 0;
  }

  const recentRides = await pool.query(
    `SELECT sf.* FROM social_feed sf WHERE sf.user_id = $1 ORDER BY sf.created_at DESC LIMIT 5`,
    [userId]
  );

  return {
    user_id: stats.user_id,
    username: stats.username,
    avatar_url: stats.avatar_url,
    level: stats.level,
    xp: stats.xp,
    motorcycle: moto?.motorcycle_brand ? {
      brand: moto.motorcycle_brand,
      model: moto.motorcycle_model,
      year: moto.motorcycle_year,
      photo_url: moto.motorcycle_photo_url,
    } : undefined,
    stats: {
      total_distance: stats.total_distance,
      total_trips: stats.total_trips,
      achievements: 0,
      followers: stats.followers,
      following: stats.following,
    },
    is_following: isFollowing,
    recent_rides: recentRides.rows.map(row => ({
      post_id: row.post_id,
      user_id: row.user_id,
      author: { user_id: row.user_id, username: row.username, avatar_url: row.avatar_url, level: row.level },
      ride_id: row.ride_id,
      title: row.title,
      description: row.description,
      distance_km: row.distance_km,
      duration_minutes: row.duration_minutes,
      photos: row.photos || [],
      likes_count: row.likes_count,
      comments_count: row.comments_count,
      is_liked: false,
      created_at: row.created_at,
    })),
  };
};

export const getSharedRoutes = async () => {
  const result = await pool.query(
    `SELECT sr.*, u.username, u.avatar_url, u.level
     FROM shared_routes sr
     INNER JOIN users u ON sr.user_id = u.user_id
     ORDER BY sr.created_at DESC
     LIMIT 50`
  );

  return result.rows.map(row => ({
    route_id: row.route_id,
    user_id: row.user_id,
    author: { user_id: row.user_id, username: row.username, avatar_url: row.avatar_url, level: row.level },
    title: row.title,
    description: row.description,
    distance_km: row.distance_km,
    route_data: row.route_data,
    difficulty: row.difficulty,
    rating: row.rating,
    downloads_count: row.downloads_count,
    created_at: row.created_at,
  }));
};
