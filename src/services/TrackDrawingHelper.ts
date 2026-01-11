import { Vector2D } from '@/core/geometry/Vector2D';
import { RailOrientation } from '@/types';

export type Side = 'north' | 'south' | 'east' | 'west';

/**
 * Helper utilities for drag-based track drawing
 */
export class TrackDrawingHelper {
  /**
   * Detect which side of a grid cell the mouse position is closest to
   */
  static detectSide(
    worldPos: Vector2D,
    gridX: number,
    gridY: number,
    gridSize: number
  ): Side {
    // Calculate relative position within cell (0 to 1)
    const relativeX = (worldPos.x - gridX * gridSize) / gridSize;
    const relativeY = (worldPos.y - gridY * gridSize) / gridSize;

    // Calculate distance to each edge
    const distToNorth = relativeY;
    const distToSouth = 1 - relativeY;
    const distToWest = relativeX;
    const distToEast = 1 - relativeX;

    // Find closest edge
    const minDist = Math.min(distToNorth, distToSouth, distToWest, distToEast);

    if (minDist === distToNorth) return 'north';
    if (minDist === distToSouth) return 'south';
    if (minDist === distToWest) return 'west';
    return 'east';
  }

  /**
   * Determine track orientation based on entry and exit sides
   */
  static getTrackOrientation(
    entrySide: Side,
    exitSide: Side
  ): RailOrientation | null {
    // Same side = invalid
    if (entrySide === exitSide) return null;

    const key = `${entrySide}-${exitSide}`;

    const mapping: Record<string, RailOrientation> = {
      'west-east': 'horizontal',
      'east-west': 'horizontal',
      'north-south': 'vertical',
      'south-north': 'vertical',
      'north-east': 'curve-ne',
      'east-north': 'curve-ne',
      'east-south': 'curve-es',
      'south-east': 'curve-es',
      'south-west': 'curve-sw',
      'west-south': 'curve-sw',
      'west-north': 'curve-wn',
      'north-west': 'curve-wn',
    };

    return mapping[key] || null;
  }

  /**
   * Get the opposite side of a given side
   */
  static getOppositeSide(side: Side): Side {
    const opposites: Record<Side, Side> = {
      north: 'south',
      south: 'north',
      east: 'west',
      west: 'east',
    };
    return opposites[side];
  }

  /**
   * Check if two grid cells are adjacent (including diagonally)
   */
  static areAdjacent(
    cell1: { gridX: number; gridY: number },
    cell2: { gridX: number; gridY: number }
  ): boolean {
    return (
      Math.abs(cell1.gridX - cell2.gridX) <= 1 &&
      Math.abs(cell1.gridY - cell2.gridY) <= 1 &&
      !(cell1.gridX === cell2.gridX && cell1.gridY === cell2.gridY)
    );
  }
}
