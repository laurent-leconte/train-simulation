import { Vector2D } from '@/core/geometry/Vector2D';
import { TrackSegment, TrackNode, StraightGeometry, CurveGeometry, Switch } from '@/types/circuit.types';
import { TrainPosition } from '@/types/train.types';
import {
  evaluateCubicBezier,
  evaluateCubicBezierDerivative,
} from '@/core/geometry/Bezier';

/**
 * Service for managing train movement along track paths
 */
export class TrainPathFollower {
  /**
   * Calculate world position and direction for a train on a segment
   */
  static calculatePosition(
    segment: TrackSegment,
    distance: number,
    reversed = false
  ): { worldPosition: Vector2D; direction: Vector2D } {
    // Clamp distance to segment bounds
    distance = Math.max(0, Math.min(distance, segment.length));

    let result: { worldPosition: Vector2D; direction: Vector2D };

    if (segment.type === 'straight') {
      result = this.calculateStraightPosition(segment.geometry as StraightGeometry, distance, segment.length);
    } else if (segment.type === 'curve') {
      result = this.calculateCurvePosition(segment.geometry as CurveGeometry, distance, segment.length);
    } else {
      // Fallback
      result = {
        worldPosition: Vector2D.zero(),
        direction: new Vector2D(1, 0),
      };
    }

    // If reversed, flip the direction
    if (reversed) {
      result.direction = result.direction.multiply(-1);
    }

    return result;
  }

  /**
   * Calculate position on straight track
   */
  private static calculateStraightPosition(
    geometry: StraightGeometry,
    distance: number,
    totalLength: number
  ): { worldPosition: Vector2D; direction: Vector2D } {
    const { start, end } = geometry;
    const t = distance / totalLength;

    const worldPosition = start.lerp(end, t);
    const direction = end.subtract(start).normalize();

    return { worldPosition, direction };
  }

  /**
   * Calculate position on curved track
   */
  private static calculateCurvePosition(
    geometry: CurveGeometry,
    distance: number,
    totalLength: number
  ): { worldPosition: Vector2D; direction: Vector2D } {
    // Use parametric t (0 to 1) to evaluate Bezier
    // This is an approximation - ideally we'd use arc-length parameterization
    const t = distance / totalLength;

    const worldPosition = evaluateCubicBezier(
      geometry.start,
      geometry.controlPoint1,
      geometry.controlPoint2!,
      geometry.end,
      t
    );

    const tangent = evaluateCubicBezierDerivative(
      geometry.start,
      geometry.controlPoint1,
      geometry.controlPoint2!,
      geometry.end,
      t
    );

    const direction = tangent.normalize();

    return { worldPosition, direction };
  }

  /**
   * Move a train forward by a given distance (can be negative for reverse)
   * Returns updated position, handling segment transitions
   */
  static moveAlongTrack(
    currentPosition: TrainPosition,
    deltaDistance: number,
    segments: Map<string, TrackSegment>,
    nodes: Map<string, TrackNode>,
    switches?: Map<string, Switch>
  ): TrainPosition | null {
    let currentSegmentId = currentPosition.segmentId;
    let currentReversed = currentPosition.reversed;

    // If reversed, we move backwards along the segment (decrease distance)
    let currentDistance = currentPosition.distance + (currentReversed ? -deltaDistance : deltaDistance);

    // Handle segment transitions
    while (true) {
      const segment = segments.get(currentSegmentId);
      if (!segment) {
        console.warn('Segment not found:', currentSegmentId);
        return null;
      }

      // Check if we're within the current segment
      if (currentDistance >= 0 && currentDistance <= segment.length) {
        // We're on this segment
        const { worldPosition, direction } = this.calculatePosition(segment, currentDistance, currentReversed);
        return {
          segmentId: currentSegmentId,
          distance: currentDistance,
          worldPosition,
          direction,
          reversed: currentReversed,
        };
      }

      // Moving past segment boundary
      if (currentDistance > segment.length || currentDistance < 0) {
        const overflow = currentDistance > segment.length
          ? currentDistance - segment.length
          : -currentDistance;

        // Determine which end we're exiting from
        const exitingFromStart = currentDistance < 0;
        const exitNodeId = exitingFromStart ? segment.startNode : segment.endNode;

        // Find next segment (respecting switch positions if available)
        const nextSegmentId = this.findNextSegment(segment, exitingFromStart, segments, nodes, switches);

        if (!nextSegmentId) {
          // No next segment - clamp to boundary
          const clampedDistance = currentDistance < 0 ? 0 : segment.length;
          const { worldPosition, direction } = this.calculatePosition(segment, clampedDistance, currentReversed);
          return {
            segmentId: currentSegmentId,
            distance: clampedDistance,
            worldPosition,
            direction,
            reversed: currentReversed,
          };
        }

        const nextSegment = segments.get(nextSegmentId);
        if (!nextSegment) return null;

        // Determine how to enter the next segment
        const nextReversed = exitNodeId === nextSegment.endNode;

        if (nextReversed) {
          // Enter from end, traverse backwards
          currentSegmentId = nextSegmentId;
          currentDistance = nextSegment.length - overflow;
          currentReversed = true;
        } else {
          // Enter from start, traverse forwards
          currentSegmentId = nextSegmentId;
          currentDistance = overflow;
          currentReversed = false;
        }

        // Continue loop to check if we overflow this segment too
        continue;
      }
    }
  }

  /**
   * Find the next segment connected to the current one
   * Respects switch positions when available
   */
  static findNextSegment(
    currentSegment: TrackSegment,
    atStart: boolean,
    segments: Map<string, TrackSegment>,
    nodes: Map<string, TrackNode>,
    switches?: Map<string, Switch>
  ): string | null {
    // Get the node at the end we're trying to leave from
    const nodeId = atStart ? currentSegment.startNode : currentSegment.endNode;
    const node = nodes.get(nodeId);

    if (!node) return null;

    // Check if there's a switch at this node
    if (switches) {
      for (const sw of switches.values()) {
        if (sw.nodeId === nodeId) {
          // Found a switch at this node
          // If we're coming from the incoming track, use switch position to choose outgoing
          if (currentSegment.id === sw.incomingTrack) {
            return sw.outgoingTracks[sw.currentPosition];
          }

          // If we're coming from one of the outgoing tracks, go to incoming
          if (sw.outgoingTracks.includes(currentSegment.id)) {
            return sw.incomingTrack;
          }
        }
      }
    }

    // No switch or switch doesn't affect this path - use default logic
    // Find other segments connected to this node
    for (const segmentId of node.connectedSegments) {
      if (segmentId !== currentSegment.id) {
        return segmentId;
      }
    }

    return null;
  }

  /**
   * Initialize a train position at the start of a segment
   */
  static initializeAtSegment(
    segmentId: string,
    segments: Map<string, TrackSegment>,
    distanceFromStart = 0
  ): TrainPosition | null {
    const segment = segments.get(segmentId);
    if (!segment) return null;

    const { worldPosition, direction } = this.calculatePosition(segment, distanceFromStart, false);

    return {
      segmentId,
      distance: distanceFromStart,
      worldPosition,
      direction,
      reversed: false,
    };
  }
}
