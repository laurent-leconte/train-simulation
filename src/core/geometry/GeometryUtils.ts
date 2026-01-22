import { Vector2D } from './Vector2D';

/**
 * General geometry utility functions
 */

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Map a value from one range to another
 */
export function map(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Calculate distance from a point to a line segment
 */
export function distancePointToLineSegment(
  point: Vector2D,
  lineStart: Vector2D,
  lineEnd: Vector2D
): number {
  const lineVec = lineEnd.subtract(lineStart);
  const pointVec = point.subtract(lineStart);

  const lineLength = lineVec.magnitude();
  if (lineLength === 0) {
    return point.distanceTo(lineStart);
  }

  // Project point onto line
  const t = clamp(pointVec.dot(lineVec) / (lineLength * lineLength), 0, 1);
  const projection = lineStart.add(lineVec.multiply(t));

  return point.distanceTo(projection);
}

/**
 * Find the closest point on a line segment to a given point
 */
export function closestPointOnLineSegment(
  point: Vector2D,
  lineStart: Vector2D,
  lineEnd: Vector2D
): Vector2D {
  const lineVec = lineEnd.subtract(lineStart);
  const pointVec = point.subtract(lineStart);

  const lineLength = lineVec.magnitudeSquared();
  if (lineLength === 0) {
    return lineStart.clone();
  }

  const t = clamp(pointVec.dot(lineVec) / lineLength, 0, 1);
  return lineStart.add(lineVec.multiply(t));
}

/**
 * Check if two line segments intersect
 */
export function lineSegmentsIntersect(
  a1: Vector2D,
  a2: Vector2D,
  b1: Vector2D,
  b2: Vector2D
): boolean {
  const intersection = lineSegmentIntersection(a1, a2, b1, b2);
  return intersection !== null;
}

/**
 * Find the intersection point of two line segments (if it exists)
 */
export function lineSegmentIntersection(
  a1: Vector2D,
  a2: Vector2D,
  b1: Vector2D,
  b2: Vector2D
): Vector2D | null {
  const d1 = a2.subtract(a1);
  const d2 = b2.subtract(b1);
  const d3 = b1.subtract(a1);

  const cross = d1.cross(d2);

  if (Math.abs(cross) < 0.0001) {
    // Lines are parallel
    return null;
  }

  const t1 = d3.cross(d2) / cross;
  const t2 = d3.cross(d1) / cross;

  if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
    return a1.add(d1.multiply(t1));
  }

  return null;
}

