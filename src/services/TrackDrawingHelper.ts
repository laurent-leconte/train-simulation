import { Vector2D } from '@/core/geometry/Vector2D';
import { RailOrientation, Side } from '@/types';

export { Side };

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

  /**
   * Get all cells between two grid positions using Bresenham's line algorithm.
   * Returns cells in order from start to end (excluding start, including end).
   */
  static getTraversedCells(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ): Array<{ gridX: number; gridY: number }> {
    const cells: Array<{ gridX: number; gridY: number }> = [];

    // If same cell, return empty
    if (fromX === toX && fromY === toY) {
      return cells;
    }

    const dx = Math.abs(toX - fromX);
    const dy = Math.abs(toY - fromY);
    const sx = fromX < toX ? 1 : -1;
    const sy = fromY < toY ? 1 : -1;

    let err = dx - dy;
    let x = fromX;
    let y = fromY;

    while (true) {
      // Move to next cell
      const e2 = 2 * err;

      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }

      cells.push({ gridX: x, gridY: y });

      if (x === toX && y === toY) break;
    }

    return cells;
  }

  /**
   * Determine the exit side when moving from one cell to an adjacent cell.
   * Based purely on the direction of movement.
   */
  static getExitSideFromDirection(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ): Side {
    const dx = toX - fromX;
    const dy = toY - fromY;

    // Prioritize horizontal/vertical movement
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'east' : 'west';
    } else if (Math.abs(dy) > Math.abs(dx)) {
      return dy > 0 ? 'south' : 'north';
    } else {
      // Diagonal - prefer horizontal
      return dx > 0 ? 'east' : 'west';
    }
  }

  /**
   * Determine the entry side when moving from one cell to an adjacent cell.
   * This is the opposite of the exit side from the previous cell.
   */
  static getEntrySideFromDirection(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ): Side {
    const exitSide = this.getExitSideFromDirection(fromX, fromY, toX, toY);
    return this.getOppositeSide(exitSide);
  }
}
