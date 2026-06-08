import { Vector2D } from '@/core/geometry/Vector2D';
import { Train, CarriagePosition } from '@/types/train.types';
import { RenderingContext } from '../RenderingContext';
import { IsoDrawable, worldDepth, drawIsoOrientedBox, shade } from '../iso';

// Heights in world units for iso extrusion
const LOCO_HEIGHT = 14;
const CARRIAGE_HEIGHT = 11;

/**
 * Renders trains on the canvas
 */
export class TrainRenderer {
  /**
   * Render all trains (top-down flat view). In iso, trains are drawn in the
   * depth-sorted tall phase via collectIsoDrawables, so this is a no-op there.
   */
  renderAll(
    trains: Map<string, Train>,
    renderCtx: RenderingContext,
    selectedId?: string | null
  ): void {
    if (renderCtx.getViewMode() !== 'topdown') return;

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
   * Collect locomotive + carriages as depth-tagged iso boxes for the tall phase.
   * Each car sorts independently so a train correctly weaves behind buildings.
   */
  collectIsoDrawables(
    trains: Map<string, Train>,
    renderCtx: RenderingContext,
    selectedId?: string | null
  ): IsoDrawable[] {
    const ctx = renderCtx.getContext();
    const drawables: IsoDrawable[] = [];
    const carriageColors = ['#8B4513', '#2F4F4F', '#4A4A4A'];

    for (const train of trains.values()) {
      const isSelected = train.id === selectedId;

      // Carriages
      (train.carriagePositions ?? []).forEach((cp, i) => {
        drawables.push({
          depth: worldDepth(cp.worldPosition),
          draw: () =>
            drawIsoOrientedBox(
              ctx,
              renderCtx,
              cp.worldPosition,
              cp.direction,
              train.carriageLength / 2,
              train.width / 2,
              CARRIAGE_HEIGHT,
              carriageColors[i % carriageColors.length]
            ),
        });
      });

      // Locomotive
      const pos = train.position;
      drawables.push({
        depth: worldDepth(pos.worldPosition) + 0.01, // slight bias: loco over its tender
        draw: () => this.drawLocomotiveIso(ctx, renderCtx, train, isSelected),
      });
    }

    return drawables;
  }

  /**
   * Draw the locomotive as an iso box with a cab, chimney and steam.
   */
  private drawLocomotiveIso(
    ctx: CanvasRenderingContext2D,
    renderCtx: RenderingContext,
    train: Train,
    isSelected: boolean
  ): void {
    const { worldPosition, direction } = train.position;

    // Main body
    drawIsoOrientedBox(
      ctx,
      renderCtx,
      worldPosition,
      direction,
      train.length / 2,
      train.width / 2,
      LOCO_HEIGHT,
      train.color || '#8B0000',
      { selected: isSelected }
    );

    // Chimney: a small box near the front, sitting on top of the body
    const front = new Vector2D(
      worldPosition.x + direction.x * (train.length * 0.32),
      worldPosition.y + direction.y * (train.length * 0.32)
    );
    drawIsoOrientedBox(
      ctx,
      renderCtx,
      front,
      direction,
      train.width * 0.18,
      train.width * 0.18,
      LOCO_HEIGHT + 7,
      '#2F4F4F'
    );

    // Steam puffs rising from the chimney top (screen space)
    if (Math.abs(train.velocity) > 1) {
      const z = renderCtx.getViewport().zoom;
      const top = renderCtx.project(front, LOCO_HEIGHT + 7);
      const time = Date.now() / 200;
      for (let i = 0; i < 3; i++) {
        const offset = (time + i * 1.5) % 4;
        const alpha = Math.max(0, 1 - offset / 4);
        ctx.fillStyle = `rgba(210,210,210,${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(
          top.x + offset * 2 * z,
          top.y - offset * 6 * z,
          (3 + offset) * z,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    // Headlamp glow at the very front
    const z = renderCtx.getViewport().zoom;
    const lampWorld = new Vector2D(
      worldPosition.x + direction.x * (train.length / 2),
      worldPosition.y + direction.y * (train.length / 2)
    );
    const lamp = renderCtx.project(lampWorld, LOCO_HEIGHT * 0.5);
    ctx.fillStyle = shade('#FFFF66', 1);
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 2 * z, 0, Math.PI * 2);
    ctx.fill();
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
    _velocity: number
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
