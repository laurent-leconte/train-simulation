import { RenderingContext } from './RenderingContext';

/**
 * Renders a grid on the canvas
 */
export class GridRenderer {
  render(renderCtx: RenderingContext, gridSize: number, showGrid: boolean): void {
    if (!showGrid) return;

    const ctx = renderCtx.getContext();
    const bounds = renderCtx.getVisibleBounds();

    ctx.save();

    // Grid style
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1 / renderCtx.getViewport().zoom;

    // Calculate grid start and end positions
    const startX = Math.floor(bounds.min.x / gridSize) * gridSize;
    const endX = Math.ceil(bounds.max.x / gridSize) * gridSize;
    const startY = Math.floor(bounds.min.y / gridSize) * gridSize;
    const endY = Math.ceil(bounds.max.y / gridSize) * gridSize;

    // Draw vertical lines
    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, bounds.min.y);
      ctx.lineTo(x, bounds.max.y);
    }
    ctx.stroke();

    // Draw horizontal lines
    ctx.beginPath();
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(bounds.min.x, y);
      ctx.lineTo(bounds.max.x, y);
    }
    ctx.stroke();

    // Draw axes (stronger lines at x=0 and y=0)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2 / renderCtx.getViewport().zoom;

    ctx.beginPath();
    ctx.moveTo(0, bounds.min.y);
    ctx.lineTo(0, bounds.max.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bounds.min.x, 0);
    ctx.lineTo(bounds.max.x, 0);
    ctx.stroke();

    ctx.restore();
  }
}
