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
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Check if a point is near a line segment
 */
export function pointNearLine(
  point: Vector2D,
  lineStart: Vector2D,
  lineEnd: Vector2D,
  threshold: number
): boolean {
  const distance = distancePointToLineSegment(point, lineStart, lineEnd);
  return distance <= threshold;
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

/**
 * Calculate the area of a polygon
 */
export function polygonArea(points: Vector2D[]): number {
  let area = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area) / 2;
}

/**
 * Check if a point is inside a polygon
 */
export function pointInPolygon(point: Vector2D, polygon: Vector2D[]): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculate bounding box for a set of points
 */
export interface BoundingBox {
  min: Vector2D;
  max: Vector2D;
  width: number;
  height: number;
  center: Vector2D;
}

export function calculateBoundingBox(points: Vector2D[]): BoundingBox {
  if (points.length === 0) {
    const zero = Vector2D.zero();
    return {
      min: zero,
      max: zero,
      width: 0,
      height: 0,
      center: zero,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  const min = new Vector2D(minX, minY);
  const max = new Vector2D(maxX, maxY);
  const width = maxX - minX;
  const height = maxY - minY;
  const center = new Vector2D((minX + maxX) / 2, (minY + maxY) / 2);

  return { min, max, width, height, center };
}

/**
 * Check if two bounding boxes intersect
 */
export function boundingBoxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.max.x < b.min.x ||
    a.min.x > b.max.x ||
    a.max.y < b.min.y ||
    a.min.y > b.max.y
  );
}
