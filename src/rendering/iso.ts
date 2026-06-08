import { Vector2D } from '@/core/geometry/Vector2D';
import { RenderingContext } from './RenderingContext';

/**
 * Helpers for 2.5D ("isometric") rendering of objects that have height.
 *
 * The flat ground plane (rails, grid, platforms) projects for free via the
 * affine matrix in RenderingContext. Height, however, is non-affine, so "tall"
 * objects are drawn in SCREEN space: we project their world footprint, lift the
 * top by `height`, and paint the visible faces as polygons.
 */

/**
 * A deferred draw call for a tall object, tagged with its scene depth so the
 * caller can paint everything back-to-front (painter's algorithm).
 */
export interface IsoDrawable {
  depth: number;
  draw: () => void;
}

/**
 * Scene depth along the iso view axis. Larger = nearer the camera (drawn last).
 */
export function worldDepth(world: Vector2D): number {
  return world.x + world.y;
}

/**
 * Multiply a #rrggbb color by a brightness factor, returning a CSS rgb() string.
 */
export function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `rgb(${r},${g},${b})`;
}

/** Fill (and optionally stroke) a polygon given screen-space points. */
export function fillPoly(
  ctx: CanvasRenderingContext2D,
  pts: Vector2D[],
  fill: string,
  stroke?: string
): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** A single visible side face of a prism, in screen space. */
export interface IsoFace {
  /** Screen corners in order: bottom-i, bottom-j, top-j, top-i. */
  corners: [Vector2D, Vector2D, Vector2D, Vector2D];
  bright: number;
}

export interface IsoPrismOptions {
  outline?: boolean;
  topColor?: string;
  selected?: boolean;
  /** Called per visible side face so callers can paint windows, doors, etc. */
  decorateFace?: (face: IsoFace) => void;
  /** Called with the top face screen corners for roof details. */
  decorateTop?: (corners: Vector2D[]) => void;
}

/**
 * Map a (u, v) rectangle on a face to a screen polygon. u runs along the face
 * (i→j), v runs bottom→top. Faces are parallelograms so the map is linear.
 */
export function faceQuad(
  face: IsoFace,
  u0: number,
  v0: number,
  u1: number,
  v1: number
): Vector2D[] {
  const [bi, bj, , ti] = face.corners;
  const du = bj.subtract(bi);
  const dv = ti.subtract(bi);
  const p = (u: number, v: number) => bi.add(du.multiply(u)).add(dv.multiply(v));
  return [p(u0, v0), p(u1, v0), p(u1, v1), p(u0, v1)];
}

/**
 * Draw an extruded prism (a box with a flat top) from a list of world-space
 * footprint corners. Works for any footprint orientation. Back faces are culled
 * (only the 2 camera-facing sides remain), then painted, then the top.
 *
 * Shading gives form without a real light: the top is brightest, and side faces
 * aligned with world-x read brighter than those aligned with world-y.
 */
export function drawIsoPrism(
  ctx: CanvasRenderingContext2D,
  rc: RenderingContext,
  corners: Vector2D[],
  height: number,
  baseColor: string,
  options: IsoPrismOptions = {}
): void {
  const outline = options.outline !== false;
  const strokeColor = options.selected ? '#FDE68A' : 'rgba(0,0,0,0.35)';

  const bottom = corners.map((w) => rc.worldToScreen(w));
  const top = corners.map((w) => rc.project(w, height));

  // Footprint centroid (world) — used to orient face normals outward.
  let cxw = 0;
  let cyw = 0;
  for (const c of corners) {
    cxw += c.x;
    cyw += c.y;
  }
  cxw /= corners.length;
  cyw /= corners.length;

  // Build the camera-facing side faces (cull back faces).
  const faces: Array<{ depth: number; face: IsoFace }> = [];
  for (let i = 0; i < corners.length; i++) {
    const j = (i + 1) % corners.length;
    const ci = corners[i];
    const cj = corners[j];

    // Outward normal (world), flipped to point away from the footprint center.
    let nx = cj.y - ci.y;
    let ny = -(cj.x - ci.x);
    const midx = (ci.x + cj.x) / 2;
    const midy = (ci.y + cj.y) / 2;
    if (nx * (midx - cxw) + ny * (midy - cyw) < 0) {
      nx = -nx;
      ny = -ny;
    }

    // Visible only if the outward normal points toward the camera (depth = x+y
    // increases that way).
    if (nx + ny <= 0) continue;

    const nlen = Math.hypot(nx, ny) || 1;
    faces.push({
      depth: midx + midy,
      face: {
        corners: [bottom[i], bottom[j], top[j], top[i]],
        bright: 0.55 + 0.22 * Math.abs(nx / nlen),
      },
    });
  }

  // Paint farther faces first.
  faces.sort((a, b) => a.depth - b.depth);
  for (const { face } of faces) {
    fillPoly(ctx, face.corners, shade(baseColor, face.bright), outline ? strokeColor : undefined);
    options.decorateFace?.(face);
  }

  // Top face last (always visible from above).
  fillPoly(ctx, top, options.topColor ?? shade(baseColor, 1.0), outline ? strokeColor : undefined);
  options.decorateTop?.(top);
}

/**
 * Draw a gable (pitched) roof over an oriented footprint. The ridge runs along
 * `direction`; the two slopes drop to the long eaves. Visible slopes + gable
 * ends are depth-sorted. Used to give station buildings a real roofline.
 */
export function drawIsoGableRoof(
  ctx: CanvasRenderingContext2D,
  rc: RenderingContext,
  center: Vector2D,
  direction: Vector2D,
  halfLen: number,
  halfWid: number,
  baseHeight: number,
  roofHeight: number,
  color: string
): void {
  const len = Math.hypot(direction.x, direction.y) || 1;
  const fx = direction.x / len;
  const fy = direction.y / len;
  const px = -fy;
  const py = fx;

  const w = (sl: number, sw: number) =>
    new Vector2D(center.x + fx * halfLen * sl + px * halfWid * sw, center.y + fy * halfLen * sl + py * halfWid * sw);
  const ridge = (sl: number) => new Vector2D(center.x + fx * halfLen * sl, center.y + fy * halfLen * sl);

  // Eave corners (at baseHeight) and ridge ends (at baseHeight + roofHeight).
  const A = w(1, 1);
  const B = w(1, -1);
  const C = w(-1, -1);
  const D = w(-1, 1);
  const R1 = ridge(1);
  const R2 = ridge(-1);

  const sBase = (p: Vector2D) => rc.project(p, baseHeight);
  const sTop = (p: Vector2D) => rc.project(p, baseHeight + roofHeight);

  const polys: Array<{ depth: number; pts: Vector2D[]; bright: number }> = [
    // slope on +perp side
    { depth: (A.x + A.y + D.x + D.y) / 2, pts: [sBase(A), sBase(D), sTop(R2), sTop(R1)], bright: 0.95 },
    // slope on -perp side
    { depth: (B.x + B.y + C.x + C.y) / 2, pts: [sBase(B), sBase(C), sTop(R2), sTop(R1)], bright: 0.7 },
    // gable end at +len
    { depth: (A.x + A.y + B.x + B.y) / 2 + 0.5, pts: [sBase(A), sBase(B), sTop(R1)], bright: 0.82 },
    // gable end at -len
    { depth: (C.x + C.y + D.x + D.y) / 2 - 0.5, pts: [sBase(C), sBase(D), sTop(R2)], bright: 0.82 },
  ];

  polys.sort((a, b) => a.depth - b.depth);
  for (const poly of polys) {
    fillPoly(ctx, poly.pts, shade(color, poly.bright), 'rgba(0,0,0,0.35)');
  }
}

/**
 * Convenience: an axis-aligned box centered at a world point, with half-extents
 * along world x/y. Corners are ordered north, east, south, west.
 */
export function drawIsoBox(
  ctx: CanvasRenderingContext2D,
  rc: RenderingContext,
  center: Vector2D,
  halfX: number,
  halfY: number,
  height: number,
  baseColor: string,
  options?: IsoPrismOptions
): void {
  const corners = [
    new Vector2D(center.x - halfX, center.y - halfY), // north (back)
    new Vector2D(center.x + halfX, center.y - halfY), // east (right)
    new Vector2D(center.x + halfX, center.y + halfY), // south (front)
    new Vector2D(center.x - halfX, center.y + halfY), // west (left)
  ];
  drawIsoPrism(ctx, rc, corners, height, baseColor, options);
}

/**
 * Convenience: an oriented box centered at a world point, extending halfLen
 * along `direction` and halfWid perpendicular to it. Used for trains.
 */
export function drawIsoOrientedBox(
  ctx: CanvasRenderingContext2D,
  rc: RenderingContext,
  center: Vector2D,
  direction: Vector2D,
  halfLen: number,
  halfWid: number,
  height: number,
  baseColor: string,
  options?: IsoPrismOptions
): void {
  const len = Math.hypot(direction.x, direction.y) || 1;
  const fx = direction.x / len;
  const fy = direction.y / len;
  const px = -fy; // perpendicular
  const py = fx;

  const corner = (sl: number, sw: number) =>
    new Vector2D(
      center.x + fx * halfLen * sl + px * halfWid * sw,
      center.y + fy * halfLen * sl + py * halfWid * sw
    );

  const corners = [corner(1, 1), corner(1, -1), corner(-1, -1), corner(-1, 1)];
  drawIsoPrism(ctx, rc, corners, height, baseColor, options);
}
