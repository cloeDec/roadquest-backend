-- Migration pour ajouter les informations de moto et statistiques au profil utilisateur

-- Ajouter les champs de moto à la table users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS motorcycle_brand VARCHAR(100),
  ADD COLUMN IF NOT EXISTS motorcycle_model VARCHAR(100),
  ADD COLUMN IF NOT EXISTS motorcycle_year INTEGER,
  ADD COLUMN IF NOT EXISTS motorcycle_photo_url TEXT;

-- Ajouter un index pour rechercher par marque/modèle
CREATE INDEX IF NOT EXISTS idx_users_motorcycle
  ON users(motorcycle_brand, motorcycle_model);

-- Créer une vue pour les statistiques utilisateur
CREATE OR REPLACE VIEW user_statistics AS
SELECT
  u.user_id,
  u.username,
  u.email,
  u.current_xp as xp,
  u.user_level as level,
  u.motorcycle_brand,
  u.motorcycle_model,
  u.motorcycle_year,
  u.motorcycle_photo_url,
  COALESCE(COUNT(DISTINCT r.ride_id), 0) as total_trips,
  COALESCE(ROUND(SUM(r.distance_km)::numeric, 2), 0) as total_distance,
  COALESCE(COUNT(DISTINCT vp.poi_id), 0) as pois_discovered,
  COALESCE(COUNT(DISTINCT ua.achievement_id) FILTER (WHERE ua.unlocked_at IS NOT NULL), 0) as achievements_unlocked
FROM users u
LEFT JOIN rides r ON u.user_id = r.user_id
LEFT JOIN visited_pois vp ON u.user_id = vp.user_id
LEFT JOIN user_achievements ua ON u.user_id = ua.user_id
GROUP BY
  u.user_id,
  u.username,
  u.email,
  u.current_xp,
  u.user_level,
  u.motorcycle_brand,
  u.motorcycle_model,
  u.motorcycle_year,
  u.motorcycle_photo_url;

-- Fonction pour mettre à jour les informations de moto
CREATE OR REPLACE FUNCTION update_user_motorcycle(
  p_user_id UUID,
  p_brand VARCHAR(100),
  p_model VARCHAR(100),
  p_year INTEGER,
  p_photo_url TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE users
  SET
    motorcycle_brand = p_brand,
    motorcycle_model = p_model,
    motorcycle_year = p_year,
    motorcycle_photo_url = p_photo_url,
    updated_at = CURRENT_TIMESTAMP
  WHERE user_id = p_user_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Commentaires pour documentation
COMMENT ON COLUMN users.motorcycle_brand IS 'Marque de la moto de l''utilisateur';
COMMENT ON COLUMN users.motorcycle_model IS 'Modèle de la moto de l''utilisateur';
COMMENT ON COLUMN users.motorcycle_year IS 'Année de la moto de l''utilisateur';
COMMENT ON COLUMN users.motorcycle_photo_url IS 'URL de la photo de la moto de l''utilisateur';
COMMENT ON VIEW user_statistics IS 'Vue consolidée des statistiques utilisateur pour le profil';
COMMENT ON FUNCTION update_user_motorcycle IS 'Mise à jour des informations de moto d''un utilisateur';
