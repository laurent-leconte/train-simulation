/**
 * 2D Vector class for mathematical operations
 * Used throughout the application for positions, velocities, directions, etc.
 */
export class Vector2D {
  constructor(
    public x: number = 0,
    public y: number = 0
  ) {}

  // Factory methods
  static zero(): Vector2D {
    return new Vector2D(0, 0);
  }

  static fromAngle(angle: number, length: number = 1): Vector2D {
    return new Vector2D(
      Math.cos(angle) * length,
      Math.sin(angle) * length
    );
  }

  static from(obj: { x: number; y: number }): Vector2D {
    return new Vector2D(obj.x, obj.y);
  }

  // Basic operations
  clone(): Vector2D {
    return new Vector2D(this.x, this.y);
  }

  add(other: Vector2D): Vector2D {
    return new Vector2D(this.x + other.x, this.y + other.y);
  }

  subtract(other: Vector2D): Vector2D {
    return new Vector2D(this.x - other.x, this.y - other.y);
  }

  multiply(scalar: number): Vector2D {
    return new Vector2D(this.x * scalar, this.y * scalar);
  }

  divide(scalar: number): Vector2D {
    if (scalar === 0) {
      console.warn('Division by zero in Vector2D');
      return Vector2D.zero();
    }
    return new Vector2D(this.x / scalar, this.y / scalar);
  }

  // Magnitude operations
  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  magnitudeSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  normalize(): Vector2D {
    const mag = this.magnitude();
    if (mag === 0) {
      return Vector2D.zero();
    }
    return this.divide(mag);
  }

  setMagnitude(length: number): Vector2D {
    return this.normalize().multiply(length);
  }

  limit(max: number): Vector2D {
    const magSq = this.magnitudeSquared();
    if (magSq > max * max) {
      return this.normalize().multiply(max);
    }
    return this.clone();
  }

  // Angle operations
  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  angleTo(other: Vector2D): number {
    return Math.atan2(other.y - this.y, other.x - this.x);
  }

  rotate(angle: number): Vector2D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector2D(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    );
  }

  // Dot and cross products
  dot(other: Vector2D): number {
    return this.x * other.x + this.y * other.y;
  }

  cross(other: Vector2D): number {
    return this.x * other.y - this.y * other.x;
  }

  // Distance operations
  distanceTo(other: Vector2D): number {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  distanceToSquared(other: Vector2D): number {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return dx * dx + dy * dy;
  }

  // Interpolation
  lerp(other: Vector2D, t: number): Vector2D {
    return new Vector2D(
      this.x + (other.x - this.x) * t,
      this.y + (other.y - this.y) * t
    );
  }

  // Perpendicular vectors
  perpendicular(): Vector2D {
    return new Vector2D(-this.y, this.x);
  }

  // Projection
  projectOnto(other: Vector2D): Vector2D {
    const scalar = this.dot(other) / other.magnitudeSquared();
    return other.multiply(scalar);
  }

  // Reflection
  reflect(normal: Vector2D): Vector2D {
    const n = normal.normalize();
    return this.subtract(n.multiply(2 * this.dot(n)));
  }

  // Equality
  equals(other: Vector2D, epsilon: number = 0.0001): boolean {
    return (
      Math.abs(this.x - other.x) < epsilon &&
      Math.abs(this.y - other.y) < epsilon
    );
  }

  // String representation
  toString(): string {
    return `Vector2D(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
  }

  // Conversion to plain object
  toObject(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  // Static utility methods
  static distance(a: Vector2D, b: Vector2D): number {
    return a.distanceTo(b);
  }

  static dot(a: Vector2D, b: Vector2D): number {
    return a.dot(b);
  }

  static cross(a: Vector2D, b: Vector2D): number {
    return a.cross(b);
  }

  static lerp(a: Vector2D, b: Vector2D, t: number): Vector2D {
    return a.lerp(b, t);
  }

  static angle(a: Vector2D, b: Vector2D): number {
    return Math.acos(a.dot(b) / (a.magnitude() * b.magnitude()));
  }
}

// Type alias for plain objects
export type Vector2DLike = { x: number; y: number };
