import { Vector2D } from '@/core/geometry/Vector2D';

/**
 * Position of train along the track
 */
export interface TrainPosition {
  segmentId: string; // Current track segment
  distance: number; // Distance along segment (0 to segment.length)
  worldPosition: Vector2D; // Calculated 2D position
  direction: Vector2D; // Direction vector (normalized tangent)
  reversed: boolean; // True if traversing segment backwards (from end to start)
}

/**
 * Train entity
 */
export interface Train {
  id: string;
  position: TrainPosition;
  velocity: number; // Current velocity in pixels/second

  // Physical properties
  speed: number; // Constant speed when running (pixels/second)

  // Visual properties
  length: number; // Train length in pixels
  width: number; // Train width in pixels
  color: string;

  // Control
  isRunning: boolean; // true = moving, false = stopped
}

/**
 * Default train settings
 */
export const DEFAULT_TRAIN_SETTINGS = {
  speed: 100, // pixels per second
  length: 40,
  width: 12,
  color: '#ef4444', // red
};
