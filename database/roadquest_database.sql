-- ============================================================================
-- ROADQUEST — Base de données complète (schéma + triggers + données de démo)
-- ============================================================================
--
-- Fichier unique à exécuter sur une base PostgreSQL vide :
--    psql -U user -d roadquest_db -f roadquest_database.sql
--
-- Il contient, dans l'ordre :
--   1. Les extensions (PostGIS + uuid)
--   2. Les tables (uniquement celles réellement utilisées par l'API)
--   3. Les triggers (distance/XP/niveau, XP des POI, compteurs sociaux)
--   4. Les vues utilisées par l'API (fil social, profil public)
--   5. Des données de démonstration (3 utilisateurs, POI, trajets, posts...)
--
-- Choix de conception : ce schéma ne contient que les objets exploités par le
-- code. Les tables d'un périmètre RPG plus ambitieux envisagé au départ
-- (équipements, historique d'XP, classes de rider) ont été retirées pour
-- garder une base lisible et entièrement justifiable.
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS postgis;       -- types et fonctions géospatiales
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- génération d'UUID

-- Repartir propre si on relance le script (ordre inverse des dépendances)
DROP VIEW  IF EXISTS social_feed CASCADE;
DROP VIEW  IF EXISTS public_profile_stats CASCADE;
DROP TABLE IF EXISTS post_comments CASCADE;
DROP TABLE IF EXISTS post_likes CASCADE;
DROP TABLE IF EXISTS ride_posts CASCADE;
DROP TABLE IF EXISTS shared_routes CASCADE;
DROP TABLE IF EXISTS user_follows CASCADE;
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
  -- profil moto
  motorcycle_brand     VARCHAR(100),
  motorcycle_model     VARCHAR(100),
  motorcycle_year      INTEGER,
  motorcycle_photo_url TEXT,
  -- contact d'urgence (fonctionnalité sécurité)
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
-- condition_value est le seuil à atteindre.
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

-- ----------------------------------------------------------------------------
-- Réseau social : posts, likes, commentaires, follows, routes partagées
-- ----------------------------------------------------------------------------
CREATE TABLE ride_posts (
  post_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  ride_id        UUID NOT NULL REFERENCES rides(ride_id) ON DELETE CASCADE,
  title          VARCHAR(200) NOT NULL,
  description    TEXT,
  photos         TEXT[],                    -- tableau d'URLs
  likes_count    INTEGER DEFAULT 0,         -- dénormalisé, maj par trigger
  comments_count INTEGER DEFAULT 0,         -- dénormalisé, maj par trigger
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ride_posts_created_at ON ride_posts(created_at DESC);

CREATE TABLE post_likes (
  like_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES ride_posts(post_id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (post_id, user_id)             -- un seul like par utilisateur et par post
);

CREATE TABLE post_comments (
  comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES ride_posts(post_id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_post_comments_post ON post_comments(post_id);

CREATE TABLE user_follows (
  follow_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (follower_id, following_id),
  CHECK (follower_id != following_id)   -- on ne peut pas se suivre soi-même
);

CREATE INDEX idx_user_follows_follower  ON user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON user_follows(following_id);

CREATE TABLE shared_routes (
  route_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  distance_km     NUMERIC(10,2) NOT NULL,
  route_data      JSONB NOT NULL,         -- GeoJSON de l'itinéraire
  difficulty      VARCHAR(20) CHECK (difficulty IN ('easy','medium','hard')),
  rating          NUMERIC(3,2) CHECK (rating >= 0 AND rating <= 5),
  downloads_count INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE ride_posts    IS 'Publications de trajets sur le fil social';
COMMENT ON TABLE post_likes    IS 'Likes des publications';
COMMENT ON TABLE post_comments IS 'Commentaires des publications';
COMMENT ON TABLE user_follows  IS 'Relations de suivi entre utilisateurs';
COMMENT ON TABLE shared_routes IS 'Itinéraires partagés par la communauté';

-- ============================================================================
-- 3. TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- updated_at automatique sur users
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- À l'insertion d'un trajet : calcul de la distance (PostGIS) et de l'XP
-- L'XP d'un trajet = 1 point par km parcouru (FLOOR de la distance).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ride_set_distance_and_xp()
RETURNS TRIGGER AS $$
BEGIN
  -- Si un tracé est fourni, la distance fait foi = longueur réelle du tracé.
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

-- ----------------------------------------------------------------------------
-- Après l'insertion d'un trajet : mise à jour des stats cumulées de l'user
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Recalcul du niveau dès que l'XP change : level = floor(xp / 1000) + 1
-- (1000 XP par niveau — même formule que l'application mobile)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Attribution d'XP à la visite d'un POI (insertion dans ride_poi)
-- Barème identique à l'application mobile (usePOIDetection.ts) :
--   col 50, route_panoramique 40, monument 35, virage 30, spot_photo 25, autre 20
--   le tout pondéré par la note du POI (rating / 5)
-- ----------------------------------------------------------------------------
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
    -- Le +XP est crédité sur users.xp, ce qui déclenche trg_user_level.
    UPDATE users SET xp = xp + poi_xp_for(v_type, v_rating) WHERE user_id = v_user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ride_poi_xp
AFTER INSERT ON ride_poi
FOR EACH ROW EXECUTE FUNCTION ride_poi_award_xp();

-- ----------------------------------------------------------------------------
-- Compteurs dénormalisés de likes / commentaires sur les posts
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION post_likes_count()
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

CREATE TRIGGER trg_post_likes_count
AFTER INSERT OR DELETE ON post_likes
FOR EACH ROW EXECUTE FUNCTION post_likes_count();

CREATE OR REPLACE FUNCTION post_comments_count()
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

CREATE TRIGGER trg_post_comments_count
AFTER INSERT OR DELETE ON post_comments
FOR EACH ROW EXECUTE FUNCTION post_comments_count();

-- ============================================================================
-- 4. VUES (utilisées par l'API sociale)
-- ============================================================================

-- Fil d'actualité : un post enrichi de l'auteur et des infos du trajet
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
  r.distance AS distance_km,
  r.duration AS duration_minutes
FROM ride_posts rp
JOIN users u ON rp.user_id = u.user_id
JOIN rides r ON rp.ride_id = r.ride_id
ORDER BY rp.created_at DESC;

-- Statistiques d'un profil public (compteurs de trajets, distance, abonnés...)
CREATE OR REPLACE VIEW public_profile_stats AS
SELECT
  u.user_id,
  u.username,
  u.avatar_url,
  u.level,
  u.xp,
  COALESCE(COUNT(DISTINCT r.ride_id), 0)::int            AS total_trips,
  COALESCE(ROUND(SUM(r.distance)::numeric, 2), 0)::float AS total_distance,
  COALESCE(COUNT(DISTINCT f1.follower_id), 0)::int       AS followers,
  COALESCE(COUNT(DISTINCT f2.following_id), 0)::int       AS following
FROM users u
LEFT JOIN rides r         ON u.user_id = r.user_id
LEFT JOIN user_follows f1 ON u.user_id = f1.following_id   -- ceux qui suivent u
LEFT JOIN user_follows f2 ON u.user_id = f2.follower_id    -- ceux que u suit
GROUP BY u.user_id, u.username, u.avatar_url, u.level, u.xp;

-- ============================================================================
-- 5. DONNÉES DE DÉMONSTRATION
-- ============================================================================
-- Mots de passe : tous les comptes de démo utilisent "Password123".
-- Le hash ci-dessous est un vrai hash bcrypt de "Password123" (coût 10).
-- ----------------------------------------------------------------------------

-- 5.1 Utilisateurs (UUID fixes pour pouvoir les référencer ensuite)
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

-- 5.2 Catalogue des trophées
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

-- 5.3 Trophées débloqués par Cloe (les 2 premiers seuils faciles)
INSERT INTO user_achievements (user_id, achievement_id, progress) VALUES
('11111111-1111-1111-1111-111111111111', 'a0000001-0000-0000-0000-000000000001', 100),
('11111111-1111-1111-1111-111111111111', 'a0000004-0000-0000-0000-000000000004', 100),
('11111111-1111-1111-1111-111111111111', 'a0000007-0000-0000-0000-000000000007', 100);

-- 5.4 Points d'intérêt (région Hauts-de-France, coordonnées réelles)
-- Rappel PostGIS : ST_MakePoint(longitude, latitude) — longitude d'abord !
INSERT INTO pois (poi_id, name, type, description, location, rating, is_verified) VALUES
('b0000001-0000-0000-0000-000000000001', 'Cap Blanc-Nez',       'spot_photo',        'Falaises emblématiques de la Côte d''Opale',         ST_SetSRID(ST_MakePoint(1.7019, 50.9230), 4326), 4.8, true),
('b0000002-0000-0000-0000-000000000002', 'Cap Gris-Nez',        'spot_photo',        'Point le plus proche de l''Angleterre',              ST_SetSRID(ST_MakePoint(1.5869, 50.8717), 4326), 4.7, true),
('b0000003-0000-0000-0000-000000000003', 'Beffroi d''Arras',    'monument',          'Beffroi classé au patrimoine mondial de l''UNESCO',  ST_SetSRID(ST_MakePoint(2.7775, 50.2910), 4326), 4.5, true),
('b0000004-0000-0000-0000-000000000004', 'Route des 2 Caps',    'route_panoramique', 'Itinéraire côtier entre les deux caps',              ST_SetSRID(ST_MakePoint(1.6400, 50.9000), 4326), 4.9, true),
('b0000005-0000-0000-0000-000000000005', 'Citadelle de Lille',  'monument',          'Citadelle Vauban et son parc',                       ST_SetSRID(ST_MakePoint(3.0386, 50.6420), 4326), 4.3, true);

-- 5.5 Trajets de Cloe (le trigger recalcule distance + XP, donc on les laisse
--     à NULL/0 : ce sont des valeurs de démonstration cohérentes).
--     On fournit un tracé simple (LineString) pour montrer le rendu carte.
INSERT INTO rides (ride_id, user_id, start_location, end_location, route, duration, avg_speed, max_speed) VALUES
('c0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 ST_SetSRID(ST_MakePoint(2.2958, 50.2872), 4326),   -- Arras
 ST_SetSRID(ST_MakePoint(1.7019, 50.9230), 4326),   -- Cap Blanc-Nez
 ST_SetSRID(ST_GeomFromText('LINESTRING(2.2958 50.2872, 2.0 50.5, 1.85 50.75, 1.7019 50.9230)'), 4326),
 5400, 78.0, 120.0),
('c0000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
 ST_SetSRID(ST_MakePoint(3.0586, 50.6292), 4326),   -- Lille
 ST_SetSRID(ST_MakePoint(2.7775, 50.2910), 4326),   -- Arras
 ST_SetSRID(ST_GeomFromText('LINESTRING(3.0586 50.6292, 2.95 50.5, 2.7775 50.2910)'), 4326),
 3600, 65.0, 110.0);

-- 5.6 POI visités pendant le 1er trajet (déclenche l'attribution d'XP)
INSERT INTO ride_poi (ride_id, poi_id) VALUES
('c0000001-0000-0000-0000-000000000001', 'b0000004-0000-0000-0000-000000000004'),  -- Route des 2 Caps
('c0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001');  -- Cap Blanc-Nez

-- 5.7 Relations de suivi
INSERT INTO user_follows (follower_id, following_id) VALUES
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111'),  -- Lucas suit Cloe
('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111'),  -- Emma suit Cloe
('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');  -- Cloe suit Lucas

-- 5.8 Publications sur le fil social
INSERT INTO ride_posts (post_id, user_id, ride_id, title, description) VALUES
('d0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'c0000001-0000-0000-0000-000000000001',
 'Balade vers la Côte d''Opale',
 'Superbe sortie jusqu''au Cap Blanc-Nez, vues magnifiques sur la mer !');

-- 5.9 Un like et un commentaire sur ce post (déclenchent les compteurs)
INSERT INTO post_likes (post_id, user_id) VALUES
('d0000001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222'),
('d0000001-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333');

INSERT INTO post_comments (post_id, user_id, content) VALUES
('d0000001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
 'Magnifique ! Il faut que j''y aille aussi.');

-- ============================================================================
-- FIN — vérifications rapides (optionnel, s'affiche à l'exécution)
-- ============================================================================
SELECT 'Tables créées' AS info, COUNT(*) AS nb
FROM pg_tables WHERE schemaname = 'public';
SELECT PostGIS_Version() AS postgis;
