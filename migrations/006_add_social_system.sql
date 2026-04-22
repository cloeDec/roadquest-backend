-- Migration pour ajouter le système social (feed, posts, comments, follows)

-- Table des posts de rides partagés
CREATE TABLE IF NOT EXISTS ride_posts (
  post_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  ride_id UUID NOT NULL REFERENCES rides(ride_id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  photos TEXT[], -- Array d'URLs de photos
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des likes sur les posts
CREATE TABLE IF NOT EXISTS post_likes (
  like_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES ride_posts(post_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, user_id)
);

-- Table des commentaires
CREATE TABLE IF NOT EXISTS post_comments (
  comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES ride_posts(post_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des follows (qui suit qui)
CREATE TABLE IF NOT EXISTS user_follows (
  follow_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Table des routes partagées
CREATE TABLE IF NOT EXISTS shared_routes (
  route_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  distance_km NUMERIC(10, 2) NOT NULL,
  route_data JSONB NOT NULL, -- GeoJSON de la route
  difficulty VARCHAR(20) CHECK (difficulty IN ('easy', 'medium', 'hard')),
  rating NUMERIC(3, 2) CHECK (rating >= 0 AND rating <= 5),
  downloads_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_ride_posts_user_id ON ride_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_ride_posts_created_at ON ride_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_shared_routes_user_id ON shared_routes(user_id);

-- Trigger pour mettre à jour le compteur de likes
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE ride_posts SET likes_count = likes_count + 1 WHERE post_id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE ride_posts SET likes_count = likes_count - 1 WHERE post_id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_likes_count
AFTER INSERT OR DELETE ON post_likes
FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();

-- Trigger pour mettre à jour le compteur de commentaires
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE ride_posts SET comments_count = comments_count + 1 WHERE post_id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE ride_posts SET comments_count = comments_count - 1 WHERE post_id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_comments_count
AFTER INSERT OR DELETE ON post_comments
FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();

-- Vue pour le feed social avec toutes les infos
CREATE OR REPLACE VIEW social_feed AS
SELECT
  rp.post_id,
  rp.user_id,
  rp.ride_id,
  rp.title,
  rp.description,
  rp.photos,
  rp.likes_count,
  rp.comments_count,
  rp.created_at,
  u.username,
  u.avatar_url,
  u.level,
  r.distance as distance_km,
  r.duration as duration_minutes
FROM ride_posts rp
JOIN users u ON rp.user_id = u.user_id
JOIN rides r ON rp.ride_id = r.ride_id
ORDER BY rp.created_at DESC;

-- Vue pour les statistiques de profil public (simplifié sans les colonnes moto pour l'instant)
CREATE OR REPLACE VIEW public_profile_stats AS
SELECT
  u.user_id,
  u.username,
  u.avatar_url,
  u.level,
  u.xp,
  COALESCE(COUNT(DISTINCT r.ride_id), 0)::int as total_trips,
  COALESCE(ROUND(SUM(r.distance)::numeric, 2), 0)::float as total_distance,
  COALESCE(COUNT(DISTINCT f1.follower_id), 0)::int as followers,
  COALESCE(COUNT(DISTINCT f2.following_id), 0)::int as following
FROM users u
LEFT JOIN rides r ON u.user_id = r.user_id
LEFT JOIN user_follows f1 ON u.user_id = f1.following_id
LEFT JOIN user_follows f2 ON u.user_id = f2.follower_id
GROUP BY u.user_id, u.username, u.avatar_url, u.level, u.xp;

-- Commentaires pour documentation
COMMENT ON TABLE ride_posts IS 'Posts de rides partagés sur le fil social';
COMMENT ON TABLE post_likes IS 'Likes sur les posts';
COMMENT ON TABLE post_comments IS 'Commentaires sur les posts';
COMMENT ON TABLE user_follows IS 'Relations de suivi entre utilisateurs';
COMMENT ON TABLE shared_routes IS 'Routes partagées par les utilisateurs';
COMMENT ON VIEW social_feed IS 'Vue complète du fil social avec infos utilisateur et ride';
COMMENT ON VIEW public_profile_stats IS 'Vue des statistiques pour profils publics';
