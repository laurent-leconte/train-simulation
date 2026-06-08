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

/**
 * Draw an extruded prism (a box with a flat top) from a list of world-space
 * footprint corners. Works for any footprint orientation: the vertical side
 * faces are depth-sorted and painted back-to-front, then the top face on top.
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
  options: { outline?: boolean; topColor?: string; selected?: boolean } = {}
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

  // Build side faces with a depth key and brightness.
  const faces: Array<{ depth: number; pts: Vector2D[]; bright: number }> = [];
  for (let i = 0; i < corners.length; i++) {
    const j = (i + 1) % corners.length;
    const ci = corners[i];
    const cj = corners[j];

    // Outward normal of this face (world space), flipped to point away from center.
    let nx = cj.y - ci.y;
    let ny = -(cj.x - ci.x);
    const midx = (ci.x + cj.x) / 2;
    const midy = (ci.y + cj.y) / 2;
    if (nx * (midx - cxw) + ny * (midy - cyw) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const nlen = Math.hypot(nx, ny) || 1;
    const bright = 0.55 + 0.22 * Math.abs(nx / nlen);

    faces.push({
      depth: midx + midy,
      pts: [bottom[i], bottom[j], top[j], top[i]],
      bright,
    });
  }

  // Paint farther faces first.
  faces.sort((a, b) => a.depth - b.depth);
  for (const f of faces) {
    fillPoly(ctx, f.pts, shade(baseColor, f.bright), outline ? strokeColor : undefined);
  }

  // Top face last (always visible from above).
  fillPoly(ctx, top, options.topColor ?? shade(baseColor, 1.0), outline ? strokeColor : undefined);
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
  options?: { outline?: boolean; topColor?: string; selected?: boolean }
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
  options?: { outline?: boolean; topColor?: string; selected?: boolean }
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
