import { Vector2D } from '@/core/geometry/Vector2D';
import { ViewportState } from '@/types';

/**
 * Rendering context wrapper for Canvas 2D
 * Handles viewport transformations and coordinate conversions
 */
export class RenderingContext {
  private ctx: CanvasRenderingContext2D;
  private viewport: ViewportState;
  private canvasWidth: number;
  private canvasHeight: number;

  constructor(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportState,
    canvasWidth: number,
    canvasHeight: number
  ) {
    this.ctx = ctx;
    this.viewport = viewport;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
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

    // Translate to center
    this.ctx.translate(this.canvasWidth / 2, this.canvasHeight / 2);

    // Apply zoom
    this.ctx.scale(zoom, zoom);

    // Apply pan
    this.ctx.translate(pan.x, pan.y);
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(point: Vector2D): Vector2D {
    const { zoom, pan } = this.viewport;

    const x = (point.x + pan.x) * zoom + this.canvasWidth / 2;
    const y = (point.y + pan.y) * zoom + this.canvasHeight / 2;

    return new Vector2D(x, y);
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(point: Vector2D): Vector2D {
    const { zoom, pan } = this.viewport;

    const x = (point.x - this.canvasWidth / 2) / zoom - pan.x;
    const y = (point.y - this.canvasHeight / 2) / zoom - pan.y;

    return new Vector2D(x, y);
  }

  /**
   * Get visible world bounds
   */
  getVisibleBounds(): { min: Vector2D; max: Vector2D } {
    const topLeft = this.screenToWorld(Vector2D.zero());
    const bottomRight = this.screenToWorld(
      new Vector2D(this.canvasWidth, this.canvasHeight)
    );

    return {
      min: topLeft,
      max: bottomRight,
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
