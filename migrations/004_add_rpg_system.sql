-- Migration: Système RPG & Progression
-- Description: Ajoute les tables et colonnes pour le système de niveaux, XP, classes et équipements

-- ========================================
-- 1. Ajout des colonnes RPG aux utilisateurs
-- ========================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_xp INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rider_class VARCHAR(50); -- NULL jusqu'au niveau 5
ALTER TABLE users ADD COLUMN IF NOT EXISTS class_selected_at TIMESTAMP;

-- ========================================
-- 2. Table des équipements débloqués
-- ========================================

CREATE TABLE IF NOT EXISTS user_equipment (
  equipment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  equipment_type VARCHAR(50) NOT NULL, -- 'helmet', 'jacket', 'gloves', 'boots'
  equipment_name VARCHAR(100) NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_equipped BOOLEAN DEFAULT false,

  UNIQUE(user_id, equipment_name)
);

CREATE INDEX IF NOT EXISTS idx_user_equipment_user ON user_equipment(user_id);

-- ========================================
-- 3. Table de l'historique XP
-- ========================================

CREATE TABLE IF NOT EXISTS xp_history (
  xp_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  xp_amount INTEGER NOT NULL,
  xp_source VARCHAR(50) NOT NULL, -- 'ride_distance', 'poi_discovered', 'col_completed', 'region_unlocked', 'achievement'
  source_id UUID, -- ID du trajet, POI, achievement, etc.
  multiplier DECIMAL(3,2) DEFAULT 1.0, -- Bonus de classe
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_xp_history_user ON xp_history(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_history_created ON xp_history(created_at DESC);

-- ========================================
-- 4. Table des achievements/défis
-- ========================================

CREATE TABLE IF NOT EXISTS achievements (
  achievement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_key VARCHAR(100) UNIQUE NOT NULL, -- 'first_ride', 'col_master', etc.
  name VARCHAR(100) NOT NULL,
  description TEXT,
  xp_reward INTEGER DEFAULT 0,
  badge_icon VARCHAR(50), -- Nom de l'icône
  category VARCHAR(50), -- 'distance', 'pois', 'cols', 'social', etc.
  requirement_type VARCHAR(50), -- 'count', 'total', 'unique', 'streak'
  requirement_value INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 5. Table des achievements débloqués
-- ========================================

CREATE TABLE IF NOT EXISTS user_achievements (
  user_achievement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(achievement_id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  progress INTEGER DEFAULT 0, -- Pour les achievements progressifs

  UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);

-- ========================================
-- 6. Insertion des achievements par défaut
-- ========================================

INSERT INTO achievements (achievement_key, name, description, xp_reward, badge_icon, category, requirement_type, requirement_value)
VALUES
  -- Distance
  ('first_ride', 'Premier Trajet', 'Effectuer votre premier trajet', 100, 'flag-checkered', 'distance', 'count', 1),
  ('century_rider', 'Centurion', 'Parcourir 100 km en une seule sortie', 200, 'highway', 'distance', 'total', 100),
  ('marathon', 'Marathon', 'Parcourir 1000 km au total', 500, 'road', 'distance', 'total', 1000),

  -- POIs
  ('poi_hunter', 'Chasseur de POI', 'Découvrir votre premier POI', 100, 'map-marker', 'pois', 'count', 1),
  ('poi_collector', 'Collectionneur', 'Découvrir 10 POIs différents', 300, 'trophy', 'pois', 'unique', 10),
  ('poi_master', 'Maître des POIs', 'Découvrir 50 POIs différents', 1000, 'trophy-award', 'pois', 'unique', 50),

  -- Cols
  ('col_beginner', 'Grimpeur Débutant', 'Franchir votre premier col', 150, 'image-filter-hdr', 'cols', 'count', 1),
  ('col_enthusiast', 'Passionné de Cols', 'Franchir 5 cols différents', 400, 'trophy', 'cols', 'unique', 5),
  ('col_master', 'Maître des Cols', 'Franchir 20 cols différents', 1500, 'trophy-award', 'cols', 'unique', 20),

  -- Régions
  ('explorer', 'Explorateur', 'Débloquer votre première région', 200, 'map', 'regions', 'count', 1),
  ('region_master', 'Maître des Régions', 'Débloquer 5 régions', 1000, 'earth', 'regions', 'count', 5),

  -- Social
  ('social_rider', 'Rider Social', 'Rejoindre un groupe', 100, 'account-group', 'social', 'count', 1)
ON CONFLICT (achievement_key) DO NOTHING;

-- ========================================
-- 7. Vue pour les statistiques de progression
-- ========================================

CREATE OR REPLACE VIEW user_progression_stats AS
SELECT
  u.user_id,
  u.level,
  u.current_xp,
  u.total_xp,
  u.rider_class,
  COUNT(DISTINCT ue.equipment_id) as total_equipment,
  COUNT(DISTINCT CASE WHEN ue.is_equipped = true THEN ue.equipment_id END) as equipped_count,
  COUNT(DISTINCT ua.achievement_id) as achievements_unlocked,
  COUNT(DISTINCT r.ride_id) as total_rides,
  COALESCE(SUM(r.distance_km), 0) as total_distance_km,
  COUNT(DISTINCT pv.poi_id) as pois_discovered
FROM users u
LEFT JOIN user_equipment ue ON u.user_id = ue.user_id
LEFT JOIN user_achievements ua ON u.user_id = ua.user_id
LEFT JOIN rides r ON u.user_id = r.user_id AND r.status = 'completed'
LEFT JOIN poi_visits pv ON u.user_id = pv.user_id
GROUP BY u.user_id, u.level, u.current_xp, u.total_xp, u.rider_class;

-- ========================================
-- 8. Fonction pour calculer l'XP requis par niveau
-- ========================================

CREATE OR REPLACE FUNCTION calculate_xp_for_level(target_level INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- Formule: XP = 100 * level^1.5
  -- Niveau 1→2: 100 XP
  -- Niveau 2→3: 283 XP
  -- Niveau 5→6: 1118 XP
  -- Niveau 10→11: 3162 XP
  -- Niveau 50→51: 35355 XP
  -- Niveau 100→101: 100000 XP
  RETURN FLOOR(100 * POWER(target_level, 1.5));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON TABLE user_equipment IS 'Équipements virtuels débloqués par les utilisateurs';
COMMENT ON TABLE xp_history IS 'Historique des gains d''XP';
COMMENT ON TABLE achievements IS 'Définitions des achievements/défis';
COMMENT ON TABLE user_achievements IS 'Achievements débloqués par les utilisateurs';
