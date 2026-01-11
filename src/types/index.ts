import { Vector2D } from '@/core/geometry/Vector2D';

/**
 * Common types used throughout the application
 */

// Viewport state
export interface ViewportState {
  zoom: number;
  pan: Vector2D;
}

// Rail orientation types
export type RailOrientation =
  | 'horizontal'  // East-West
  | 'vertical'    // North-South
  | 'curve-ne'    // North-East (bottom-left to top-right)
  | 'curve-es'    // East-South (top-left to bottom-right)
  | 'curve-sw'    // South-West (top-right to bottom-left)
  | 'curve-wn';   // West-North (bottom-right to top-left)

// Tool types
export type ToolType =
  | { type: 'select' }
  | { type: 'track'; orientation: RailOrientation }
  | { type: 'switch' }
  | { type: 'station' }
  | { type: 'signal' }
  | { type: 'train' }
  | { type: 'delete' };

// Editor mode
export type EditorMode = 'edit' | 'simulate';

// Signal states
export type SignalState = 'red' | 'yellow' | 'green';
