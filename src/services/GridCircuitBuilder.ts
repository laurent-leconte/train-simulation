import { nanoid } from 'nanoid';
import { Vector2D } from '@/core/geometry/Vector2D';
import { RailOrientation } from '@/types';
import {
  TrackNode,
  TrackSegment,
  StraightGeometry,
  CurveGeometry,
  Switch,
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
   * Remove a segment and clean up all references
   * - Removes segment from connected nodes
   * - Deletes orphaned nodes
   * - Deletes switches that reference this segment
   */
  static removeSegment(
    segmentId: string,
    segments: Map<string, TrackSegment>,
    nodes: Map<string, TrackNode>,
    switches: Map<string, Switch>
  ): void {
    const segment = segments.get(segmentId);
    if (!segment) return;

    // Remove segment from start node's connections
    const startNode = nodes.get(segment.startNode);
    if (startNode) {
      startNode.connectedSegments = startNode.connectedSegments.filter(
        (id) => id !== segmentId
      );
      this.updateNodeType(startNode);
      // Delete orphaned nodes
      if (startNode.connectedSegments.length === 0) {
        nodes.delete(startNode.id);
      }
    }

    // Remove segment from end node's connections
    const endNode = nodes.get(segment.endNode);
    if (endNode) {
      endNode.connectedSegments = endNode.connectedSegments.filter(
        (id) => id !== segmentId
      );
      this.updateNodeType(endNode);
      // Delete orphaned nodes
      if (endNode.connectedSegments.length === 0) {
        nodes.delete(endNode.id);
      }
    }

    // Delete switches that reference this segment
    const switchesToDelete: string[] = [];
    for (const [switchId, sw] of switches) {
      if (
        sw.incomingTrack === segmentId ||
        sw.outgoingTracks.includes(segmentId)
      ) {
        switchesToDelete.push(switchId);
      }
    }
    for (const switchId of switchesToDelete) {
      switches.delete(switchId);
    }

    // Delete the segment
    segments.delete(segmentId);
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
   * Check if a track with the given orientation would conflict with existing tracks
   *
   * Two tracks in the same cell conflict if:
   * 1. They have the exact same orientation (duplicate)
   * 2. They share an edge BUT would create a crossing instead of a junction
   *    (i.e., horizontal + vertical = crossing, not junction)
   *
   * Two tracks that share an edge AND form a junction are allowed:
   * - horizontal + curve-ne (share east edge) = Y-junction at east
   * - vertical + curve-ne (share north edge) = Y-junction at north
   */
  static trackWouldConflict(
    gridX: number,
    gridY: number,
    orientation: RailOrientation,
    gridSize: number,
    segments: Map<string, TrackSegment>
  ): boolean {
    // Check existing tracks in the same cell
    for (const segment of segments.values()) {
      if (segment.gridX === gridX && segment.gridY === gridY) {
        // Exact same orientation = duplicate, always conflict
        if (segment.orientation === orientation) {
          return true;
        }

        // Check if they form a crossing (no shared edge = crossing through center)
        const newEdges = this.getEdgesForOrientation(orientation);
        const existingEdges = this.getEdgesForOrientation(segment.orientation);

        const sharedEdges = newEdges.filter(e => existingEdges.includes(e));

        // If no shared edges, it's a crossing (horizontal + vertical)
        // We'll allow crossings for now, but they don't form junctions
        if (sharedEdges.length === 0) {
          // Allow crossings - they're separate tracks that happen to be in same cell
          continue;
        }

        // If they share exactly one edge, it's a valid Y-junction
        // The tracks will connect at the shared node
        if (sharedEdges.length === 1) {
          continue; // Allow - this creates a junction
        }

        // If they share two edges, they're essentially the same track (shouldn't happen with different orientations)
        if (sharedEdges.length === 2) {
          return true; // Conflict
        }
      }
    }

    return false; // No conflict
  }

  /**
   * Get the edges of a cell that a track orientation uses
   */
  static getEdgesForOrientation(orientation: RailOrientation): Array<'north' | 'south' | 'east' | 'west'> {
    switch (orientation) {
      case 'horizontal':
        return ['west', 'east'];
      case 'vertical':
        return ['north', 'south'];
      case 'curve-ne':
        return ['north', 'east'];
      case 'curve-es':
        return ['south', 'east'];
      case 'curve-sw':
        return ['south', 'west'];
      case 'curve-wn':
        return ['north', 'west'];
    }
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

  /**
   * Find contiguous track segments for station placement (up to 3 cells)
   * Returns segments in order along the track
   */
  static findContiguousSegments(
    startSegment: TrackSegment,
    segments: Map<string, TrackSegment>,
    nodes: Map<string, TrackNode>,
    maxCount: number = 3
  ): string[] {
    const result: string[] = [startSegment.id];
    const visited = new Set<string>([startSegment.id]);

    // Traverse backward from start node
    const backwardSegments: string[] = [];
    let currentSegmentId = startSegment.id;
    let currentNodeId = startSegment.startNode;

    while (backwardSegments.length < maxCount - 1) {
      const node = nodes.get(currentNodeId);
      if (!node) break;

      // Find connected segment (not current, not visited)
      let nextSegmentId: string | null = null;
      for (const segId of node.connectedSegments) {
        if (!visited.has(segId)) {
          const seg = segments.get(segId);
          if (seg && this.areSegmentsCompatibleForStation(startSegment, seg)) {
            nextSegmentId = segId;
            break;
          }
        }
      }

      if (!nextSegmentId) break;

      const nextSegment = segments.get(nextSegmentId)!;
      backwardSegments.unshift(nextSegmentId);
      visited.add(nextSegmentId);

      // Move to the other end of this segment
      currentNodeId = nextSegment.startNode === currentNodeId
        ? nextSegment.endNode
        : nextSegment.startNode;
    }

    // Traverse forward from end node
    const forwardSegments: string[] = [];
    currentSegmentId = startSegment.id;
    currentNodeId = startSegment.endNode;

    while (forwardSegments.length < maxCount - 1 - backwardSegments.length) {
      const node = nodes.get(currentNodeId);
      if (!node) break;

      // Find connected segment (not current, not visited)
      let nextSegmentId: string | null = null;
      for (const segId of node.connectedSegments) {
        if (!visited.has(segId)) {
          const seg = segments.get(segId);
          if (seg && this.areSegmentsCompatibleForStation(startSegment, seg)) {
            nextSegmentId = segId;
            break;
          }
        }
      }

      if (!nextSegmentId) break;

      const nextSegment = segments.get(nextSegmentId)!;
      forwardSegments.push(nextSegmentId);
      visited.add(nextSegmentId);

      // Move to the other end of this segment
      currentNodeId = nextSegment.startNode === currentNodeId
        ? nextSegment.endNode
        : nextSegment.startNode;
    }

    // Combine: backward + start + forward
    return [...backwardSegments, ...result, ...forwardSegments].slice(0, maxCount);
  }

  /**
   * Check if two segments are compatible for forming a station
   * (same orientation or both straight tracks aligned)
   */
  static areSegmentsCompatibleForStation(
    seg1: TrackSegment,
    seg2: TrackSegment
  ): boolean {
    // Same orientation is always compatible
    if (seg1.orientation === seg2.orientation) return true;

    // Only straight tracks (horizontal/vertical) can form stations
    const straightOrientations = ['horizontal', 'vertical'];
    if (!straightOrientations.includes(seg1.orientation)) return false;
    if (!straightOrientations.includes(seg2.orientation)) return false;

    // Different straight orientations are not compatible
    return false;
  }

  /**
   * Determine which side of the track a point is on
   */
  static getSideOfTrack(
    worldPos: Vector2D,
    segment: TrackSegment
  ): 'left' | 'right' {
    const start = segment.geometry.start;
    const end = segment.geometry.end;

    // Direction vector from start to end
    const direction = new Vector2D(end.x - start.x, end.y - start.y);

    // Vector from start to the point
    const toPoint = new Vector2D(worldPos.x - start.x, worldPos.y - start.y);

    // Cross product (2D): direction.x * toPoint.y - direction.y * toPoint.x
    // Positive = left side, Negative = right side
    const cross = direction.x * toPoint.y - direction.y * toPoint.x;

    return cross > 0 ? 'left' : 'right';
  }
}
