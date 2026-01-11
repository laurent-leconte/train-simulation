import { nanoid } from 'nanoid';
import { Vector2D } from '@/core/geometry/Vector2D';
import { RailOrientation } from '@/types';
import {
  TrackNode,
  TrackSegment,
  StraightGeometry,
  CurveGeometry,
} from '@/types/circuit.types';

/**
 * Grid-based circuit builder for simplified track construction
 * Each rail occupies exactly one grid cell
 */
export class GridCircuitBuilder {
  /**
   * Create a track segment at grid position with specified orientation
   */
  static createGridTrack(
    gridX: number,
    gridY: number,
    orientation: RailOrientation,
    gridSize: number,
    nodes: Map<string, TrackNode>
  ): { segment: TrackSegment; startNode: TrackNode; endNode: TrackNode } {
    // Calculate world position from grid
    const worldX = gridX * gridSize;
    const worldY = gridY * gridSize;

    // Determine geometry based on orientation
    const { geometry, startOffset, endOffset, type } = this.getGeometryForOrientation(
      orientation,
      worldX,
      worldY,
      gridSize
    );

    // Create nodes at start and end positions
    const startPos = new Vector2D(worldX + startOffset.x, worldY + startOffset.y);
    const endPos = new Vector2D(worldX + endOffset.x, worldY + endOffset.y);

    const startNode = this.findOrCreateNode(startPos, nodes);
    const endNode = this.findOrCreateNode(endPos, nodes);

    // Don't create segment if start and end are the same
    if (startNode.id === endNode.id) {
      throw new Error('Cannot create segment: start and end nodes are the same');
    }

    // Calculate length
    const length = this.calculateLength(orientation, gridSize);

    const segment: TrackSegment = {
      id: nanoid(),
      type,
      orientation,
      startNode: startNode.id,
      endNode: endNode.id,
      geometry,
      length,
      gridX,
      gridY,
    };

    // Update node connections
    startNode.connectedSegments.push(segment.id);
    endNode.connectedSegments.push(segment.id);

    // Update node types
    this.updateNodeType(startNode);
    this.updateNodeType(endNode);

    return { segment, startNode, endNode };
  }

  /**
   * Get geometry configuration for each orientation
   */
  static getGeometryForOrientation(
    orientation: RailOrientation,
    worldX: number,
    worldY: number,
    gridSize: number
  ): {
    geometry: StraightGeometry | CurveGeometry;
    startOffset: Vector2D;
    endOffset: Vector2D;
    type: 'straight' | 'curve';
  } {
    const halfGrid = gridSize / 2;

    switch (orientation) {
      case 'horizontal': {
        // West to East (left to right)
        const start = new Vector2D(worldX, worldY + halfGrid);
        const end = new Vector2D(worldX + gridSize, worldY + halfGrid);
        return {
          geometry: { type: 'straight', start, end },
          startOffset: new Vector2D(0, halfGrid),
          endOffset: new Vector2D(gridSize, halfGrid),
          type: 'straight',
        };
      }

      case 'vertical': {
        // North to South (top to bottom)
        const start = new Vector2D(worldX + halfGrid, worldY);
        const end = new Vector2D(worldX + halfGrid, worldY + gridSize);
        return {
          geometry: { type: 'straight', start, end },
          startOffset: new Vector2D(halfGrid, 0),
          endOffset: new Vector2D(halfGrid, gridSize),
          type: 'straight',
        };
      }

      case 'curve-ne': {
        // North to East (top to right) - quarter circle
        // Center at top-right corner (worldX + gridSize, worldY)
        const start = new Vector2D(worldX + halfGrid, worldY);
        const end = new Vector2D(worldX + gridSize, worldY + halfGrid);
        const kappa = 0.5522847498;
        const radius = halfGrid;
        const center = new Vector2D(worldX + gridSize, worldY);

        // Arc from West to South around center
        const controlPoint1 = new Vector2D(
          start.x,
          start.y + radius * kappa
        );
        const controlPoint2 = new Vector2D(
          end.x - radius * kappa,
          end.y
        );

        return {
          geometry: {
            type: 'curve',
            start,
            end,
            controlPoint1,
            controlPoint2,
            radius,
            arc: Math.PI / 2,
          },
          startOffset: new Vector2D(halfGrid, 0),
          endOffset: new Vector2D(gridSize, halfGrid),
          type: 'curve',
        };
      }

      case 'curve-es': {
        // South to East (bottom to right) - quarter circle
        // Center at bottom-right corner (worldX + gridSize, worldY + gridSize)
        const start = new Vector2D(worldX + halfGrid, worldY + gridSize);
        const end = new Vector2D(worldX + gridSize, worldY + halfGrid);
        const kappa = 0.5522847498;
        const radius = halfGrid;
        const center = new Vector2D(worldX + gridSize, worldY + gridSize);

        // Arc from West to North around center
        // CP1: move from start towards center, perpendicular offset
        const controlPoint1 = new Vector2D(
          start.x,
          start.y - radius * kappa
        );
        // CP2: move from end towards center, perpendicular offset
        const controlPoint2 = new Vector2D(
          end.x - radius * kappa,
          end.y
        );

        return {
          geometry: {
            type: 'curve',
            start,
            end,
            controlPoint1,
            controlPoint2,
            radius,
            arc: Math.PI / 2,
          },
          startOffset: new Vector2D(halfGrid, gridSize),
          endOffset: new Vector2D(gridSize, halfGrid),
          type: 'curve',
        };
      }

      case 'curve-sw': {
        // South to West (bottom to left) - quarter circle
        // Center at bottom-left corner (worldX, worldY + gridSize)
        const start = new Vector2D(worldX + halfGrid, worldY + gridSize);
        const end = new Vector2D(worldX, worldY + halfGrid);
        const kappa = 0.5522847498;
        const radius = halfGrid;
        const center = new Vector2D(worldX, worldY + gridSize);

        // Arc from East to North around center
        const controlPoint1 = new Vector2D(
          start.x,
          start.y - radius * kappa
        );
        const controlPoint2 = new Vector2D(
          end.x + radius * kappa,
          end.y
        );

        return {
          geometry: {
            type: 'curve',
            start,
            end,
            controlPoint1,
            controlPoint2,
            radius,
            arc: Math.PI / 2,
          },
          startOffset: new Vector2D(halfGrid, gridSize),
          endOffset: new Vector2D(0, halfGrid),
          type: 'curve',
        };
      }

      case 'curve-wn': {
        // North to West (top to left) - quarter circle
        // Center at top-left corner (worldX, worldY)
        const start = new Vector2D(worldX + halfGrid, worldY);
        const end = new Vector2D(worldX, worldY + halfGrid);
        const kappa = 0.5522847498;
        const radius = halfGrid;
        const center = new Vector2D(worldX, worldY);

        // Arc from East to South around center
        const controlPoint1 = new Vector2D(
          start.x,
          start.y + radius * kappa
        );
        const controlPoint2 = new Vector2D(
          end.x + radius * kappa,
          end.y
        );

        return {
          geometry: {
            type: 'curve',
            start,
            end,
            controlPoint1,
            controlPoint2,
            radius,
            arc: Math.PI / 2,
          },
          startOffset: new Vector2D(halfGrid, 0),
          endOffset: new Vector2D(0, halfGrid),
          type: 'curve',
        };
      }
    }
  }

  /**
   * Calculate track length based on orientation
   */
  private static calculateLength(orientation: RailOrientation, gridSize: number): number {
    if (orientation === 'horizontal' || orientation === 'vertical') {
      return gridSize;
    } else {
      // Quarter circle: circumference = 2πr, so quarter = (2πr)/4 = πr/2
      const radius = gridSize / 2;
      return (Math.PI * radius) / 2;
    }
  }

  /**
   * Find or create node at position
   */
  private static findOrCreateNode(
    position: Vector2D,
    nodes: Map<string, TrackNode>
  ): TrackNode {
    const threshold = 5; // Small threshold for node snapping

    // Find existing node nearby
    for (const node of nodes.values()) {
      if (position.distanceTo(node.position) <= threshold) {
        return node;
      }
    }

    // Create new node
    const newNode: TrackNode = {
      id: nanoid(),
      position: position,
      connectedSegments: [],
      type: 'simple',
    };

    nodes.set(newNode.id, newNode);
    return newNode;
  }

  /**
   * Update node type based on connections
   */
  private static updateNodeType(node: TrackNode): void {
    const count = node.connectedSegments.length;
    if (count <= 2) {
      node.type = 'simple';
    } else {
      node.type = 'junction';
    }
  }

  /**
   * Check if a track already exists at grid position
   */
  static trackExistsAt(
    gridX: number,
    gridY: number,
    segments: Map<string, TrackSegment>
  ): boolean {
    for (const segment of segments.values()) {
      if (segment.gridX === gridX && segment.gridY === gridY) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get track at grid position
   */
  static getTrackAt(
    gridX: number,
    gridY: number,
    segments: Map<string, TrackSegment>
  ): TrackSegment | null {
    for (const segment of segments.values()) {
      if (segment.gridX === gridX && segment.gridY === gridY) {
        return segment;
      }
    }
    return null;
  }

  /**
   * Convert world position to grid coordinates
   */
  static worldToGrid(worldPos: Vector2D, gridSize: number): { gridX: number; gridY: number } {
    return {
      gridX: Math.floor(worldPos.x / gridSize),
      gridY: Math.floor(worldPos.y / gridSize),
    };
  }

  /**
   * Convert grid coordinates to world position (center of grid cell)
   */
  static gridToWorld(gridX: number, gridY: number, gridSize: number): Vector2D {
    return new Vector2D(
      gridX * gridSize + gridSize / 2,
      gridY * gridSize + gridSize / 2
    );
  }
}
