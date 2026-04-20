import { pool } from '../../config/database';

export interface Coordinate {
  latitude: number;
  longitude: number;
  timestamp?: number;
}

export interface Ride {
  ride_id: string;
  user_id: string;
  start_location: {
    latitude: number;
    longitude: number;
  };
  end_location?: {
    latitude: number;
    longitude: number;
  };
  route: Coordinate[];
  distance: number;
  duration: number;
  avg_speed?: number;
  max_speed?: number;
  xp_earned: number;
  weather_conditions?: any;
  is_public: boolean;
  created_at: Date;
  destination_name?: string;
}

export interface CreateRideData {
  user_id: string;
  start_location: {
    latitude: number;
    longitude: number;
  };
  end_location?: {
    latitude: number;
    longitude: number;
  };
  route: Coordinate[];
  distance: number;
  duration: number;
  avg_speed?: number;
  max_speed?: number;
  destination_name?: string;
  is_public?: boolean;
}

/**
 * Créer un nouveau trajet
 */
export const createRide = async (data: CreateRideData): Promise<Ride> => {
  const {
    user_id,
    start_location,
    end_location,
    route,
    distance,
    duration,
    avg_speed,
    max_speed,
    destination_name,
    is_public = true
  } = data;

  // Convertir les coordonnées en format PostGIS LineString
  const routeLineString = route.length > 0
    ? `LINESTRING(${route.map(coord => `${coord.longitude} ${coord.latitude}`).join(', ')})`
    : null;

  const query = `
    INSERT INTO rides (
      user_id,
      start_location,
      end_location,
      route,
      distance,
      duration,
      avg_speed,
      max_speed,
      is_public
    )
    VALUES (
      $1,
      ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
      ${end_location ? 'ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography' : 'NULL'},
      ${routeLineString ? `ST_GeomFromText($${end_location ? 6 : 4}, 4326)::geography` : 'NULL'},
      $${end_location ? (routeLineString ? 7 : 6) : (routeLineString ? 5 : 4)},
      $${end_location ? (routeLineString ? 8 : 7) : (routeLineString ? 6 : 5)},
      $${end_location ? (routeLineString ? 9 : 8) : (routeLineString ? 7 : 6)},
      $${end_location ? (routeLineString ? 10 : 9) : (routeLineString ? 8 : 7)},
      $${end_location ? (routeLineString ? 11 : 10) : (routeLineString ? 9 : 8)}
    )
    RETURNING
      ride_id,
      user_id,
      ST_Y(start_location::geometry) as start_lat,
      ST_X(start_location::geometry) as start_lng,
      ${end_location ? 'ST_Y(end_location::geometry) as end_lat, ST_X(end_location::geometry) as end_lng,' : ''}
      distance,
      duration,
      avg_speed,
      max_speed,
      xp_earned,
      is_public,
      created_at
  `;

  const params: any[] = [
    user_id,
    start_location.longitude,
    start_location.latitude
  ];

  if (end_location) {
    params.push(end_location.longitude, end_location.latitude);
  }

  if (routeLineString) {
    params.push(routeLineString);
  }

  params.push(distance, duration, avg_speed || null, max_speed || null, is_public);

  const result = await pool.query(query, params);
  const row = result.rows[0];

  return {
    ride_id: row.ride_id,
    user_id: row.user_id,
    start_location: {
      latitude: row.start_lat,
      longitude: row.start_lng
    },
    end_location: end_location && row.end_lat && row.end_lng ? {
      latitude: row.end_lat,
      longitude: row.end_lng
    } : undefined,
    route: route,
    distance: row.distance,
    duration: row.duration,
    avg_speed: row.avg_speed,
    max_speed: row.max_speed,
    xp_earned: row.xp_earned,
    is_public: row.is_public,
    created_at: row.created_at,
    destination_name: destination_name
  };
};

/**
 * Récupérer tous les trajets d'un utilisateur
 */
export const getRidesByUserId = async (userId: string): Promise<Ride[]> => {
  const query = `
    SELECT
      ride_id,
      user_id,
      ST_Y(start_location::geometry) as start_lat,
      ST_X(start_location::geometry) as start_lng,
      ST_Y(end_location::geometry) as end_lat,
      ST_X(end_location::geometry) as end_lng,
      ST_AsGeoJSON(route::geometry) as route_geojson,
      distance,
      duration,
      avg_speed,
      max_speed,
      xp_earned,
      weather_conditions,
      is_public,
      created_at
    FROM rides
    WHERE user_id = $1
    ORDER BY created_at DESC
  `;

  const result = await pool.query(query, [userId]);

  return result.rows.map(row => {
    let route: Coordinate[] = [];

    if (row.route_geojson) {
      const geoJson = JSON.parse(row.route_geojson);
      if (geoJson.type === 'LineString' && geoJson.coordinates) {
        route = geoJson.coordinates.map((coord: [number, number]) => ({
          longitude: coord[0],
          latitude: coord[1]
        }));
      }
    }

    return {
      ride_id: row.ride_id,
      user_id: row.user_id,
      start_location: {
        latitude: row.start_lat,
        longitude: row.start_lng
      },
      end_location: row.end_lat && row.end_lng ? {
        latitude: row.end_lat,
        longitude: row.end_lng
      } : undefined,
      route: route,
      distance: row.distance,
      duration: row.duration,
      avg_speed: row.avg_speed,
      max_speed: row.max_speed,
      xp_earned: row.xp_earned,
      weather_conditions: row.weather_conditions,
      is_public: row.is_public,
      created_at: row.created_at
    };
  });
};

/**
 * Récupérer un trajet par ID
 */
export const getRideById = async (rideId: string, userId: string): Promise<Ride | null> => {
  const query = `
    SELECT
      ride_id,
      user_id,
      ST_Y(start_location::geometry) as start_lat,
      ST_X(start_location::geometry) as start_lng,
      ST_Y(end_location::geometry) as end_lat,
      ST_X(end_location::geometry) as end_lng,
      ST_AsGeoJSON(route::geometry) as route_geojson,
      distance,
      duration,
      avg_speed,
      max_speed,
      xp_earned,
      weather_conditions,
      is_public,
      created_at
    FROM rides
    WHERE ride_id = $1 AND user_id = $2
  `;

  const result = await pool.query(query, [rideId, userId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  let route: Coordinate[] = [];

  if (row.route_geojson) {
    const geoJson = JSON.parse(row.route_geojson);
    if (geoJson.type === 'LineString' && geoJson.coordinates) {
      route = geoJson.coordinates.map((coord: [number, number]) => ({
        longitude: coord[0],
        latitude: coord[1]
      }));
    }
  }

  return {
    ride_id: row.ride_id,
    user_id: row.user_id,
    start_location: {
      latitude: row.start_lat,
      longitude: row.start_lng
    },
    end_location: row.end_lat && row.end_lng ? {
      latitude: row.end_lat,
      longitude: row.end_lng
    } : undefined,
    route: route,
    distance: row.distance,
    duration: row.duration,
    avg_speed: row.avg_speed,
    max_speed: row.max_speed,
    xp_earned: row.xp_earned,
    weather_conditions: row.weather_conditions,
    is_public: row.is_public,
    created_at: row.created_at
  };
};

/**
 * Supprimer un trajet
 */
export const deleteRide = async (rideId: string, userId: string): Promise<boolean> => {
  const query = `
    DELETE FROM rides
    WHERE ride_id = $1 AND user_id = $2
    RETURNING ride_id
  `;

  const result = await pool.query(query, [rideId, userId]);
  return result.rowCount ? result.rowCount > 0 : false;
};
