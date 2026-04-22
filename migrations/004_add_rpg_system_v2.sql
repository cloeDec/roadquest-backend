-- Migration: Système RPG & Progression (Version 2 - Compatible avec existant)
-- Description: Complète les tables existantes pour le système de niveaux, XP, classes et équipements

-- ========================================
-- 1. Ajout des colonnes RPG aux utilisateurs (si pas déjà présentes)
-- ========================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS current_xp INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rider_class VARCHAR(50); -- NULL jusqu'au niveau 5
ALTER TABLE users ADD COLUMN IF NOT EXISTS class_selected_at TIMESTAMP;

-- ========================================
-- 2. Ajout de colonnes manquantes à achievements
-- ========================================

ALTER TABLE achievements ADD COLUMN IF NOT EXISTS achievement_key VARCHAR(100) UNIQUE;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS badge_icon VARCHAR(50);
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS requirement_type VARCHAR(50) DEFAULT 'count';
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS requirement_value INTEGER DEFAULT 1;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Renommer les colonnes existantes si nécessaire
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'achievements' AND column_name = 'condition_type') THEN
    UPDATE achievements SET requirement_type = condition_type WHERE requirement_type IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'achievements' AND column_name = 'condition_value') THEN
    UPDATE achievements SET requirement_value = condition_value WHERE requirement_value IS NULL;
  END IF;
END $$;

-- ========================================
-- 3. Table des équipements débloqués
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
-- 4. Table de l'historique XP
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
-- 5. Ajout de colonnes à user_achievements
-- ========================================

ALTER TABLE user_achievements ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;

-- ========================================
-- 6. Mise à jour des achievements existants avec achievement_key
-- ========================================

UPDATE achievements
SET achievement_key = 'achievement_' || achievement_id::text
WHERE achievement_key IS NULL;

-- ========================================
-- 7. Fonction pour calculer l'XP requis par niveau
-- ========================================

CREATE OR REPLACE FUNCTION calculate_xp_for_level(target_level INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- Formule: XP = 100 * level^1.5
  RETURN FLOOR(100 * POWER(target_level, 1.5));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ========================================
-- 8. Vue pour les statistiques de progression
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

COMMENT ON TABLE user_equipment IS 'Équipements virtuels débloqués par les utilisateurs';
COMMENT ON TABLE xp_history IS 'Historique des gains d''XP';
