import { pool } from '../config/database';

export interface POI {
  poi_id: string;
  name: string;
  type: 'col' | 'route_panoramique' | 'virage' | 'spot_photo' | 'monument' | 'autre';
  description: string;
  location: {
    latitude: number;
    longitude: number;
  };
  rating: number;
  image_url?: string;
  created_by?: string;
  is_verified: boolean;
  created_at: Date;
  distance_meters?: number;
  visited?: boolean;
  visit_date?: Date;
}

export interface VisitedPOI {
  poi_id: string;
  ride_id: string;
  visited_at: Date;
}

export const getAllPOIs = async (): Promise<POI[]> => {
  const query = `
    SELECT
      poi_id,
      name,
      type,
      description,
      ST_Y(location::geometry) as latitude,
      ST_X(location::geometry) as longitude,
      rating,
      image_url,
      created_by,
      is_verified,
      created_at
    FROM pois
    ORDER BY is_verified DESC, rating DESC
  `;

  const result = await pool.query(query);

  return result.rows.map(row => ({
    poi_id: row.poi_id,
    name: row.name,
    type: row.type,
    description: row.description,
    location: {
      latitude: row.latitude,
      longitude: row.longitude
    },
    rating: row.rating,
    image_url: row.image_url,
    created_by: row.created_by,
    is_verified: row.is_verified,
    created_at: row.created_at
  }));
};

export const getNearbyPOIs = async (
  latitude: number,
  longitude: number,
  radius: number = 50000,
  userId?: string
): Promise<POI[]> => {
  const query = `
    SELECT
      p.poi_id,
      p.name,
      p.type,
      p.description,
      ST_Y(p.location::geometry) as latitude,
      ST_X(p.location::geometry) as longitude,
      p.rating,
      p.image_url,
      p.created_by,
      p.is_verified,
      p.created_at,
      ST_Distance(
        p.location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) as distance_meters,
      ${userId ? `
        CASE WHEN rp.poi_id IS NOT NULL THEN true ELSE false END as visited,
        rp.visited_at
      ` : 'false as visited, NULL as visited_at'}
    FROM pois p
    ${userId ? `
      LEFT JOIN (
        SELECT DISTINCT ON (poi_id) poi_id, visited_at
        FROM ride_poi
        WHERE ride_id IN (SELECT ride_id FROM rides WHERE user_id = $4)
        ORDER BY poi_id, visited_at DESC
      ) rp ON p.poi_id = rp.poi_id
    ` : ''}
    WHERE ST_DWithin(
      p.location,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
    ORDER BY distance_meters ASC
  `;

  const params = userId
    ? [longitude, latitude, radius, userId]
    : [longitude, latitude, radius];

  const result = await pool.query(query, params);

  return result.rows.map(row => ({
    poi_id: row.poi_id,
    name: row.name,
    type: row.type,
    description: row.description,
    location: {
      latitude: row.latitude,
      longitude: row.longitude
    },
    rating: row.rating,
    image_url: row.image_url,
    created_by: row.created_by,
    is_verified: row.is_verified,
    created_at: row.created_at,
    distance_meters: row.distance_meters,
    visited: row.visited,
    visit_date: row.visited_at
  }));
};

export const checkPOIExists = async (poiId: string): Promise<boolean> => {
  const result = await pool.query(
    'SELECT poi_id FROM pois WHERE poi_id = $1',
    [poiId]
  );
  return result.rows.length > 0;
};

export const checkRideBelongsToUser = async (rideId: string, userId: string): Promise<boolean> => {
  const result = await pool.query(
    'SELECT ride_id FROM rides WHERE ride_id = $1 AND user_id = $2',
    [rideId, userId]
  );
  return result.rows.length > 0;
};

export const insertPOIVisit = async (rideId: string, poiId: string): Promise<void> => {
  await pool.query(
    `INSERT INTO ride_poi (ride_id, poi_id, visited_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (ride_id, poi_id) DO NOTHING`,
    [rideId, poiId]
  );
};

export const getVisitedPOIs = async (userId: string): Promise<POI[]> => {
  const query = `
    SELECT DISTINCT ON (p.poi_id)
      p.poi_id,
      p.name,
      p.type,
      p.description,
      ST_Y(p.location::geometry) as latitude,
      ST_X(p.location::geometry) as longitude,
      p.rating,
      p.image_url,
      p.created_by,
      p.is_verified,
      p.created_at,
      true as visited,
      rp.visited_at as visit_date
    FROM pois p
    INNER JOIN ride_poi rp ON p.poi_id = rp.poi_id
    INNER JOIN rides r ON rp.ride_id = r.ride_id
    WHERE r.user_id = $1
    ORDER BY p.poi_id, rp.visited_at DESC
  `;

  const result = await pool.query(query, [userId]);

  return result.rows.map(row => ({
    poi_id: row.poi_id,
    name: row.name,
    type: row.type,
    description: row.description,
    location: {
      latitude: row.latitude,
      longitude: row.longitude
    },
    rating: row.rating,
    image_url: row.image_url,
    created_by: row.created_by,
    is_verified: row.is_verified,
    created_at: row.created_at,
    visited: row.visited,
    visit_date: row.visit_date
  }));
};

export const createPOI = async (
  name: string,
  type: string,
  description: string,
  latitude: number,
  longitude: number,
  rating: number,
  imageUrl?: string,
  createdBy?: string
): Promise<POI> => {
  const query = `
    INSERT INTO pois (
      name,
      type,
      description,
      location,
      rating,
      image_url,
      created_by,
      is_verified
    )
    VALUES (
      $1, $2, $3,
      ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
      $6, $7, $8,
      ${createdBy ? 'false' : 'true'}
    )
    RETURNING
      poi_id,
      name,
      type,
      description,
      ST_Y(location::geometry) as latitude,
      ST_X(location::geometry) as longitude,
      rating,
      image_url,
      created_by,
      is_verified,
      created_at
  `;

  const result = await pool.query(query, [
    name,
    type,
    description,
    longitude,
    latitude,
    rating,
    imageUrl || null,
    createdBy || null
  ]);

  const row = result.rows[0];

  return {
    poi_id: row.poi_id,
    name: row.name,
    type: row.type,
    description: row.description,
    location: {
      latitude: row.latitude,
      longitude: row.longitude
    },
    rating: row.rating,
    image_url: row.image_url,
    created_by: row.created_by,
    is_verified: row.is_verified,
    created_at: row.created_at
  };
};
