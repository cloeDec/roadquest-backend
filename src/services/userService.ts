import * as userRepository from '../repositories/userRepository';
import { User, UserStatistics } from '../repositories/userRepository';

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

export interface UserProfile {
  user_id: string;
  email: string;
  username: string;
  avatar_url?: string;
  xp: number;
  level: number;
  motorcycle?: {
    brand: string;
    model: string;
    year: number;
    photo_url?: string;
  };
  total_distance: number;
  total_trips: number;
  regions_explored: number;
  pois_discovered: number;
  created_at: Date;
}

export const getProfile = async (userId: string): Promise<UserProfile> => {
  const user = await userRepository.findUserById(userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const stats = await userRepository.getUserStatistics(userId);

  return {
    user_id: user.user_id,
    email: user.email,
    username: user.username,
    avatar_url: user.avatar_url,
    xp: user.xp,
    level: user.level,
    motorcycle: user.motorcycle_brand ? {
      brand: user.motorcycle_brand,
      model: user.motorcycle_model!,
      year: user.motorcycle_year!,
      photo_url: user.motorcycle_photo_url,
    } : undefined,
    total_distance: stats?.total_distance || 0,
    total_trips: stats?.total_trips || 0,
    regions_explored: stats?.regions_explored || 0,
    pois_discovered: stats?.pois_discovered || 0,
    created_at: user.created_at,
  };
};

export interface UpdateMotorcycleInput {
  brand: string;
  model: string;
  year: number;
  photo_url?: string;
}

export interface MotorcycleInfo {
  brand: string;
  model: string;
  year: number;
  photo_url?: string;
}

export const validateMotorcycleInput = (input: UpdateMotorcycleInput): void => {
  const { brand, model, year } = input;

  if (!brand || !model || !year) {
    throw new ValidationError('Missing required fields: brand, model, year');
  }

  if (year < 1900 || year > new Date().getFullYear() + 1) {
    throw new ValidationError('Invalid year');
  }
};

export const updateMotorcycle = async (
  userId: string,
  input: UpdateMotorcycleInput
): Promise<MotorcycleInfo> => {
  validateMotorcycleInput(input);

  const success = await userRepository.updateUserMotorcycle(
    userId,
    input.brand,
    input.model,
    input.year,
    input.photo_url
  );

  if (!success) {
    throw new NotFoundError('User not found');
  }

  return {
    brand: input.brand,
    model: input.model,
    year: input.year,
    photo_url: input.photo_url,
  };
};

export const getStatistics = async (userId: string): Promise<UserStatistics> => {
  const stats = await userRepository.getUserStatistics(userId);

  if (!stats) {
    throw new NotFoundError('User not found');
  }

  return stats;
};
