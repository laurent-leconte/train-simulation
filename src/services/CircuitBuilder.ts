import { nanoid } from 'nanoid';
import { Vector2D } from '@/core/geometry/Vector2D';
import {
  TrackNode,
  TrackSegment,
  TrackGeometry,
  StraightGeometry,
  CurveGeometry,
} from '@/types/circuit.types';
import {
  calculateBezierLength,
  createSmoothControlPoint,
  calculateArcAngle,
} from '@/core/geometry/Bezier';

/**
 * Service for building and modifying the circuit
 */
export class CircuitBuilder {
  private static readonly SNAP_THRESHOLD = 15; // pixels (in world space)

  /**
   * Find a node near a given position
   */
  static findNodeNear(
    position: Vector2D,
    nodes: Map<string, TrackNode>,
    threshold: number = CircuitBuilder.SNAP_THRESHOLD
  ): TrackNode | null {
    for (const node of nodes.values()) {
      if (position.distanceTo(node.position) <= threshold) {
        return node;
      }
    }
    return null;
  }

  /**
   * Find or create a node at a given position
   */
  static findOrCreateNode(
    position: Vector2D,
    nodes: Map<string, TrackNode>,
    snapToGrid: boolean = false,
    gridSize: number = 20
  ): TrackNode {
    // Snap to grid if enabled
    const snappedPos = snapToGrid
      ? new Vector2D(
          Math.round(position.x / gridSize) * gridSize,
          Math.round(position.y / gridSize) * gridSize
        )
      : position;

    // Try to find existing node nearby
    const existingNode = this.findNodeNear(snappedPos, nodes);
    if (existingNode) {
      return existingNode;
    }

    // Create new node
    const newNode: TrackNode = {
      id: nanoid(),
      position: snappedPos,
      connectedSegments: [],
      type: 'simple',
    };

    nodes.set(newNode.id, newNode);
    return newNode;
  }

  /**
   * Create a straight track segment
   */
  static createStraightSegment(
    start: Vector2D,
    end: Vector2D,
    nodes: Map<string, TrackNode>,
    snapToGrid: boolean = false,
    gridSize: number = 20
  ): { segment: TrackSegment; startNode: TrackNode; endNode: TrackNode } {
    const startNode = this.findOrCreateNode(start, nodes, snapToGrid, gridSize);
    const endNode = this.findOrCreateNode(end, nodes, snapToGrid, gridSize);

    // Don't create segment if start and end are the same
    if (startNode.id === endNode.id) {
      throw new Error('Cannot create segment: start and end nodes are the same');
    }

    const geometry: StraightGeometry = {
      type: 'straight',
      start: startNode.position,
      end: endNode.position,
    };

    const length = startNode.position.distanceTo(endNode.position);

    const segment: TrackSegment = {
      id: nanoid(),
      type: 'straight',
      startNode: startNode.id,
      endNode: endNode.id,
      geometry,
      length,
    };

    // Update node connections
    startNode.connectedSegments.push(segment.id);
    endNode.connectedSegments.push(segment.id);

    // Update node types if needed
    this.updateNodeType(startNode);
    this.updateNodeType(endNode);

    return { segment, startNode, endNode };
  }

  /**
   * Create a curved track segment (quadratic Bezier)
   */
  static createCurvedSegment(
    start: Vector2D,
    controlPoint: Vector2D,
    end: Vector2D,
    nodes: Map<string, TrackNode>,
    snapToGrid: boolean = false,
    gridSize: number = 20
  ): { segment: TrackSegment; startNode: TrackNode; endNode: TrackNode } {
    const startNode = this.findOrCreateNode(start, nodes, snapToGrid, gridSize);
    const endNode = this.findOrCreateNode(end, nodes, snapToGrid, gridSize);

    // Don't create segment if start and end are the same
    if (startNode.id === endNode.id) {
      throw new Error('Cannot create segment: start and end nodes are the same');
    }

    // Calculate radius (distance from midpoint to control point)
    const midpoint = startNode.position.lerp(endNode.position, 0.5);
    const radius = midpoint.distanceTo(controlPoint);

    const geometry: CurveGeometry = {
      type: 'curve',
      start: startNode.position,
      end: endNode.position,
      controlPoint1: controlPoint,
      radius,
      arc: calculateArcAngle(startNode.position, controlPoint, endNode.position),
    };

    // Calculate length using numerical integration
    const length = calculateBezierLength(
      startNode.position,
      controlPoint,
      endNode.position
    );

    const segment: TrackSegment = {
      id: nanoid(),
      type: 'curve',
      startNode: startNode.id,
      endNode: endNode.id,
      geometry,
      length,
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
   * Create a curved segment with automatic control point calculation
   */
  static createCurvedSegmentAuto(
    start: Vector2D,
    end: Vector2D,
    radius: number,
    nodes: Map<string, TrackNode>,
    snapToGrid: boolean = false,
    gridSize: number = 20
  ): { segment: TrackSegment; startNode: TrackNode; endNode: TrackNode } {
    const controlPoint = createSmoothControlPoint(start, end, radius);
    return this.createCurvedSegment(start, controlPoint, end, nodes, snapToGrid, gridSize);
  }

  /**
   * Update node type based on number of connections
   */
  static updateNodeType(node: TrackNode): void {
    const connectionCount = node.connectedSegments.length;

    if (connectionCount === 0) {
      node.type = 'simple';
    } else if (connectionCount === 1 || connectionCount === 2) {
      node.type = 'simple';
    } else {
      node.type = 'junction';
    }
  }

  /**
   * Remove a segment and clean up orphaned nodes
   */
  static removeSegment(
    segmentId: string,
    segments: Map<string, TrackSegment>,
    nodes: Map<string, TrackNode>
  ): void {
    const segment = segments.get(segmentId);
    if (!segment) return;

    // Remove segment from node connections
    const startNode = nodes.get(segment.startNode);
    const endNode = nodes.get(segment.endNode);

    if (startNode) {
      startNode.connectedSegments = startNode.connectedSegments.filter(
        (id) => id !== segmentId
      );
      this.updateNodeType(startNode);

      // Remove node if orphaned
      if (startNode.connectedSegments.length === 0) {
        nodes.delete(startNode.id);
      }
    }

    if (endNode) {
      endNode.connectedSegments = endNode.connectedSegments.filter(
        (id) => id !== segmentId
      );
      this.updateNodeType(endNode);

      // Remove node if orphaned
      if (endNode.connectedSegments.length === 0) {
        nodes.delete(endNode.id);
      }
    }

    // Remove segment
    segments.delete(segmentId);
  }

  /**
   * Validate if a segment can be created (check for overlaps, etc.)
   */
  static validateSegment(
    start: Vector2D,
    end: Vector2D,
    segments: Map<string, TrackSegment>
  ): boolean {
    // Check minimum length
    const minLength = 20;
    if (start.distanceTo(end) < minLength) {
      return false;
    }

    // TODO: Add more validation (check for overlaps, intersections, etc.)

    return true;
  }

  /**
   * Snap position to grid
   */
  static snapToGrid(position: Vector2D, gridSize: number): Vector2D {
    return new Vector2D(
      Math.round(position.x / gridSize) * gridSize,
      Math.round(position.y / gridSize) * gridSize
    );
  }

  /**
   * Get all segments connected to a node
   */
  static getConnectedSegments(
    nodeId: string,
    nodes: Map<string, TrackNode>,
    segments: Map<string, TrackSegment>
  ): TrackSegment[] {
    const node = nodes.get(nodeId);
    if (!node) return [];

    return node.connectedSegments
      .map((id) => segments.get(id))
      .filter((seg): seg is TrackSegment => seg !== undefined);
  }
}
