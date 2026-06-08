import { Vector2D } from '@/core/geometry/Vector2D';
import { ViewportState, ViewMode } from '@/types';

/**
 * 2:1 dimetric ("isometric") projection matrix mapping world (x, y) to screen:
 *   isoX = x - y
 *   isoY = (x + y) / 2
 * Expressed as the linear map [[a, c], [b, d]] (canvas transform order).
 * This is affine, so flat ground geometry (rails, ties, grid) projects for free.
 */
const ISO_MATRIX = { a: 1, b: 0.5, c: -1, d: 0.5 } as const;
const TOPDOWN_MATRIX = { a: 1, b: 0, c: 0, d: 1 } as const;

/**
 * Rendering context wrapper for Canvas 2D
 * Handles viewport transformations and coordinate conversions
 */
export class RenderingContext {
  private ctx: CanvasRenderingContext2D;
  private viewport: ViewportState;
  private canvasWidth: number;
  private canvasHeight: number;
  private viewMode: ViewMode;

  constructor(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportState,
    canvasWidth: number,
    canvasHeight: number,
    viewMode: ViewMode = 'topdown'
  ) {
    this.ctx = ctx;
    this.viewport = viewport;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.viewMode = viewMode;
  }

  /**
   * Get the active projection matrix (world -> projected, pre zoom/pan).
   */
  private projection(): { a: number; b: number; c: number; d: number } {
    return this.viewMode === 'iso' ? ISO_MATRIX : TOPDOWN_MATRIX;
  }

  /**
   * Get the current view projection mode
   */
  getViewMode(): ViewMode {
    return this.viewMode;
  }

  /**
   * Project a world point + optional height into screen space.
   * Height lifts the point along screen-up (negative screen Y) and is the
   * only non-affine part of the projection — used by "tall" object renderers.
   */
  project(world: Vector2D, height = 0): Vector2D {
    const screen = this.worldToScreen(world);
    return new Vector2D(screen.x, screen.y - height * this.viewport.zoom);
  }

  /**
   * Get the underlying canvas context
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  /**
   * Get current viewport state
   */
  getViewport(): ViewportState {
    return this.viewport;
  }

  /**
   * Apply viewport transformation to canvas
   */
  applyTransform(): void {
    const { zoom, pan } = this.viewport;
    const { a, b, c, d } = this.projection();

    // Translate to center
    this.ctx.translate(this.canvasWidth / 2, this.canvasHeight / 2);

    // Apply zoom
    this.ctx.scale(zoom, zoom);

    // Apply projection (identity for top-down, dimetric shear for iso)
    this.ctx.transform(a, b, c, d, 0, 0);

    // Apply pan (in world space, so panning feels consistent across modes)
    this.ctx.translate(pan.x, pan.y);
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(point: Vector2D): Vector2D {
    const { zoom, pan } = this.viewport;
    const { a, b, c, d } = this.projection();

    // World -> (pan) -> projection -> zoom -> center
    const px = point.x + pan.x;
    const py = point.y + pan.y;
    const projX = a * px + c * py;
    const projY = b * px + d * py;

    return new Vector2D(
      projX * zoom + this.canvasWidth / 2,
      projY * zoom + this.canvasHeight / 2
    );
  }

  /**
   * Convert screen coordinates to world coordinates (inverse of worldToScreen)
   */
  screenToWorld(point: Vector2D): Vector2D {
    const { zoom, pan } = this.viewport;
    const { a, b, c, d } = this.projection();

    // Undo center + zoom
    const sx = (point.x - this.canvasWidth / 2) / zoom;
    const sy = (point.y - this.canvasHeight / 2) / zoom;

    // Undo projection via inverse matrix
    const det = a * d - b * c;
    const ix = (d * sx - c * sy) / det;
    const iy = (-b * sx + a * sy) / det;

    // Undo pan
    return new Vector2D(ix - pan.x, iy - pan.y);
  }

  /**
   * Get visible world bounds as an axis-aligned bounding box.
   * Under iso the viewport maps to a diamond in world space, so we take the
   * AABB of all four projected screen corners to ensure full coverage.
   */
  getVisibleBounds(): { min: Vector2D; max: Vector2D } {
    const corners = [
      this.screenToWorld(Vector2D.zero()),
      this.screenToWorld(new Vector2D(this.canvasWidth, 0)),
      this.screenToWorld(new Vector2D(0, this.canvasHeight)),
      this.screenToWorld(new Vector2D(this.canvasWidth, this.canvasHeight)),
    ];

    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);

    return {
      min: new Vector2D(Math.min(...xs), Math.min(...ys)),
      max: new Vector2D(Math.max(...xs), Math.max(...ys)),
    };
  }

  /**
   * Clear the canvas
   */
  clear(color: string = '#1f2937'): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.ctx.restore();
  }

  /**
   * Save canvas state
   */
  save(): void {
    this.ctx.save();
  }

  /**
   * Restore canvas state
   */
  restore(): void {
    this.ctx.restore();
  }
}
