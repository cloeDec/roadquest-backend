-- ============================================================================
-- ROADQUEST — Base de données complète (schéma + triggers + données de démo)
-- ============================================================================
--
-- Fichier unique à exécuter sur une base PostgreSQL vide :
--    psql -U user -d roadquest_db -f roadquest_database.sql
--
-- Périmètre : le cœur métier de RoadQuest (tracking GPS des trajets, points
-- d'intérêt, gamification par XP et trophées). Le réseau social (publications,
-- likes, commentaires, abonnements) est documenté comme perspective d'évolution
-- et ne fait pas partie de ce schéma.
--
-- Contenu :
--   1. Extensions (PostGIS + uuid)
--   2. Tables (6 tables)
--   3. Triggers (distance/XP/niveau, XP des POI)
--   4. Données de démonstration
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS postgis;       -- types et fonctions géospatiales
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- génération d'UUID

-- Repartir propre si on relance le script (ordre inverse des dépendances)
DROP TABLE IF EXISTS ride_poi CASCADE;
DROP TABLE IF EXISTS user_achievements CASCADE;
DROP TABLE IF EXISTS achievements CASCADE;
DROP TABLE IF EXISTS pois CASCADE;
DROP TABLE IF EXISTS rides CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- users : comptes + profil moto + statistiques agrégées (xp, level, distance)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  user_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                VARCHAR(255) NOT NULL UNIQUE,
  password             VARCHAR(255) NOT NULL,           -- hash bcrypt, jamais en clair
  username             VARCHAR(50)  NOT NULL UNIQUE,
  avatar_url           VARCHAR(500),
  xp                   INTEGER DEFAULT 0,
  level                INTEGER DEFAULT 1 NOT NULL,
  total_distance       FLOAT   DEFAULT 0,               -- km cumulés (maj par trigger)
  total_rides          INTEGER DEFAULT 0,               -- nb de trajets (maj par trigger)
  emergency_contact_name  VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

COMMENT ON TABLE users IS 'Comptes utilisateurs, profil moto et statistiques de progression';
COMMENT ON COLUMN users.password IS 'Mot de passe hashé avec bcrypt';
COMMENT ON COLUMN users.level IS 'Niveau calculé automatiquement : floor(xp / 1000) + 1';

-- ----------------------------------------------------------------------------
-- rides : trajets enregistrés, avec géométrie PostGIS
-- ----------------------------------------------------------------------------
CREATE TABLE rides (
  ride_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  start_location GEOGRAPHY(POINT, 4326) NOT NULL,       -- point GPS de départ (WGS84)
  end_location   GEOGRAPHY(POINT, 4326),
  route          GEOGRAPHY(LINESTRING, 4326),           -- tracé GPS complet
  distance       FLOAT,                                 -- km (calculé par trigger via PostGIS)
  duration       INTEGER,                               -- secondes
  avg_speed      FLOAT,
  max_speed      FLOAT,
  xp_earned      INTEGER DEFAULT 0,                     -- XP du trajet (calculé par trigger)
  weather_conditions JSONB,
  is_public      BOOLEAN DEFAULT true,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rides_user_id ON rides(user_id);
CREATE INDEX idx_rides_route   ON rides USING GIST(route);          -- index spatial
CREATE INDEX idx_rides_start   ON rides USING GIST(start_location); -- index spatial

COMMENT ON TABLE rides IS 'Trajets moto enregistrés (géométrie PostGIS)';
COMMENT ON COLUMN rides.distance IS 'Distance en km, recalculée côté serveur par PostGIS (ST_Length) à l''insertion';

-- ----------------------------------------------------------------------------
-- pois : points d'intérêt (cols, spots photo, monuments...)
-- ----------------------------------------------------------------------------
CREATE TABLE pois (
  poi_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL,
  type        VARCHAR(50)  NOT NULL,   -- col, route_panoramique, virage, spot_photo, monument, autre
  description TEXT,
  location    GEOGRAPHY(POINT, 4326) NOT NULL,
  rating      FLOAT CHECK (rating >= 0 AND rating <= 5),
  image_url   VARCHAR(500),
  created_by  UUID REFERENCES users(user_id) ON DELETE SET NULL,  -- NULL = POI officiel
  is_verified BOOLEAN DEFAULT false,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pois_location ON pois USING GIST(location);  -- index spatial pour ST_DWithin
CREATE INDEX idx_pois_type     ON pois(type);

COMMENT ON TABLE pois IS 'Points d''intérêt pour motards';
COMMENT ON COLUMN pois.created_by IS 'NULL = POI officiel, sinon créé par un utilisateur';

-- ----------------------------------------------------------------------------
-- achievements : catalogue des trophées
-- ----------------------------------------------------------------------------
-- condition_type indique sur quelle statistique se base le déblocage :
--   'rides'    -> nombre de trajets       (users.total_rides)
--   'distance' -> distance cumulée en km  (users.total_distance)
--   'pois'     -> nombre de POI visités   (table ride_poi)
CREATE TABLE achievements (
  achievement_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL,
  description     TEXT NOT NULL,
  icon_url        VARCHAR(500) NOT NULL,
  xp_reward       INTEGER NOT NULL CHECK (xp_reward >= 0),
  condition_type  VARCHAR(50) NOT NULL,                  -- 'rides' | 'distance' | 'pois'
  condition_value INTEGER NOT NULL CHECK (condition_value >= 0),
  rarity          VARCHAR(20) NOT NULL CHECK (rarity IN ('bronze','silver','gold','platinum'))
);

COMMENT ON TABLE achievements IS 'Catalogue des trophées déblocables';

-- ----------------------------------------------------------------------------
-- user_achievements : trophées débloqués par chaque utilisateur
-- ----------------------------------------------------------------------------
CREATE TABLE user_achievements (
  user_id        UUID REFERENCES users(user_id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(achievement_id) ON DELETE CASCADE,
  unlocked_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  progress       FLOAT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);

COMMENT ON TABLE user_achievements IS 'Trophées débloqués par utilisateur';

-- ----------------------------------------------------------------------------
-- ride_poi : POI visités pendant un trajet (relation N..N)
-- ----------------------------------------------------------------------------
CREATE TABLE ride_poi (
  ride_id    UUID REFERENCES rides(ride_id) ON DELETE CASCADE,
  poi_id     UUID REFERENCES pois(poi_id)  ON DELETE CASCADE,
  visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ride_id, poi_id)
);

CREATE INDEX idx_ride_poi_ride ON ride_poi(ride_id);
CREATE INDEX idx_ride_poi_poi  ON ride_poi(poi_id);

COMMENT ON TABLE ride_poi IS 'POI visités lors d''un trajet (déclenche l''attribution d''XP)';

-- ============================================================================
-- 3. TRIGGERS
-- ============================================================================

-- updated_at automatique sur users
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- À l'insertion d'un trajet : calcul de la distance (PostGIS) et de l'XP
-- L'XP d'un trajet = 1 point par km parcouru.
CREATE OR REPLACE FUNCTION ride_set_distance_and_xp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.route IS NOT NULL THEN
    NEW.distance = ST_Length(NEW.route) / 1000.0;        -- mètres -> km
  ELSIF NEW.start_location IS NOT NULL AND NEW.end_location IS NOT NULL THEN
    NEW.distance = ST_Distance(NEW.start_location, NEW.end_location) / 1000.0;
  END IF;

  IF NEW.distance IS NOT NULL THEN
    NEW.xp_earned = FLOOR(NEW.distance);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ride_distance_xp
BEFORE INSERT OR UPDATE ON rides
FOR EACH ROW EXECUTE FUNCTION ride_set_distance_and_xp();

-- Après l'insertion d'un trajet : mise à jour des stats cumulées de l'user
CREATE OR REPLACE FUNCTION ride_update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET total_rides    = total_rides + 1,
      total_distance = total_distance + COALESCE(NEW.distance, 0),
      xp             = xp + COALESCE(NEW.xp_earned, 0)
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ride_user_stats
AFTER INSERT ON rides
FOR EACH ROW EXECUTE FUNCTION ride_update_user_stats();

-- Recalcul du niveau dès que l'XP change : level = floor(xp / 1000) + 1
CREATE OR REPLACE FUNCTION user_recalculate_level()
RETURNS TRIGGER AS $$
BEGIN
  NEW.level = FLOOR(NEW.xp / 1000.0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_level
BEFORE UPDATE OF xp ON users
FOR EACH ROW
WHEN (OLD.xp IS DISTINCT FROM NEW.xp)
EXECUTE FUNCTION user_recalculate_level();

-- Attribution d'XP à la visite d'un POI (insertion dans ride_poi)
-- Barème identique à l'application mobile (usePOIDetection.ts).
CREATE OR REPLACE FUNCTION poi_xp_for(p_type VARCHAR, p_rating FLOAT)
RETURNS INTEGER AS $$
DECLARE
  base_xp INTEGER;
BEGIN
  base_xp := CASE p_type
    WHEN 'col'               THEN 50
    WHEN 'route_panoramique' THEN 40
    WHEN 'monument'          THEN 35
    WHEN 'virage'            THEN 30
    WHEN 'spot_photo'        THEN 25
    ELSE 20
  END;
  RETURN ROUND(base_xp * (COALESCE(p_rating, 5) / 5.0));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION ride_poi_award_xp()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_type    VARCHAR;
  v_rating  FLOAT;
BEGIN
  SELECT r.user_id INTO v_user_id FROM rides r WHERE r.ride_id = NEW.ride_id;
  SELECT p.type, p.rating INTO v_type, v_rating FROM pois p WHERE p.poi_id = NEW.poi_id;

  IF v_user_id IS NOT NULL THEN
    UPDATE users SET xp = xp + poi_xp_for(v_type, v_rating) WHERE user_id = v_user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ride_poi_xp
AFTER INSERT ON ride_poi
FOR EACH ROW EXECUTE FUNCTION ride_poi_award_xp();

-- ============================================================================
-- 4. DONNÉES DE DÉMONSTRATION
-- ============================================================================
-- Mots de passe : tous les comptes de démo utilisent "Password123".
-- ----------------------------------------------------------------------------

-- 4.1 Utilisateurs
INSERT INTO users (user_id, email, password, username, xp, level, total_distance, total_rides,
                   motorcycle_brand, motorcycle_model, motorcycle_year) VALUES
('11111111-1111-1111-1111-111111111111', 'cloe@roadquest.fr',
 '$2b$10$JBj9rtrcxF6Q.iYi.tDAN.h4Dlh2X15YpMseW8S4WdLm/pN6oWzxa', 'Cloe',
 2450, 3, 248.5, 6, 'Yamaha', 'MT-07', 2022),
('22222222-2222-2222-2222-222222222222', 'lucas@roadquest.fr',
 '$2b$10$JBj9rtrcxF6Q.iYi.tDAN.h4Dlh2X15YpMseW8S4WdLm/pN6oWzxa', 'Lucas',
 1120, 2, 112.0, 3, 'Honda', 'CB500F', 2021),
('33333333-3333-3333-3333-333333333333', 'emma@roadquest.fr',
 '$2b$10$JBj9rtrcxF6Q.iYi.tDAN.h4Dlh2X15YpMseW8S4WdLm/pN6oWzxa', 'Emma',
 320, 1, 32.0, 1, 'Kawasaki', 'Z650', 2023);

-- 4.2 Catalogue des trophées
INSERT INTO achievements (achievement_id, name, description, icon_url, xp_reward, condition_type, condition_value, rarity) VALUES
('a0000001-0000-0000-0000-000000000001', 'Premier Trajet',  'Effectuer votre premier trajet',           'flag-checkered', 100,  'rides',    1,    'bronze'),
('a0000002-0000-0000-0000-000000000002', 'Rider Régulier',  'Effectuer 10 trajets',                     'motorbike',      300,  'rides',    10,   'silver'),
('a0000003-0000-0000-0000-000000000003', 'Rider Confirmé',  'Effectuer 50 trajets',                     'trophy',         800,  'rides',    50,   'gold'),
('a0000004-0000-0000-0000-000000000004', 'Centurion',       'Parcourir 100 km au total',                'highway',        200,  'distance', 100,  'bronze'),
('a0000005-0000-0000-0000-000000000005', 'Grand Voyageur',  'Parcourir 500 km au total',                'road-variant',   500,  'distance', 500,  'silver'),
('a0000006-0000-0000-0000-000000000006', 'Marathon',        'Parcourir 1000 km au total',               'road',           1000, 'distance', 1000, 'gold'),
('a0000007-0000-0000-0000-000000000007', 'Chasseur de POI', 'Découvrir votre premier point d''intérêt', 'map-marker',     100,  'pois',     1,    'bronze'),
('a0000008-0000-0000-0000-000000000008', 'Collectionneur',  'Découvrir 10 points d''intérêt',           'trophy',         300,  'pois',     10,   'silver'),
('a0000009-0000-0000-0000-000000000009', 'Maître des POI',  'Découvrir 50 points d''intérêt',           'trophy-award',   1500, 'pois',     50,   'platinum');

-- 4.3 Trophées débloqués par Cloe
INSERT INTO user_achievements (user_id, achievement_id, progress) VALUES
('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001', 100),
('11111111-1111-1111-1111-111111111111', 'a0000004-0000-0000-0000-000000000004', 100),
('11111111-1111-1111-1111-111111111111', 'a0000007-0000-0000-0000-000000000007', 100);

-- 4.4 Points d'intérêt (région Hauts-de-France, coordonnées réelles)
-- Rappel PostGIS : ST_MakePoint(longitude, latitude) — longitude d'abord !
INSERT INTO pois (poi_id, name, type, description, location, rating, is_verified) VALUES
('b0000001-0000-0000-0000-000000000001', 'Cap Blanc-Nez',      'spot_photo',        'Falaises emblématiques de la Côte d''Opale',        ST_SetSRID(ST_MakePoint(1.7019, 50.9230), 4326), 4.8, true),
('b0000002-0000-0000-0000-000000000002', 'Cap Gris-Nez',       'spot_photo',        'Point le plus proche de l''Angleterre',             ST_SetSRID(ST_MakePoint(1.5869, 50.8717), 4326), 4.7, true),
('b0000003-0000-0000-0000-000000000003', 'Beffroi d''Arras',   'monument',          'Beffroi classé au patrimoine mondial de l''UNESCO', ST_SetSRID(ST_MakePoint(2.7775, 50.2910), 4326), 4.5, true),
('b0000004-0000-0000-0000-000000000004', 'Route des 2 Caps',   'route_panoramique', 'Itinéraire côtier entre les deux caps',             ST_SetSRID(ST_MakePoint(1.6400, 50.9000), 4326), 4.9, true),
('b0000005-0000-0000-0000-000000000005', 'Citadelle de Lille', 'monument',          'Citadelle Vauban et son parc',                      ST_SetSRID(ST_MakePoint(3.0386, 50.6420), 4326), 4.3, true);

-- 4.5 Trajets de Cloe (distance et XP recalculés par le trigger)
INSERT INTO rides (ride_id, user_id, start_location, end_location, route, duration, avg_speed, max_speed) VALUES
('c0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 ST_SetSRID(ST_MakePoint(2.2958, 50.2872), 4326),
 ST_SetSRID(ST_MakePoint(1.7019, 50.9230), 4326),
 ST_SetSRID(ST_GeomFromText('LINESTRING(2.2958 50.2872, 2.0 50.5, 1.85 50.75, 1.7019 50.9230)'), 4326),
 5400, 78.0, 120.0),
('c0000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
 ST_SetSRID(ST_MakePoint(3.0586, 50.6292), 4326),
 ST_SetSRID(ST_MakePoint(2.7775, 50.2910), 4326),
 ST_SetSRID(ST_GeomFromText('LINESTRING(3.0586 50.6292, 2.95 50.5, 2.7775 50.2910)'), 4326),
 3600, 65.0, 110.0);

-- 4.6 POI visités pendant le 1er trajet (déclenche l'attribution d'XP)
INSERT INTO ride_poi (ride_id, poi_id) VALUES
('c0000001-0000-0000-0000-000000000001', 'b0000004-0000-0000-0000-000000000004'),
('c0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001');

-- ============================================================================
-- FIN — vérifications rapides (optionnel)
-- ============================================================================
SELECT 'Tables créées' AS info, COUNT(*) AS nb FROM pg_tables WHERE schemaname = 'public';
SELECT PostGIS_Version() AS postgis;
