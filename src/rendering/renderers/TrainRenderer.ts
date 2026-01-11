import { Train } from '@/types/train.types';
import { RenderingContext } from '../RenderingContext';

/**
 * Renders trains on the canvas
 */
export class TrainRenderer {
  /**
   * Render all trains
   */
  renderAll(
    trains: Map<string, Train>,
    renderCtx: RenderingContext,
    selectedId?: string | null
  ): void {
    const ctx = renderCtx.getContext();

    for (const train of trains.values()) {
      const isSelected = train.id === selectedId;
      this.renderTrain(train, ctx, isSelected);
    }
  }

  /**
   * Render a single train
   */
  private renderTrain(
    train: Train,
    ctx: CanvasRenderingContext2D,
    isSelected: boolean
  ): void {
    const { worldPosition, direction } = train.position;

    ctx.save();

    // Move to train position and rotate to face direction
    ctx.translate(worldPosition.x, worldPosition.y);
    const angle = Math.atan2(direction.y, direction.x);
    ctx.rotate(angle);

    // Draw train body (rectangle centered on position)
    ctx.fillStyle = train.color;
    if (isSelected) {
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 3;
    }

    const halfLength = train.length / 2;
    const halfWidth = train.width / 2;

    ctx.fillRect(-halfLength, -halfWidth, train.length, train.width);

    if (isSelected) {
      ctx.strokeRect(-halfLength, -halfWidth, train.length, train.width);
    }

    // Draw front indicator (small white rectangle at front)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(halfLength - 6, -halfWidth, 6, train.width);

    // Draw speed indicator (small bar above train)
    const speedRatio = Math.abs(train.velocity) / train.maxSpeed;
    if (speedRatio > 0.01) {
      ctx.fillStyle = train.velocity > 0 ? '#22c55e' : '#ef4444';
      const barWidth = train.length * speedRatio;
      ctx.fillRect(-halfLength, -halfWidth - 5, barWidth, 2);
    }

    ctx.restore();
  }

  /**
   * Render train debug info (position, velocity, etc.)
   */
  renderDebugInfo(
    train: Train,
    ctx: CanvasRenderingContext2D
  ): void {
    const { worldPosition } = train.position;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.font = '12px monospace';

    const text = `v: ${train.velocity.toFixed(1)} px/s`;
    const textX = worldPosition.x + 20;
    const textY = worldPosition.y - 20;

    // Draw text outline
    ctx.strokeText(text, textX, textY);
    ctx.fillText(text, textX, textY);

    ctx.restore();
  }
}
