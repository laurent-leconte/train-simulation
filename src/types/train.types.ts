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
 * Carriage visual position (for rendering only)
 */
export interface CarriagePosition {
  worldPosition: Vector2D;
  direction: Vector2D;
}

/**
 * Historical position snapshot for debugging
 */
export interface PositionSnapshot {
  segmentId: string;
  distance: number;
  worldX: number;
  worldY: number;
  timestamp: number;
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
  length: number; // Locomotive length in pixels
  width: number; // Train width in pixels
  color: string;

  // Carriages
  carriageCount: number; // Number of carriages behind locomotive
  carriageLength: number; // Length of each carriage
  carriageGap: number; // Gap between carriages
  carriagePositions: CarriagePosition[]; // Calculated positions for rendering

  // Control
  isRunning: boolean; // true = moving, false = stopped

  // Station stops
  stoppedAtStation: string | null; // ID of station where stopped, null if not stopped
  stationStopTimeRemaining: number; // Time remaining at current station (seconds)
  approachingStation: string | null; // ID of station we're approaching (pulling into)
  stationStopTargetSegmentId: string | null; // Segment where we should stop
  stationStopTargetDistance: number; // Distance along that segment where we should stop

  // Debug
  positionHistory: PositionSnapshot[]; // Last N positions for debugging
}

/**
 * Default train settings
 */
export const DEFAULT_TRAIN_SETTINGS = {
  speed: 100, // pixels per second
  length: 40,
  width: 12,
  color: '#ef4444', // red
  carriageCount: 3,
  carriageLength: 30,
  carriageGap: 8,
  carriagePositions: [] as CarriagePosition[],
  stoppedAtStation: null as string | null,
  stationStopTimeRemaining: 0,
  approachingStation: null as string | null,
  stationStopTargetSegmentId: null as string | null,
  stationStopTargetDistance: 0,
  positionHistory: [] as PositionSnapshot[],
};
