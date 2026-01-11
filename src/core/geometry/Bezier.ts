import { Vector2D } from './Vector2D';

/**
 * Bezier curve utilities for track segments
 */

/**
 * Evaluate a quadratic Bezier curve at parameter t
 * B(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
 */
export function evaluateQuadraticBezier(
  p0: Vector2D,
  p1: Vector2D,
  p2: Vector2D,
  t: number
): Vector2D {
  const oneMinusT = 1 - t;
  const term1 = p0.multiply(oneMinusT * oneMinusT);
  const term2 = p1.multiply(2 * oneMinusT * t);
  const term3 = p2.multiply(t * t);

  return term1.add(term2).add(term3);
}

/**
 * Evaluate the derivative (tangent) of a quadratic Bezier curve at parameter t
 * B'(t) = 2(1-t)(P₁-P₀) + 2t(P₂-P₁)
 */
export function evaluateQuadraticBezierDerivative(
  p0: Vector2D,
  p1: Vector2D,
  p2: Vector2D,
  t: number
): Vector2D {
  const term1 = p1.subtract(p0).multiply(2 * (1 - t));
  const term2 = p2.subtract(p1).multiply(2 * t);

  return term1.add(term2);
}

/**
 * Evaluate a cubic Bezier curve at parameter t
 * B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
 */
export function evaluateCubicBezier(
  p0: Vector2D,
  p1: Vector2D,
  p2: Vector2D,
  p3: Vector2D,
  t: number
): Vector2D {
  const oneMinusT = 1 - t;
  const oneMinusT2 = oneMinusT * oneMinusT;
  const oneMinusT3 = oneMinusT2 * oneMinusT;
  const t2 = t * t;
  const t3 = t2 * t;

  const term1 = p0.multiply(oneMinusT3);
  const term2 = p1.multiply(3 * oneMinusT2 * t);
  const term3 = p2.multiply(3 * oneMinusT * t2);
  const term4 = p3.multiply(t3);

  return term1.add(term2).add(term3).add(term4);
}

/**
 * Evaluate the derivative of a cubic Bezier curve at parameter t
 */
export function evaluateCubicBezierDerivative(
  p0: Vector2D,
  p1: Vector2D,
  p2: Vector2D,
  p3: Vector2D,
  t: number
): Vector2D {
  const oneMinusT = 1 - t;
  const term1 = p1.subtract(p0).multiply(3 * oneMinusT * oneMinusT);
  const term2 = p2.subtract(p1).multiply(6 * oneMinusT * t);
  const term3 = p3.subtract(p2).multiply(3 * t * t);

  return term1.add(term2).add(term3);
}

/**
 * Calculate approximate length of a Bezier curve using numerical integration
 * Uses adaptive sampling for better accuracy
 */
export function calculateBezierLength(
  p0: Vector2D,
  p1: Vector2D,
  p2: Vector2D,
  p3?: Vector2D,
  samples: number = 100
): number {
  let length = 0;
  let prevPoint = p0;

  const isQuadratic = p3 === undefined;

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const point = isQuadratic
      ? evaluateQuadraticBezier(p0, p1, p2, t)
      : evaluateCubicBezier(p0, p1, p2, p3!, t);

    length += point.distanceTo(prevPoint);
    prevPoint = point;
  }

  return length;
}

/**
 * Find the t parameter for a given distance along the curve
 * Uses binary search for efficiency
 */
export function distanceToT(
  p0: Vector2D,
  p1: Vector2D,
  p2: Vector2D,
  targetDistance: number,
  totalLength: number,
  p3?: Vector2D
): number {
  // Quick checks
  if (targetDistance <= 0) return 0;
  if (targetDistance >= totalLength) return 1;

  // Binary search
  let tMin = 0;
  let tMax = 1;
  let t = targetDistance / totalLength; // Initial guess

  const isQuadratic = p3 === undefined;
  const tolerance = 0.001;

  for (let i = 0; i < 20; i++) {
    // Calculate distance at current t
    let distance = 0;
    let prevPoint = p0;
    const samples = 50;

    for (let j = 1; j <= samples; j++) {
      const sampleT = (j / samples) * t;
      const point = isQuadratic
        ? evaluateQuadraticBezier(p0, p1, p2, sampleT)
        : evaluateCubicBezier(p0, p1, p2, p3!, sampleT);

      distance += point.distanceTo(prevPoint);
      prevPoint = point;
    }

    const error = distance - targetDistance;

    if (Math.abs(error) < tolerance) {
      return t;
    }

    if (error > 0) {
      tMax = t;
    } else {
      tMin = t;
    }

    t = (tMin + tMax) / 2;
  }

  return t;
}

/**
 * Create a smooth quadratic Bezier control point for a given radius
 */
export function createSmoothControlPoint(
  start: Vector2D,
  end: Vector2D,
  radius: number
): Vector2D {
  // Calculate midpoint
  const mid = start.lerp(end, 0.5);

  // Calculate perpendicular direction
  const direction = end.subtract(start).normalize();
  const perpendicular = direction.perpendicular();

  // Offset by radius
  return mid.add(perpendicular.multiply(radius));
}

/**
 * Calculate the arc angle of a curve
 */
export function calculateArcAngle(
  p0: Vector2D,
  p1: Vector2D,
  p2: Vector2D
): number {
  const startTangent = p1.subtract(p0).normalize();
  const endTangent = p2.subtract(p1).normalize();

  return Math.acos(Math.max(-1, Math.min(1, startTangent.dot(endTangent))));
}
