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

// 3D view + light vectors for curved-surface shading. VIEW points toward the
// camera (so faces with normal·VIEW > 0 are visible); for horizontal normals
// (z=0) this reduces to the same x+y>0 test used by flat prisms. LIGHT is a
// fixed key light from the upper-front-left.
const VIEW3 = norm3([1, 1, 1.25]);
const LIGHT3 = norm3([-0.35, -0.55, 0.78]);

function norm3(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function dot3(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
/** Shade a base color by a 3D surface normal under the fixed key light. */
function lit(color: string, n: [number, number, number]): string {
  return shade(color, 0.42 + 0.58 * Math.max(0, dot3(n, LIGHT3)));
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
  /** Lift the whole prism so its underside sits at this world height. */
  baseHeight?: number;
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
  const baseHeight = options.baseHeight ?? 0;

  const bottom = corners.map((w) => rc.project(w, baseHeight));
  const top = corners.map((w) => rc.project(w, baseHeight + height));

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

export interface IsoCylinderOptions {
  segments?: number;
  /** Draw only an angular slice of the tube (e.g. 0..π for a half-pipe roof). */
  arcStart?: number;
  arcEnd?: number;
  caps?: boolean;
  outline?: boolean;
}

/**
 * Draw a horizontal cylinder whose axis runs along `direction` at world height
 * `axisHeight`. Rendered as a culled, shaded triangle-band mesh, so it reads as
 * a rounded surface at any heading. Used for boilers and curved roofs.
 */
export function drawIsoCylinder(
  ctx: CanvasRenderingContext2D,
  rc: RenderingContext,
  center: Vector2D,
  direction: Vector2D,
  halfLen: number,
  radius: number,
  axisHeight: number,
  color: string,
  options: IsoCylinderOptions = {}
): void {
  const segs = options.segments ?? 16;
  const a0 = options.arcStart ?? 0;
  const a1 = options.arcEnd ?? Math.PI * 2;
  const drawCaps = options.caps ?? true;
  const outline = options.outline ? 'rgba(0,0,0,0.2)' : undefined;

  const len = Math.hypot(direction.x, direction.y) || 1;
  const fx = direction.x / len;
  const fy = direction.y / len;
  const px = -fy;
  const py = fx;
  const fC = new Vector2D(center.x + fx * halfLen, center.y + fy * halfLen);
  const rC = new Vector2D(center.x - fx * halfLen, center.y - fy * halfLen);
  const step = (a1 - a0) / segs;

  // A ring point at angle t around the axis, on the end cap at center C.
  const ring = (C: Vector2D, t: number) =>
    rc.project(
      new Vector2D(C.x + px * Math.cos(t) * radius, C.y + py * Math.cos(t) * radius),
      axisHeight + Math.sin(t) * radius
    );

  // Body: visible front-facing quads (convex surface → no self-overlap).
  for (let k = 0; k < segs; k++) {
    const t0 = a0 + k * step;
    const t1 = t0 + step;
    const tm = t0 + step / 2;
    const n: [number, number, number] = [px * Math.cos(tm), py * Math.cos(tm), Math.sin(tm)];
    if (dot3(n, VIEW3) <= 0) continue;
    fillPoly(ctx, [ring(fC, t0), ring(fC, t1), ring(rC, t1), ring(rC, t0)], lit(color, n), outline);
  }

  // The single visible end cap (drawn on top of the body).
  if (drawCaps) {
    for (const e of [
      { C: fC, n: [fx, fy, 0] as [number, number, number] },
      { C: rC, n: [-fx, -fy, 0] as [number, number, number] },
    ]) {
      if (dot3(e.n, VIEW3) <= 0) continue;
      const pts: Vector2D[] = [];
      for (let k = 0; k <= segs; k++) pts.push(ring(e.C, a0 + k * step));
      fillPoly(ctx, pts, lit(color, e.n), outline);
    }
  }
}

/**
 * Draw a vertical cylinder (axis along world up) between baseZ and topZ. Used
 * for smokestacks and domes so they sit on top of the boiler.
 */
export function drawIsoVCylinder(
  ctx: CanvasRenderingContext2D,
  rc: RenderingContext,
  center: Vector2D,
  radius: number,
  baseZ: number,
  topZ: number,
  color: string,
  options: { segments?: number; outline?: boolean } = {}
): void {
  const segs = options.segments ?? 16;
  const outline = options.outline ? 'rgba(0,0,0,0.2)' : undefined;
  const step = (Math.PI * 2) / segs;
  const ring = (z: number, t: number) =>
    rc.project(new Vector2D(center.x + Math.cos(t) * radius, center.y + Math.sin(t) * radius), z);

  // Front-facing side quads.
  for (let k = 0; k < segs; k++) {
    const t0 = k * step;
    const t1 = t0 + step;
    const tm = t0 + step / 2;
    const n: [number, number, number] = [Math.cos(tm), Math.sin(tm), 0];
    if (dot3(n, VIEW3) <= 0) continue;
    fillPoly(ctx, [ring(topZ, t0), ring(topZ, t1), ring(baseZ, t1), ring(baseZ, t0)], lit(color, n), outline);
  }

  // Top cap.
  const top: Vector2D[] = [];
  for (let k = 0; k <= segs; k++) top.push(ring(topZ, k * step));
  fillPoly(ctx, top, lit(color, [0, 0, 1]), outline);
}

/**
 * Draw a wheel: a disc standing in the vertical plane of `direction` (axle
 * along the perpendicular), centered at world `center`, height z.
 */
export function drawIsoDisc(
  ctx: CanvasRenderingContext2D,
  rc: RenderingContext,
  center: Vector2D,
  direction: Vector2D,
  radius: number,
  z: number,
  color: string,
  options: { spokes?: number; rim?: boolean } = {}
): void {
  const zoom = rc.getViewport().zoom;
  const len = Math.hypot(direction.x, direction.y) || 1;
  const du = new Vector2D(direction.x / len, direction.y / len);
  const c0 = rc.project(center, z);
  // Screen vector for one world unit along the wheel's in-plane (forward) axis.
  const aDir = rc.worldToScreen(new Vector2D(center.x + du.x, center.y + du.y)).subtract(rc.worldToScreen(center));
  const segs = 18;

  const point = (r: number, t: number) =>
    new Vector2D(c0.x + Math.cos(t) * aDir.x * r, c0.y + Math.cos(t) * aDir.y * r - Math.sin(t) * r * zoom);
  const ellipse = (r: number): Vector2D[] => {
    const pts: Vector2D[] = [];
    for (let k = 0; k < segs; k++) pts.push(point(r, (k / segs) * Math.PI * 2));
    return pts;
  };

  // Tyre
  fillPoly(ctx, ellipse(radius), color, 'rgba(0,0,0,0.45)');
  // Bright steel rim
  if (options.rim !== false) {
    const rim = ellipse(radius * 0.88);
    ctx.beginPath();
    rim.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.strokeStyle = '#6b7079';
    ctx.lineWidth = Math.max(1, zoom * 0.9);
    ctx.stroke();
  }
  // Spokes
  if (options.spokes) {
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = Math.max(1, zoom * 0.7);
    for (let i = 0; i < options.spokes; i++) {
      const p = point(radius * 0.82, (i / options.spokes) * Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(c0.x, c0.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }
  // Hub
  fillPoly(ctx, ellipse(radius * 0.32), shade(color, 2.4));
}

/**
 * Draw a horizontal "capsule" cylinder with a round (circular) cross-section
 * and a cylindrical top-to-bottom light gradient. Unlike drawIsoCylinder this
 * keeps the cross-section visually round at any heading (used for the boiler).
 * Returns the front/rear cap screen centers and screen radius so callers can
 * add details (smokebox door, headlamp).
 */
export function drawIsoCapsule(
  ctx: CanvasRenderingContext2D,
  rc: RenderingContext,
  center: Vector2D,
  direction: Vector2D,
  halfLen: number,
  radius: number,
  axisHeight: number,
  color: string
): { front: Vector2D; rear: Vector2D; screenRadius: number } {
  const zoom = rc.getViewport().zoom;
  const len = Math.hypot(direction.x, direction.y) || 1;
  const fx = direction.x / len;
  const fy = direction.y / len;
  const A = rc.project(new Vector2D(center.x + fx * halfLen, center.y + fy * halfLen), axisHeight);
  const B = rc.project(new Vector2D(center.x - fx * halfLen, center.y - fy * halfLen), axisHeight);
  const rs = radius * zoom;

  // Screen axis + perpendicular.
  let ax = A.x - B.x;
  let ay = A.y - B.y;
  const al = Math.hypot(ax, ay) || 1;
  ax /= al;
  ay /= al;
  const pxs = -ay;
  const pys = ax;

  // Gradient across the tube: the upper screen side is lit.
  const sgn = pys < 0 ? 1 : -1;
  const mx = (A.x + B.x) / 2;
  const my = (A.y + B.y) / 2;
  const g = ctx.createLinearGradient(mx + pxs * rs * sgn, my + pys * rs * sgn, mx - pxs * rs * sgn, my - pys * rs * sgn);
  g.addColorStop(0, shade(color, 1.18));
  g.addColorStop(0.45, shade(color, 0.98));
  g.addColorStop(1, shade(color, 0.52));
  ctx.fillStyle = g;

  // Body (stadium) + round caps, filled separately with the same (canvas-space)
  // gradient so they blend without winding artifacts.
  ctx.beginPath();
  ctx.moveTo(A.x + pxs * rs, A.y + pys * rs);
  ctx.lineTo(B.x + pxs * rs, B.y + pys * rs);
  ctx.lineTo(B.x - pxs * rs, B.y - pys * rs);
  ctx.lineTo(A.x - pxs * rs, A.y - pys * rs);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(A.x, A.y, rs, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(B.x, B.y, rs, 0, Math.PI * 2);
  ctx.fill();

  return { front: A, rear: B, screenRadius: rs };
}
