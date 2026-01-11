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
   * Render a single train (pixel art steam locomotive)
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

    const halfLength = train.length / 2;
    const halfWidth = train.width / 2;

    // Selection highlight
    if (isSelected) {
      ctx.fillStyle = 'rgba(96, 165, 250, 0.3)';
      ctx.fillRect(-halfLength - 2, -halfWidth - 2, train.length + 4, train.width + 4);
    }

    // Draw old-fashioned steam locomotive
    this.drawSteamLocomotive(ctx, -halfLength, -halfWidth, train.length, train.width);

    // Draw steam puffs if moving
    if (Math.abs(train.velocity) > 1) {
      this.drawSteamPuffs(ctx, halfLength, -halfWidth - 8, train.velocity);
    }

    ctx.restore();
  }

  /**
   * Draw a pixel art steam locomotive
   */
  private drawSteamLocomotive(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    length: number,
    width: number
  ): void {
    // Boiler (main body) - dark red
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(x + 8, y + 2, length - 16, width - 4);

    // Boiler outline
    ctx.strokeStyle = '#4B0000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 8, y + 2, length - 16, width - 4);

    // Cab (driver's compartment) - dark blue
    ctx.fillStyle = '#00008B';
    ctx.fillRect(x, y + 1, 10, width - 2);

    // Cab window
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(x + 2, y + 3, 3, 3);

    // Smokestack
    ctx.fillStyle = '#2F4F4F';
    ctx.fillRect(x + length - 10, y - 2, 4, 6);

    // Smokestack top (wider)
    ctx.fillStyle = '#2F4F4F';
    ctx.fillRect(x + length - 11, y - 3, 6, 2);

    // Cowcatcher (front pilot)
    ctx.fillStyle = '#696969';
    ctx.beginPath();
    ctx.moveTo(x + length - 4, y + width / 2);
    ctx.lineTo(x + length + 2, y + width - 2);
    ctx.lineTo(x + length + 2, y + 2);
    ctx.closePath();
    ctx.fill();

    // Wheels (2 big wheels)
    const wheelY = y + width;
    const wheel1X = x + 10;
    const wheel2X = x + length - 14;
    const wheelRadius = 3;

    // Wheel 1
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(wheel1X, wheelY, wheelRadius, 0, Math.PI * 2);
    ctx.fill();

    // Wheel 1 center
    ctx.fillStyle = '#696969';
    ctx.beginPath();
    ctx.arc(wheel1X, wheelY, wheelRadius - 1, 0, Math.PI * 2);
    ctx.fill();

    // Wheel 2
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(wheel2X, wheelY, wheelRadius, 0, Math.PI * 2);
    ctx.fill();

    // Wheel 2 center
    ctx.fillStyle = '#696969';
    ctx.beginPath();
    ctx.arc(wheel2X, wheelY, wheelRadius - 1, 0, Math.PI * 2);
    ctx.fill();

    // Boiler bands (decorative stripes)
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 15, y + 2);
    ctx.lineTo(x + 15, y + width - 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + length - 16, y + 2);
    ctx.lineTo(x + length - 16, y + width - 2);
    ctx.stroke();

    // Headlamp
    ctx.fillStyle = '#FFFF00';
    ctx.beginPath();
    ctx.arc(x + length - 6, y + width / 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw steam puffs coming from smokestack
   */
  private drawSteamPuffs(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    velocity: number
  ): void {
    const time = Date.now() / 200; // Animation speed
    const puffCount = 3;

    for (let i = 0; i < puffCount; i++) {
      const offset = (time + i * 1.5) % 4;
      const puffX = x - offset * 5;
      const puffY = y - offset * 3;
      const alpha = Math.max(0, 1 - offset / 4);
      const size = 3 + offset;

      ctx.fillStyle = `rgba(200, 200, 200, ${alpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(puffX, puffY, size, 0, Math.PI * 2);
      ctx.fill();
    }
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
