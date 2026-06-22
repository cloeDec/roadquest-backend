import * as poiRepository from '../repositories/poiRepository';
import * as achievementRepository from '../repositories/achievementRepository';
import { POI } from '../repositories/poiRepository';
import { AchievementRow } from '../repositories/achievementRepository';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export const getAllPOIs = async (): Promise<POI[]> => {
  return poiRepository.getAllPOIs();
};

export interface GetNearbyPOIsInput {
  latitude: string | undefined;
  longitude: string | undefined;
  radius?: string;
}

export interface GetNearbyPOIsResult {
  pois: POI[];
  center: { latitude: number; longitude: number };
  radius_meters: number;
}

export const validateAndParseNearbyInput = (input: GetNearbyPOIsInput): {
  lat: number;
  lon: number;
  radiusMeters: number;
} => {
  const { latitude, longitude, radius } = input;

  if (!latitude || !longitude) {
    throw new ValidationError('latitude et longitude sont requis');
  }

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  const radiusMeters = radius ? parseFloat(radius) : 50000;

  if (isNaN(lat) || isNaN(lon) || isNaN(radiusMeters)) {
    throw new ValidationError('latitude, longitude et radius doivent être des nombres valides');
  }

  return { lat, lon, radiusMeters };
};

export const getNearbyPOIs = async (
  latitude: number,
  longitude: number,
  radius: number,
  userId?: string
): Promise<GetNearbyPOIsResult> => {
  const pois = await poiRepository.getNearbyPOIs(latitude, longitude, radius, userId);

  return {
    pois,
    center: { latitude, longitude },
    radius_meters: radius
  };
};

export interface MarkPOIVisitedResult {
  poi_id: string;
  ride_id: string;
  unlocked_achievements: AchievementRow[];
}

export const markPOIAsVisited = async (
  userId: string,
  poiId: string,
  rideId: string
): Promise<MarkPOIVisitedResult> => {
  if (!poiId || !rideId) {
    throw new ValidationError('poiId et rideId sont requis');
  }

  const poiExists = await poiRepository.checkPOIExists(poiId);
  if (!poiExists) {
    throw new NotFoundError('POI ou trajet non trouvé, ou trajet non associé à cet utilisateur');
  }

  const rideOwned = await poiRepository.checkRideBelongsToUser(rideId, userId);
  if (!rideOwned) {
    throw new NotFoundError('POI ou trajet non trouvé, ou trajet non associé à cet utilisateur');
  }

  await poiRepository.insertPOIVisit(rideId, poiId);

  let unlocked_achievements: AchievementRow[] = [];
  try {
    unlocked_achievements = await achievementRepository.checkAndUnlockAchievements(userId);
  } catch (error) {
    console.error('Erreur lors de la vérification des achievements:', error);
  }

  return {
    poi_id: poiId,
    ride_id: rideId,
    unlocked_achievements
  };
};

export const getVisitedPOIs = async (userId: string): Promise<POI[]> => {
  return poiRepository.getVisitedPOIs(userId);
};

export interface CreatePOIInput {
  name: string;
  type: string;
  description: string;
  latitude: number | string;
  longitude: number | string;
  rating?: number | string;
  image_url?: string;
}

const VALID_POI_TYPES = ['col', 'route_panoramique', 'virage', 'spot_photo', 'monument', 'autre'];

export const validateCreatePOIInput = (input: CreatePOIInput): {
  name: string;
  type: string;
  description: string;
  lat: number;
  lon: number;
  rating: number;
  image_url?: string;
} => {
  const { name, type, description, latitude, longitude, rating, image_url } = input;

  if (!name || !type || !description || !latitude || !longitude) {
    throw new ValidationError('name, type, description, latitude et longitude sont requis');
  }

  if (!VALID_POI_TYPES.includes(type)) {
    throw new ValidationError(`type doit être l'un de: ${VALID_POI_TYPES.join(', ')}`);
  }

  const lat = parseFloat(String(latitude));
  const lon = parseFloat(String(longitude));
  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new ValidationError('latitude et longitude doivent être des coordonnées valides');
  }

  const ratingValue = rating !== undefined ? parseFloat(String(rating)) : 3.0;
  if (isNaN(ratingValue) || ratingValue < 0 || ratingValue > 5) {
    throw new ValidationError('rating doit être un nombre entre 0 et 5');
  }

  return { name, type, description, lat, lon, rating: ratingValue, image_url };
};

export const createPOI = async (
  input: CreatePOIInput,
  userId?: string
): Promise<POI> => {
  const validated = validateCreatePOIInput(input);

  return poiRepository.createPOI(
    validated.name,
    validated.type,
    validated.description,
    validated.lat,
    validated.lon,
    validated.rating,
    validated.image_url,
    userId
  );
};
