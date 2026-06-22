import { pool } from '../config/database';

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

  const params: any[] = [];
  const add = (value: any): string => {
    params.push(value);
    return `$${params.length}`;
  };

  const startSql = `ST_SetSRID(ST_MakePoint(${add(start_location.longitude)}, ${add(start_location.latitude)}), 4326)::geography`;

  const endSql = end_location
    ? `ST_SetSRID(ST_MakePoint(${add(end_location.longitude)}, ${add(end_location.latitude)}), 4326)::geography`
    : 'NULL';

  let routeSql = 'NULL';
  if (route.length > 0) {
    const lineString = `LINESTRING(${route.map(c => `${c.longitude} ${c.latitude}`).join(', ')})`;
    routeSql = `ST_GeomFromText(${add(lineString)}, 4326)::geography`;
  }

  const query = `
    INSERT INTO rides (
      user_id, start_location, end_location, route,
      distance, duration, avg_speed, max_speed, is_public
    )
    VALUES (
      ${add(user_id)},
      ${startSql},
      ${endSql},
      ${routeSql},
      ${add(distance)},
      ${add(duration)},
      ${add(avg_speed ?? null)},
      ${add(max_speed ?? null)},
      ${add(is_public)}
    )
    RETURNING
      ride_id,
      user_id,
      ST_Y(start_location::geometry) as start_lat,
      ST_X(start_location::geometry) as start_lng,
      ST_Y(end_location::geometry)   as end_lat,
      ST_X(end_location::geometry)   as end_lng,
      distance, duration, avg_speed, max_speed, xp_earned, is_public, created_at
  `;

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

export const deleteRide = async (rideId: string, userId: string): Promise<boolean> => {
  const query = `
    DELETE FROM rides
    WHERE ride_id = $1 AND user_id = $2
    RETURNING ride_id
  `;

  const result = await pool.query(query, [rideId, userId]);
  return result.rowCount ? result.rowCount > 0 : false;
};
