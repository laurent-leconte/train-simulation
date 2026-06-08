import { Vector2D } from '@/core/geometry/Vector2D';
import { Train, CarriagePosition } from '@/types/train.types';
import { RenderingContext } from '../RenderingContext';
import { IsoDrawable, worldDepth, drawIsoOrientedBox, shade, faceQuad, fillPoly } from '../iso';

// Heights in world units for iso extrusion
const LOCO_HEIGHT = 13;
const CAB_HEIGHT = 18;
const CARRIAGE_HEIGHT = 12;

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
        const color = carriageColors[i % carriageColors.length];
        drawables.push({
          depth: worldDepth(cp.worldPosition),
          draw: () => this.drawCarriageIso(ctx, renderCtx, cp, train.carriageLength, train.width, color),
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
   * Draw a passenger carriage as an extruded box with an underframe, a window
   * band, a waist stripe and a slightly lighter roof.
   */
  private drawCarriageIso(
    ctx: CanvasRenderingContext2D,
    renderCtx: RenderingContext,
    cp: CarriagePosition,
    length: number,
    width: number,
    color: string
  ): void {
    drawIsoOrientedBox(
      ctx,
      renderCtx,
      cp.worldPosition,
      cp.direction,
      length / 2,
      width / 2,
      CARRIAGE_HEIGHT,
      color,
      {
        topColor: shade(color, 1.18),
        decorateFace: (face) => {
          // Underframe / skirt
          fillPoly(ctx, faceQuad(face, 0.0, 0.0, 1.0, 0.16), 'rgba(15,15,15,0.85)');
          // Window band
          const n = 4;
          const span = 0.78;
          const slot = span / n;
          for (let k = 0; k < n; k++) {
            const u0 = 0.11 + k * slot + slot * 0.18;
            const u1 = 0.11 + k * slot + slot * 0.82;
            fillPoly(ctx, faceQuad(face, u0, 0.44, u1, 0.74), '#bfe3f2', 'rgba(0,0,0,0.3)');
          }
          // Waist stripe just below the windows
          fillPoly(ctx, faceQuad(face, 0.0, 0.34, 1.0, 0.4), shade(color, 0.6));
        },
      }
    );
  }

  /**
   * Draw the locomotive as a small steam engine: boiler + cab (depth-sorted
   * bodies), then chimney + dome on top, then headlamp and steam.
   */
  private drawLocomotiveIso(
    ctx: CanvasRenderingContext2D,
    renderCtx: RenderingContext,
    train: Train,
    isSelected: boolean
  ): void {
    const { worldPosition: pos, direction: dir } = train.position;
    const L = train.length;
    const W = train.width;
    const body = train.color || '#8B0000';
    const cabColor = shade(body, 0.55);

    const along = (d: number) => new Vector2D(pos.x + dir.x * d, pos.y + dir.y * d);

    // Two main bodies, drawn far-to-near so the cab occludes correctly.
    const boilerCenter = along(L * 0.1);
    const cabCenter = along(-L * 0.3);
    const bodies = [
      {
        depth: worldDepth(boilerCenter),
        draw: () =>
          drawIsoOrientedBox(ctx, renderCtx, boilerCenter, dir, L * 0.4, W * 0.42, LOCO_HEIGHT, body, {
            selected: isSelected,
            topColor: shade(body, 1.15),
            decorateFace: (face) => {
              // Boiler bands
              for (const u of [0.25, 0.5, 0.75]) {
                fillPoly(ctx, faceQuad(face, u - 0.02, 0.05, u + 0.02, 0.95), shade('#FFD700', 0.9));
              }
            },
          }),
      },
      {
        depth: worldDepth(cabCenter),
        draw: () =>
          drawIsoOrientedBox(ctx, renderCtx, cabCenter, dir, L * 0.2, W / 2, CAB_HEIGHT, cabColor, {
            selected: isSelected,
            topColor: shade(cabColor, 1.2),
            decorateFace: (face) => {
              // Cab window
              fillPoly(ctx, faceQuad(face, 0.25, 0.45, 0.75, 0.8), '#bfe3f2', 'rgba(0,0,0,0.3)');
            },
          }),
      },
    ];
    bodies.sort((a, b) => a.depth - b.depth).forEach((p) => p.draw());

    // Chimney + steam dome sit on top of the boiler.
    const chimney = along(L * 0.32);
    const dome = along(L * 0.05);
    const fittings = [
      { depth: worldDepth(dome), draw: () => drawIsoOrientedBox(ctx, renderCtx, dome, dir, W * 0.16, W * 0.22, LOCO_HEIGHT + 4, '#3a3a3a') },
      { depth: worldDepth(chimney), draw: () => drawIsoOrientedBox(ctx, renderCtx, chimney, dir, W * 0.16, W * 0.16, LOCO_HEIGHT + 9, '#2b2b2b', { topColor: '#444' }) },
    ];
    fittings.sort((a, b) => a.depth - b.depth).forEach((p) => p.draw());

    const z = renderCtx.getViewport().zoom;

    // Steam puffs rising from the chimney top (screen space)
    if (Math.abs(train.velocity) > 1) {
      const top = renderCtx.project(chimney, LOCO_HEIGHT + 9);
      const time = Date.now() / 200;
      for (let i = 0; i < 3; i++) {
        const offset = (time + i * 1.5) % 4;
        const alpha = Math.max(0, 1 - offset / 4);
        ctx.fillStyle = `rgba(220,220,220,${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(top.x + offset * 2 * z, top.y - offset * 6 * z, (2.5 + offset) * z, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Headlamp glow at the very front
    const lamp = renderCtx.project(along(L / 2), LOCO_HEIGHT * 0.5);
    ctx.fillStyle = '#FFF59D';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 2.2 * z, 0, Math.PI * 2);
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
