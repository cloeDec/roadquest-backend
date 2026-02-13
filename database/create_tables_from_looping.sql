-- ============================================================
-- ROADQUEST - Script SQL PostgreSQL (basé sur MCD Looping)
-- ============================================================
-- Corrections appliquées :
-- - Types PostgreSQL (UUID, BOOLEAN, TIMESTAMP, GEOGRAPHY)
-- - Noms de tables en minuscules (convention PostgreSQL)
-- - PostGIS pour données géospatiales
-- - Optimisations relations (FK directes au lieu de tables intermédiaires)
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE users(
   user_id UUID DEFAULT gen_random_uuid(),
   email VARCHAR(255) NOT NULL,
   password VARCHAR(255) NOT NULL,
   username VARCHAR(50) NOT NULL,
   avatar_url VARCHAR(500),
   xp INTEGER DEFAULT 0,
   level INTEGER DEFAULT 1 NOT NULL,
   total_distance FLOAT DEFAULT 0,
   total_rides INTEGER DEFAULT 0,
   emergency_contact_name VARCHAR(100),
   emergency_contact_phone VARCHAR(20),
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY(user_id),
   UNIQUE(email),
   UNIQUE(username)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

COMMENT ON TABLE users IS 'Utilisateurs de l''application RoadQuest';

-- ============================================================
-- TABLE: rides
-- ============================================================
CREATE TABLE rides(
   ride_id UUID DEFAULT gen_random_uuid(),
   user_id UUID NOT NULL,
   start_location GEOGRAPHY(POINT, 4326) NOT NULL,
   end_location GEOGRAPHY(POINT, 4326),
   route GEOGRAPHY(LINESTRING, 4326),
   distance FLOAT,
   duration INTEGER,
   avg_speed FLOAT,
   max_speed FLOAT,
   xp_earned INTEGER DEFAULT 0,
   weather_conditions JSONB,
   is_public BOOLEAN DEFAULT true,
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY(ride_id),
   FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_rides_user_id ON rides(user_id);
CREATE INDEX idx_rides_start_location ON rides USING GIST(start_location);
CREATE INDEX idx_rides_end_location ON rides USING GIST(end_location);
CREATE INDEX idx_rides_route ON rides USING GIST(route);
CREATE INDEX idx_rides_created_at ON rides(created_at DESC);

COMMENT ON TABLE rides IS 'Trajets moto enregistrés';
COMMENT ON COLUMN rides.start_location IS 'Point GPS de départ (WGS84)';
COMMENT ON COLUMN rides.route IS 'Tracé GPS complet (LineString)';

-- ============================================================
-- TABLE: pois
-- ============================================================
CREATE TABLE pois(
   poi_id UUID DEFAULT gen_random_uuid(),
   name VARCHAR(150) NOT NULL,
   type VARCHAR(50) NOT NULL,
   description TEXT,
   location GEOGRAPHY(POINT, 4326) NOT NULL,
   rating FLOAT CHECK (rating >= 0 AND rating <= 5),
   image_url VARCHAR(500),
   created_by UUID,
   is_verified BOOLEAN DEFAULT false,
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY(poi_id),
   FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_pois_location ON pois USING GIST(location);
CREATE INDEX idx_pois_type ON pois(type);
CREATE INDEX idx_pois_created_by ON pois(created_by);

COMMENT ON TABLE pois IS 'Points d''intérêt pour motards';
COMMENT ON COLUMN pois.created_by IS 'NULL = POI officiel, sinon créé par un user';

-- ============================================================
-- TABLE: achievements
-- ============================================================
CREATE TABLE achievements(
   achievement_id UUID DEFAULT gen_random_uuid(),
   name VARCHAR(100) NOT NULL,
   description TEXT NOT NULL,
   icon_url VARCHAR(500) NOT NULL,
   xp_reward INTEGER NOT NULL CHECK (xp_reward >= 0),
   condition_type VARCHAR(50) NOT NULL,
   condition_value INTEGER NOT NULL CHECK (condition_value >= 0),
   rarity VARCHAR(20) NOT NULL CHECK (rarity IN ('bronze', 'silver', 'gold', 'platinum')),
   PRIMARY KEY(achievement_id)
);

CREATE INDEX idx_achievements_rarity ON achievements(rarity);

COMMENT ON TABLE achievements IS 'Succès/trophées déblocables';

-- ============================================================
-- TABLE: routes
-- ============================================================
CREATE TABLE routes(
   route_id UUID DEFAULT gen_random_uuid(),
   name VARCHAR(150) NOT NULL,
   description TEXT,
   route_line GEOGRAPHY(LINESTRING, 4326) NOT NULL,
   distance FLOAT NOT NULL CHECK (distance > 0),
   estimated_duration INTEGER,
   difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
   is_public BOOLEAN DEFAULT true,
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   created_by UUID NOT NULL,
   PRIMARY KEY(route_id),
   FOREIGN KEY(created_by) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_routes_route_line ON routes USING GIST(route_line);
CREATE INDEX idx_routes_created_by ON routes(created_by);

COMMENT ON TABLE routes IS 'Itinéraires suggérés';

-- ============================================================
-- TABLE: user_achievements
-- ============================================================
CREATE TABLE user_achievements(
   user_id UUID,
   achievement_id UUID,
   unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   progress FLOAT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
   PRIMARY KEY(user_id, achievement_id),
   FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE,
   FOREIGN KEY(achievement_id) REFERENCES achievements(achievement_id) ON DELETE CASCADE
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);

COMMENT ON TABLE user_achievements IS 'Achievements débloqués par utilisateurs';

-- ============================================================
-- TABLE: ride_poi (POIs visités lors d'un trajet)
-- ============================================================
CREATE TABLE ride_poi(
   ride_id UUID,
   poi_id UUID,
   visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY(ride_id, poi_id),
   FOREIGN KEY(ride_id) REFERENCES rides(ride_id) ON DELETE CASCADE,
   FOREIGN KEY(poi_id) REFERENCES pois(poi_id) ON DELETE CASCADE
);

CREATE INDEX idx_ride_poi_ride ON ride_poi(ride_id);
CREATE INDEX idx_ride_poi_poi ON ride_poi(poi_id);

COMMENT ON TABLE ride_poi IS 'POIs visités lors d''un trajet';

-- ============================================================
-- TABLE: followers (Réseau social)
-- ============================================================
CREATE TABLE followers(
   follower_id UUID,
   following_id UUID,
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY(follower_id, following_id),
   FOREIGN KEY(follower_id) REFERENCES users(user_id) ON DELETE CASCADE,
   FOREIGN KEY(following_id) REFERENCES users(user_id) ON DELETE CASCADE,
   CHECK (follower_id != following_id)
);

CREATE INDEX idx_followers_follower ON followers(follower_id);
CREATE INDEX idx_followers_following ON followers(following_id);

COMMENT ON TABLE followers IS 'Relation de suivi entre utilisateurs';

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour calculer distance et XP
CREATE OR REPLACE FUNCTION calculate_ride_distance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.route IS NOT NULL THEN
        NEW.distance = ST_Length(NEW.route::geography) / 1000;
    ELSIF NEW.start_location IS NOT NULL AND NEW.end_location IS NOT NULL THEN
        NEW.distance = ST_Distance(NEW.start_location, NEW.end_location) / 1000;
    END IF;
    
    IF NEW.distance IS NOT NULL THEN
        NEW.xp_earned = FLOOR(NEW.distance);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_ride_distance
BEFORE INSERT OR UPDATE ON rides
FOR EACH ROW
EXECUTE FUNCTION calculate_ride_distance();

-- Trigger pour mettre à jour stats utilisateur
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users 
    SET total_rides = total_rides + 1,
        total_distance = total_distance + COALESCE(NEW.distance, 0),
        xp = xp + COALESCE(NEW.xp_earned, 0)
    WHERE user_id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_stats
AFTER INSERT ON rides
FOR EACH ROW
EXECUTE FUNCTION update_user_stats();

-- Trigger pour calculer le niveau
CREATE OR REPLACE FUNCTION update_user_level()
RETURNS TRIGGER AS $$
BEGIN
    NEW.level = FLOOR(NEW.xp / 1000) + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_level
BEFORE UPDATE OF xp ON users
FOR EACH ROW
WHEN (OLD.xp IS DISTINCT FROM NEW.xp)
EXECUTE FUNCTION update_user_level();

-- ============================================================
-- VUES
-- ============================================================

CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.user_id,
    u.username,
    u.email,
    u.avatar_url,
    u.xp,
    u.level,
    u.total_distance,
    u.total_rides,
    COUNT(DISTINCT ua.achievement_id) as achievements_unlocked,
    COUNT(DISTINCT f1.following_id) as following_count,
    COUNT(DISTINCT f2.follower_id) as followers_count,
    u.created_at
FROM users u
LEFT JOIN user_achievements ua ON u.user_id = ua.user_id
LEFT JOIN followers f1 ON u.user_id = f1.follower_id
LEFT JOIN followers f2 ON u.user_id = f2.following_id
GROUP BY u.user_id;

CREATE OR REPLACE VIEW leaderboard AS
SELECT 
    user_id,
    username,
    avatar_url,
    xp,
    level,
    total_distance,
    total_rides,
    RANK() OVER (ORDER BY xp DESC) as rank
FROM users
ORDER BY xp DESC;

-- ============================================================
-- FONCTIONS UTILES
-- ============================================================

CREATE OR REPLACE FUNCTION find_nearby_pois(
    lat FLOAT,
    lon FLOAT,
    radius_meters INTEGER DEFAULT 5000,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    poi_id UUID,
    name VARCHAR,
    type VARCHAR,
    distance_meters FLOAT,
    rating FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.poi_id,
        p.name,
        p.type,
        ST_Distance(p.location, ST_MakePoint(lon, lat)::geography) as distance_meters,
        p.rating
    FROM pois p
    WHERE ST_DWithin(p.location, ST_MakePoint(lon, lat)::geography, radius_meters)
    ORDER BY distance_meters
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- AFFICHAGE TABLES CRÉÉES
-- ============================================================

SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
SELECT PostGIS_Version();
