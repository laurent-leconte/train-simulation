import { Train, CarriagePosition } from '@/types/train.types';
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
      // Render carriages first (behind locomotive)
      this.renderCarriages(train, ctx);
      // Render locomotive on top
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

    // Draw steam puffs if moving (from the smokestack at front)
    if (Math.abs(train.velocity) > 1) {
      this.drawSteamPuffs(ctx, halfLength - 8, 0, train.velocity);
    }

    ctx.restore();
  }

  /**
   * Draw a pixel art steam locomotive from above (top-down view)
   */
  private drawSteamLocomotive(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    length: number,
    width: number
  ): void {
    // Main boiler body (dark red with rounded front)
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(x + 4, y, length - 14, width);

    // Rounded boiler front
    ctx.beginPath();
    ctx.arc(x + length - 14, y + width / 2, width / 2, -Math.PI / 2, Math.PI / 2);
    ctx.fill();

    // Boiler outline
    ctx.strokeStyle = '#4B0000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4, y, length - 14, width);
    ctx.beginPath();
    ctx.arc(x + length - 14, y + width / 2, width / 2, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    // Cab (driver's compartment at back) - dark blue
    ctx.fillStyle = '#00008B';
    ctx.fillRect(x, y + width * 0.2, 6, width * 0.6);

    // Cab outline
    ctx.strokeStyle = '#000066';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y + width * 0.2, 6, width * 0.6);

    // Cab windows (two small light blue squares)
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(x + 1, y + width * 0.3, 2, 2);
    ctx.fillRect(x + 1, y + width * 0.65, 2, 2);

    // Smokestack (circular, dark gray)
    ctx.fillStyle = '#2F4F4F';
    ctx.beginPath();
    ctx.arc(x + length - 8, y + width / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Smokestack rim (lighter)
    ctx.strokeStyle = '#556B6B';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Cowcatcher at front (triangular wedge)
    ctx.fillStyle = '#696969';
    ctx.beginPath();
    ctx.moveTo(x + length - 14, y + width * 0.3);
    ctx.lineTo(x + length - 14, y + width * 0.7);
    ctx.lineTo(x + length - 8, y + width / 2);
    ctx.closePath();
    ctx.fill();

    // Cowcatcher outline
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Boiler bands (decorative stripes across)
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 10, y);
    ctx.lineTo(x + 10, y + width);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + length - 20, y);
    ctx.lineTo(x + length - 20, y + width);
    ctx.stroke();

    // Headlamp at front
    ctx.fillStyle = '#FFFF00';
    ctx.beginPath();
    ctx.arc(x + length - 10, y + width / 2, 1.5, 0, Math.PI * 2);
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
   * Render all carriages for a train
   */
  private renderCarriages(
    train: Train,
    ctx: CanvasRenderingContext2D
  ): void {
    if (!train.carriagePositions || train.carriagePositions.length === 0) return;

    for (let i = 0; i < train.carriagePositions.length; i++) {
      const pos = train.carriagePositions[i];
      this.renderCarriage(pos, train.carriageLength, train.width, ctx, i);
    }
  }

  /**
   * Render a single carriage (passenger wagon)
   */
  private renderCarriage(
    position: CarriagePosition,
    length: number,
    width: number,
    ctx: CanvasRenderingContext2D,
    index: number
  ): void {
    const { worldPosition, direction } = position;

    ctx.save();

    // Move to carriage position and rotate to face direction
    ctx.translate(worldPosition.x, worldPosition.y);
    const angle = Math.atan2(direction.y, direction.x);
    ctx.rotate(angle);

    const halfLength = length / 2;
    const halfWidth = width / 2;

    // Alternate carriage colors
    const colors = ['#8B4513', '#2F4F4F', '#4A4A4A']; // Brown, dark slate, dark gray
    const color = colors[index % colors.length];

    this.drawCarriageBody(ctx, -halfLength, -halfWidth, length, width, color);

    ctx.restore();
  }

  /**
   * Draw a passenger carriage from above (top-down view)
   */
  private drawCarriageBody(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    length: number,
    width: number,
    color: string
  ): void {
    // Main body
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y, length - 4, width);

    // Rounded ends
    ctx.beginPath();
    ctx.arc(x + 2, y + width / 2, width / 2, Math.PI / 2, -Math.PI / 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + length - 2, y + width / 2, width / 2, -Math.PI / 2, Math.PI / 2);
    ctx.fill();

    // Outline
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y, length - 4, width);

    // Windows (fixed positions relative to carriage center)
    ctx.fillStyle = '#87CEEB';
    const windowPositions = [-8, 0, 8]; // Three windows evenly spaced
    const centerX = x + length / 2;
    for (const offset of windowPositions) {
      const wx = centerX + offset - 2.5;
      // Top windows
      ctx.fillRect(wx, y + 1, 5, 2);
      // Bottom windows
      ctx.fillRect(wx, y + width - 3, 5, 2);
    }

    // Roof detail (darker stripe down the middle)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(x + 4, y + width * 0.35, length - 8, width * 0.3);

    // Couplings at ends (small dark rectangles)
    ctx.fillStyle = '#333';
    ctx.fillRect(x - 2, y + width * 0.4, 4, width * 0.2);
    ctx.fillRect(x + length - 2, y + width * 0.4, 4, width * 0.2);
  }

}
