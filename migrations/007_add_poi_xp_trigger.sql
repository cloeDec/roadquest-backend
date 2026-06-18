-- Migration: Attribution d'XP serveur pour les POI visités
-- Description: Jusqu'ici, l'XP "+X" affiché à la découverte d'un POI était calculé
-- uniquement côté mobile (usePOIDetection.ts), sans jamais être persisté en base.
-- Cette migration ajoute un trigger sur ride_poi qui recalcule la même formule
-- côté serveur et met à jour users.xp, sur le même principe que le trigger existant
-- trigger_update_user_stats (XP de distance).

-- ============================================================
-- Fonction : barème d'XP par type de POI et note
-- (mêmes valeurs que calculateXPReward() dans usePOIDetection.ts)
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_poi_xp_reward(p_type VARCHAR, p_rating FLOAT)
RETURNS INTEGER AS $$
DECLARE
  base_xp INTEGER;
BEGIN
  base_xp := CASE p_type
    WHEN 'col' THEN 50
    WHEN 'route_panoramique' THEN 40
    WHEN 'virage' THEN 30
    WHEN 'spot_photo' THEN 25
    WHEN 'monument' THEN 35
    ELSE 20
  END;

  RETURN ROUND(base_xp * (COALESCE(p_rating, 5) / 5.0));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- Trigger : à l'insertion d'une visite de POI (ride_poi),
-- crédite l'XP correspondant à l'utilisateur propriétaire du trajet
-- ============================================================
CREATE OR REPLACE FUNCTION award_poi_visit_xp()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_type VARCHAR;
  v_rating FLOAT;
  v_xp INTEGER;
BEGIN
  SELECT r.user_id INTO v_user_id FROM rides r WHERE r.ride_id = NEW.ride_id;
  SELECT p.type, p.rating INTO v_type, v_rating FROM pois p WHERE p.poi_id = NEW.poi_id;

  IF v_user_id IS NOT NULL THEN
    v_xp := calculate_poi_xp_reward(v_type, v_rating);

    UPDATE users SET xp = xp + v_xp WHERE user_id = v_user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_award_poi_visit_xp ON ride_poi;

CREATE TRIGGER trigger_award_poi_visit_xp
AFTER INSERT ON ride_poi
FOR EACH ROW
EXECUTE FUNCTION award_poi_visit_xp();

COMMENT ON FUNCTION calculate_poi_xp_reward IS 'Barème XP par type/note de POI, miroir de calculateXPReward() côté mobile';
COMMENT ON FUNCTION award_poi_visit_xp IS 'Crédite l''XP réel en base lors de la visite d''un POI (ride_poi)';
