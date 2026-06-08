import { Vector2D } from '@/core/geometry/Vector2D';
import { Train, CarriagePosition } from '@/types/train.types';
import { RenderingContext } from '../RenderingContext';
import {
  IsoDrawable,
  worldDepth,
  drawIsoOrientedBox,
  drawIsoCylinder,
  drawIsoVCylinder,
  drawIsoDisc,
  drawIsoCapsule,
  shade,
  faceQuad,
  fillPoly,
} from '../iso';

// A loco/carriage part with paint order: lower layer first, then by scene depth.
interface Part {
  layer: number;
  depth: number;
  draw: () => void;
}

/** Paint parts back-to-front: by layer, then by scene depth within a layer. */
function drawParts(parts: Part[]): void {
  parts.sort((a, b) => (a.layer !== b.layer ? a.layer - b.layer : a.depth - b.depth));
  for (const p of parts) p.draw();
}

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
   * Draw a passenger carriage: a body elevated over its bogies, a rounded roof,
   * a window band, a high-contrast waist stripe, and four wheels.
   */
  private drawCarriageIso(
    ctx: CanvasRenderingContext2D,
    renderCtx: RenderingContext,
    cp: CarriagePosition,
    length: number,
    width: number,
    color: string
  ): void {
    const pos = cp.worldPosition;
    const dir = cp.direction;
    const W = width;
    const len = Math.hypot(dir.x, dir.y) || 1;
    const fx = dir.x / len;
    const fy = dir.y / len;
    const px = -fy;
    const py = fx;
    const nearSign = px + py >= 0 ? 1 : -1;

    const wheelR = W * 0.2;
    const floorZ = W * 0.32;
    const bodyH = W * 1.05;
    const halfWid = W * 0.46;

    const parts: Part[] = [];

    // Bogie wheels (two near each end), split near/far so the body occludes
    // the far ones and the near ones sit in front.
    for (const wx of [length * 0.34, length * 0.12, -length * 0.12, -length * 0.34]) {
      for (const s of [1, -1]) {
        const c = new Vector2D(pos.x + fx * wx + px * halfWid * 0.85 * s, pos.y + fy * wx + py * halfWid * 0.85 * s);
        parts.push({ layer: s === nearSign ? 3 : 0, depth: c.x + c.y, draw: () => drawIsoDisc(ctx, renderCtx, c, dir, wheelR, wheelR, '#14171b') });
      }
    }

    // Body
    parts.push({
      layer: 1,
      depth: pos.x + pos.y,
      draw: () =>
        drawIsoOrientedBox(ctx, renderCtx, pos, dir, length / 2, halfWid, bodyH, color, {
          baseHeight: floorZ,
          topColor: shade(color, 1.1),
          decorateFace: (face) => {
            // Waist stripe (cream — high contrast against the body)
            fillPoly(ctx, faceQuad(face, 0.0, 0.28, 1.0, 0.4), '#e8dcc0');
            // Window band — long sides get 4 windows, short ends get 2.
            const [bi, bj] = face.corners;
            const approxLen = Math.hypot(bj.x - bi.x, bj.y - bi.y) / renderCtx.getViewport().zoom;
            const n = approxLen > 20 ? 4 : 2;
            const slot = 0.78 / n;
            for (let k = 0; k < n; k++) {
              const u0 = 0.11 + k * slot + slot * 0.2;
              const u1 = 0.11 + k * slot + slot * 0.8;
              fillPoly(ctx, faceQuad(face, u0, 0.48, u1, 0.82), '#bfe3f2', 'rgba(0,0,0,0.3)');
            }
            // Underframe shadow
            fillPoly(ctx, faceQuad(face, 0.0, 0.0, 1.0, 0.1), 'rgba(10,10,10,0.8)');
          },
        }),
    });

    // Rounded roof (half-cylinder along the body); caps close the ends.
    parts.push({
      layer: 2,
      depth: pos.x + pos.y + 0.1,
      draw: () =>
        drawIsoCylinder(ctx, renderCtx, pos, dir, length / 2, halfWid, floorZ + bodyH, shade(color, 0.78), {
          arcStart: 0,
          arcEnd: Math.PI,
          caps: true,
        }),
    });

    drawParts(parts);
  }

  /**
   * Draw the locomotive as a small steam engine built from primitives:
   * cylindrical boiler, smokebox, cab with a curved roof, stack + domes sitting
   * on the boiler, driving wheels, headlamp and steam.
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
    const cabColor = '#1c1c1c';

    const len = Math.hypot(dir.x, dir.y) || 1;
    const fx = dir.x / len;
    const fy = dir.y / len;
    const px = -fy;
    const py = fx;
    const nearSign = px + py >= 0 ? 1 : -1;
    const along = (d: number) => new Vector2D(pos.x + fx * d, pos.y + fy * d);

    const boilerR = W * 0.4;
    const boilerZ = W * 0.62; // axis height (leaves room for wheels below)
    const boilerTop = boilerZ + boilerR;

    const parts: Part[] = [];

    const driveWheelR = W * 0.3;
    const cabWheelR = W * 0.44; // larger wheel under the cab
    const wheelOffset = W * 0.46;
    const addWheels = (wx: number, r: number) => {
      for (const s of [1, -1]) {
        const c = new Vector2D(pos.x + fx * wx + px * wheelOffset * s, pos.y + fy * wx + py * wheelOffset * s);
        parts.push({ layer: s === nearSign ? 4 : 0, depth: c.x + c.y, draw: () => drawIsoDisc(ctx, renderCtx, c, dir, r, r, '#14171b') });
      }
    };

    // Boiler as a round capsule, with smokebox door + oval headlamp at the front.
    const boilerC = along(L * 0.06);
    const boilerHalf = L * 0.34;
    parts.push({
      layer: 1,
      depth: boilerC.x + boilerC.y,
      draw: () => {
        drawIsoCapsule(ctx, renderCtx, boilerC, dir, boilerHalf, boilerR, boilerZ, body);
        const front = renderCtx.project(along(L * 0.06 + boilerHalf), boilerZ);
        const rs = boilerR * renderCtx.getViewport().zoom;
        // Smokebox door (dark) on the front cap
        ctx.beginPath();
        ctx.arc(front.x, front.y, rs * 0.85, 0, Math.PI * 2);
        ctx.fillStyle = shade(body, 0.4);
        ctx.fill();
        // Headlamp — a small oval, foreshortened like the front face
        ctx.fillStyle = '#FFF1A8';
        ctx.beginPath();
        ctx.ellipse(front.x, front.y + rs * 0.12, rs * 0.22, rs * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
      },
    });

    // Three driving wheels, centered under the boiler.
    for (const wx of [L * 0.06 - L * 0.16, L * 0.06, L * 0.06 + L * 0.16]) addWheels(wx, driveWheelR);

    // Cab at the rear, raised on a footplate so a larger wheel shows beneath.
    const cabC = along(-L * 0.34);
    const cabBase = W * 0.42;
    const cabH = W * 0.82;
    const cabTop = cabBase + cabH;
    addWheels(-L * 0.34, cabWheelR);
    parts.push({
      layer: 1,
      depth: cabC.x + cabC.y,
      draw: () =>
        drawIsoOrientedBox(ctx, renderCtx, cabC, dir, L * 0.14, W * 0.5, cabH, cabColor, {
          baseHeight: cabBase,
          selected: isSelected,
          decorateFace: (face) => {
            fillPoly(ctx, faceQuad(face, 0.22, 0.4, 0.78, 0.82), '#bfe3f2', 'rgba(0,0,0,0.3)');
          },
        }),
    });

    // Curved cab roof (half-cylinder), capped ends.
    parts.push({
      layer: 2,
      depth: cabC.x + cabC.y + 0.1,
      draw: () => drawIsoCylinder(ctx, renderCtx, cabC, dir, L * 0.15, W * 0.5, cabTop, '#3a3a3a', { arcStart: 0, arcEnd: Math.PI, caps: true }),
    });

    // Smokestack (vertical cylinder, on the boiler near the front).
    const stack = along(L * 0.3);
    parts.push({
      layer: 3,
      depth: stack.x + stack.y,
      draw: () => drawIsoVCylinder(ctx, renderCtx, stack, W * 0.17, boilerTop - boilerR * 0.25, boilerTop + W * 0.55, '#262626', { outline: true }),
    });

    // Steam dome + sand dome (short vertical cylinders on the boiler).
    for (const dx of [L * 0.12, -L * 0.04]) {
      const d = along(dx);
      parts.push({
        layer: 3,
        depth: d.x + d.y,
        draw: () => drawIsoVCylinder(ctx, renderCtx, d, W * 0.16, boilerTop - boilerR * 0.4, boilerTop + W * 0.2, shade(body, 0.65), { outline: true }),
      });
    }

    drawParts(parts);

    // Overlays in screen space: steam from the stack, then headlamp.
    const z = renderCtx.getViewport().zoom;
    if (Math.abs(train.velocity) > 1) {
      const top = renderCtx.project(stack, boilerTop + W * 0.55);
      const time = Date.now() / 200;
      for (let i = 0; i < 3; i++) {
        const offset = (time + i * 1.5) % 4;
        const alpha = Math.max(0, 1 - offset / 4);
        ctx.fillStyle = `rgba(225,225,225,${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(top.x + offset * 2 * z, top.y - offset * 6 * z, (2.5 + offset) * z, 0, Math.PI * 2);
        ctx.fill();
      }
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
