import * as rideRepository from '../repositories/rideRepository';
import * as achievementRepository from '../repositories/achievementRepository';
import { Ride, CreateRideData, Coordinate } from '../repositories/rideRepository';
import { AchievementRow } from '../repositories/achievementRepository';

export interface CreateRideInput {
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

export interface CreateRideResult {
  ride: Ride;
  unlocked_achievements: AchievementRow[];
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const validateCreateRideInput = (input: CreateRideInput): void => {
  const { start_location, route, distance, duration } = input;

  if (!start_location || !start_location.latitude || !start_location.longitude) {
    throw new ValidationError('start_location est requis avec latitude et longitude');
  }

  if (!route || !Array.isArray(route)) {
    throw new ValidationError('route est requis et doit être un tableau');
  }

  if (typeof distance !== 'number' || distance < 0) {
    throw new ValidationError('distance est requis et doit être un nombre positif');
  }

  if (typeof duration !== 'number' || duration < 0) {
    throw new ValidationError('duration est requis et doit être un nombre positif');
  }
};

export const createRide = async (
  userId: string,
  input: CreateRideInput
): Promise<CreateRideResult> => {
  validateCreateRideInput(input);

  const rideData: CreateRideData = {
    user_id: userId,
    start_location: input.start_location,
    end_location: input.end_location,
    route: input.route,
    distance: input.distance,
    duration: input.duration,
    avg_speed: input.avg_speed,
    max_speed: input.max_speed,
    destination_name: input.destination_name,
    is_public: input.is_public !== undefined ? input.is_public : true
  };

  const ride = await rideRepository.createRide(rideData);

  let unlocked_achievements: AchievementRow[] = [];
  try {
    unlocked_achievements = await achievementRepository.checkAndUnlockAchievements(userId);
  } catch (error) {
    console.error('Erreur lors de la vérification des achievements:', error);
  }

  return { ride, unlocked_achievements };
};

export const getUserRides = async (userId: string): Promise<Ride[]> => {
  return rideRepository.getRidesByUserId(userId);
};

export const getRideById = async (
  rideId: string,
  userId: string
): Promise<Ride | null> => {
  return rideRepository.getRideById(rideId, userId);
};

export const deleteRide = async (
  rideId: string,
  userId: string
): Promise<boolean> => {
  return rideRepository.deleteRide(rideId, userId);
};
