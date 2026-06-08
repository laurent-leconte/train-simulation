import { Vector2D } from '@/core/geometry/Vector2D';
import { Station, TrackSegment } from '@/types/circuit.types';
import { RenderingContext } from '../RenderingContext';
import { IsoDrawable, worldDepth, drawIsoOrientedBox, drawIsoGableRoof, faceQuad, fillPoly } from '../iso';

// Height of station buildings in world units (for iso extrusion)
const BUILDING_HEIGHT = 18;
const BUILDING_HEIGHT_MAIN = 24;
const ROOF_HEIGHT = 8;
const ROOF_HEIGHT_MAIN = 12;
const WALL_COLOR = '#D9C7A3'; // warm sandstone
const WALL_COLOR_SEL = '#F0E2C0';
const ROOF_COLOR = '#9C3B2E'; // brick red
const WINDOW_COLOR = '#9AD1E8';
const DOOR_COLOR = '#5A3B22';

const GRID_SIZE = 50;
const PLATFORM_WIDTH = 12; // Width of platform (perpendicular to track)
const PLATFORM_OFFSET = 8; // Distance from track center to platform edge (closer to rails)
const BUILDING_WIDTH = 18; // Width of station buildings
const BUILDING_OFFSET = PLATFORM_OFFSET + PLATFORM_WIDTH + 2; // Buildings behind platform

/**
 * Renders stations on the canvas
 */
export class StationRenderer {
  /**
   * Render all stations
   */
  renderAll(
    stations: Map<string, Station>,
    segments: Map<string, TrackSegment>,
    renderCtx: RenderingContext,
    selectedId?: string | null
  ): void {
    const ctx = renderCtx.getContext();
    const isTopDown = renderCtx.getViewMode() === 'topdown';

    for (const station of stations.values()) {
      const isSelected = station.id === selectedId;
      this.renderStation(station, segments, ctx, isSelected, isTopDown);
    }
  }

  /**
   * Render a single station's ground elements (platforms always; buildings too
   * in top-down — in iso, buildings are drawn in the depth-sorted tall phase).
   */
  private renderStation(
    station: Station,
    segments: Map<string, TrackSegment>,
    ctx: CanvasRenderingContext2D,
    isSelected: boolean,
    drawBuildings: boolean
  ): void {
    if (station.segmentIds.length === 0) return;

    // Get all segments
    const stationSegments: TrackSegment[] = [];
    for (const segId of station.segmentIds) {
      const seg = segments.get(segId);
      if (seg) stationSegments.push(seg);
    }

    if (stationSegments.length === 0) return;

    ctx.save();

    // Draw platform for each cell (flat ground decal — correct in both views)
    const sideMultiplier = station.side === 'left' ? -1 : 1;

    for (let i = 0; i < stationSegments.length; i++) {
      this.drawCellPlatform(ctx, stationSegments[i], sideMultiplier, isSelected);
      if (drawBuildings) {
        this.drawBuilding(ctx, stationSegments[i], sideMultiplier, isSelected, i, stationSegments.length);
      }
    }

    ctx.restore();
  }

  /**
   * Collect station buildings as depth-tagged iso boxes for the tall phase.
   */
  collectIsoDrawables(
    stations: Map<string, Station>,
    segments: Map<string, TrackSegment>,
    renderCtx: RenderingContext,
    selectedId?: string | null
  ): IsoDrawable[] {
    const ctx = renderCtx.getContext();
    const drawables: IsoDrawable[] = [];

    for (const station of stations.values()) {
      const isSelected = station.id === selectedId;
      const sideMultiplier = station.side === 'left' ? -1 : 1;
      const segs = station.segmentIds
        .map((id) => segments.get(id))
        .filter((s): s is TrackSegment => !!s);

      for (let i = 0; i < segs.length; i++) {
        const segment = segs[i];
        const geom = this.buildingGeometry(segment, sideMultiplier, i, segs.length);
        drawables.push({
          depth: worldDepth(geom.center),
          draw: () => this.drawBuildingIso(ctx, renderCtx, geom, isSelected),
        });
      }
    }

    return drawables;
  }

  /**
   * Shared building footprint geometry (world space) used by both views.
   */
  private buildingGeometry(
    segment: TrackSegment,
    sideMultiplier: number,
    cellIndex: number,
    totalCells: number
  ): { center: Vector2D; direction: Vector2D; length: number; depth: number; isMiddle: boolean } {
    const cellCenterX = segment.gridX * GRID_SIZE + GRID_SIZE / 2;
    const cellCenterY = segment.gridY * GRID_SIZE + GRID_SIZE / 2;

    const start = segment.geometry.start;
    const end = segment.geometry.end;
    const direction = end.subtract(start).normalize();
    const perpendicular = new Vector2D(-direction.y, direction.x);

    const isMiddle = totalCells > 1 && cellIndex === Math.floor(totalCells / 2);
    const depth = isMiddle ? BUILDING_WIDTH + 6 : BUILDING_WIDTH;
    const length = GRID_SIZE - 4;

    const center = new Vector2D(cellCenterX, cellCenterY).add(
      perpendicular.multiply(sideMultiplier * (BUILDING_OFFSET + BUILDING_WIDTH / 2))
    );

    return { center, direction, length, depth, isMiddle };
  }

  /**
   * Draw a station building in iso: walls with windows (and a door on the main
   * building), topped with a pitched gable roof.
   */
  private drawBuildingIso(
    ctx: CanvasRenderingContext2D,
    renderCtx: RenderingContext,
    geom: { center: Vector2D; direction: Vector2D; length: number; depth: number; isMiddle: boolean },
    isSelected: boolean
  ): void {
    const wallHeight = geom.isMiddle ? BUILDING_HEIGHT_MAIN : BUILDING_HEIGHT;
    const roofHeight = geom.isMiddle ? ROOF_HEIGHT_MAIN : ROOF_HEIGHT;
    const z = renderCtx.getViewport().zoom;

    drawIsoOrientedBox(
      ctx,
      renderCtx,
      geom.center,
      geom.direction,
      geom.length / 2,
      geom.depth / 2,
      wallHeight,
      isSelected ? WALL_COLOR_SEL : WALL_COLOR,
      {
        selected: isSelected,
        decorateFace: (face) => {
          const [bi, bj] = face.corners;
          const edgeLen = Math.hypot(bj.x - bi.x, bj.y - bi.y);
          const n = Math.max(1, Math.round(edgeLen / (16 * z)));
          // Window row
          for (let k = 0; k < n; k++) {
            const c = (k + 0.5) / n;
            fillPoly(ctx, faceQuad(face, c - 0.06, 0.42, c + 0.06, 0.72), WINDOW_COLOR, 'rgba(0,0,0,0.3)');
          }
          // Door, centered, on the long visible wall of the main building
          if (geom.isMiddle && n >= 3) {
            fillPoly(ctx, faceQuad(face, 0.45, 0.0, 0.55, 0.5), DOOR_COLOR, 'rgba(0,0,0,0.4)');
          }
        },
      }
    );

    // Pitched roof on top
    drawIsoGableRoof(
      ctx,
      renderCtx,
      geom.center,
      geom.direction,
      geom.length / 2,
      geom.depth / 2,
      wallHeight,
      roofHeight,
      ROOF_COLOR
    );
  }

  /**
   * Draw platform for a single cell
   */
  private drawCellPlatform(
    ctx: CanvasRenderingContext2D,
    segment: TrackSegment,
    sideMultiplier: number,
    isSelected: boolean
  ): void {
    const cellCenterX = segment.gridX * GRID_SIZE + GRID_SIZE / 2;
    const cellCenterY = segment.gridY * GRID_SIZE + GRID_SIZE / 2;

    // Get track direction
    const start = segment.geometry.start;
    const end = segment.geometry.end;
    const direction = end.subtract(start).normalize();
    const perpendicular = new Vector2D(-direction.y, direction.x);

    // Calculate platform position (offset from track)
    const platformCenter = new Vector2D(cellCenterX, cellCenterY)
      .add(perpendicular.multiply(sideMultiplier * (PLATFORM_OFFSET + PLATFORM_WIDTH / 2)));

    ctx.save();
    ctx.translate(platformCenter.x, platformCenter.y);
    ctx.rotate(Math.atan2(direction.y, direction.x));

    // Platform base (gray concrete)
    ctx.fillStyle = isSelected ? '#B8860B' : '#6B7280';
    ctx.fillRect(-GRID_SIZE / 2, -PLATFORM_WIDTH / 2, GRID_SIZE, PLATFORM_WIDTH);

    // Yellow safety line (on track side)
    ctx.fillStyle = '#FCD34D';
    const safetyLineY = sideMultiplier > 0 ? -PLATFORM_WIDTH / 2 : PLATFORM_WIDTH / 2 - 2;
    ctx.fillRect(-GRID_SIZE / 2, safetyLineY, GRID_SIZE, 2);

    // White edge marking
    ctx.fillStyle = '#E5E7EB';
    const edgeY = sideMultiplier > 0 ? PLATFORM_WIDTH / 2 - 1 : -PLATFORM_WIDTH / 2;
    ctx.fillRect(-GRID_SIZE / 2, edgeY, GRID_SIZE, 1);

    // Platform outline
    ctx.strokeStyle = isSelected ? '#FFD700' : '#4B5563';
    ctx.lineWidth = 1;
    ctx.strokeRect(-GRID_SIZE / 2, -PLATFORM_WIDTH / 2, GRID_SIZE, PLATFORM_WIDTH);

    ctx.restore();
  }

  /**
   * Draw station building behind the platform (top-down view showing rooftops)
   */
  private drawBuilding(
    ctx: CanvasRenderingContext2D,
    segment: TrackSegment,
    sideMultiplier: number,
    isSelected: boolean,
    cellIndex: number,
    totalCells: number
  ): void {
    const cellCenterX = segment.gridX * GRID_SIZE + GRID_SIZE / 2;
    const cellCenterY = segment.gridY * GRID_SIZE + GRID_SIZE / 2;

    const start = segment.geometry.start;
    const end = segment.geometry.end;
    const direction = end.subtract(start).normalize();
    const perpendicular = new Vector2D(-direction.y, direction.x);

    // Building position (behind platform)
    const buildingCenter = new Vector2D(cellCenterX, cellCenterY)
      .add(perpendicular.multiply(sideMultiplier * (BUILDING_OFFSET + BUILDING_WIDTH / 2)));

    ctx.save();
    ctx.translate(buildingCenter.x, buildingCenter.y);
    ctx.rotate(Math.atan2(direction.y, direction.x));

    // Determine building style based on position
    const isMiddle = totalCells > 1 && cellIndex === Math.floor(totalCells / 2);
    const buildingDepth = isMiddle ? BUILDING_WIDTH + 6 : BUILDING_WIDTH;
    const buildingLength = GRID_SIZE - 4;

    // Building shadow (offset to suggest height)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(-buildingLength / 2 + 2, -buildingDepth / 2 + 2, buildingLength, buildingDepth);

    // Roof base
    ctx.fillStyle = isSelected ? '#9CA3AF' : '#6B7280';
    ctx.fillRect(-buildingLength / 2, -buildingDepth / 2, buildingLength, buildingDepth);

    // Roof edge/trim (lighter border on platform side)
    ctx.fillStyle = isSelected ? '#D1D5DB' : '#9CA3AF';
    const trimWidth = 2;
    const trimY = sideMultiplier > 0 ? -buildingDepth / 2 : buildingDepth / 2 - trimWidth;
    ctx.fillRect(-buildingLength / 2, trimY, buildingLength, trimWidth);

    if (isMiddle) {
      // Main station building - peaked roof effect with ridge line
      ctx.strokeStyle = isSelected ? '#E5E7EB' : '#9CA3AF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-buildingLength / 2 + 4, 0);
      ctx.lineTo(buildingLength / 2 - 4, 0);
      ctx.stroke();

      // Skylight on main building
      ctx.fillStyle = isSelected ? '#93C5FD' : '#60A5FA';
      ctx.fillRect(-8, -4, 16, 8);
      ctx.strokeStyle = '#4B5563';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(-8, -4, 16, 8);

      // Skylight cross bars
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(8, 0);
      ctx.moveTo(0, -4);
      ctx.lineTo(0, 4);
      ctx.stroke();
    } else {
      // Smaller buildings - simple flat roof with vents/AC units
      ctx.fillStyle = isSelected ? '#A1A1AA' : '#71717A';

      // AC unit or vent
      const unitSize = 4;
      ctx.fillRect(-unitSize / 2, -unitSize / 2, unitSize, unitSize);
      ctx.strokeStyle = '#52525B';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(-unitSize / 2, -unitSize / 2, unitSize, unitSize);
    }

    // Building outline
    ctx.strokeStyle = isSelected ? '#9CA3AF' : '#4B5563';
    ctx.lineWidth = 1;
    ctx.strokeRect(-buildingLength / 2, -buildingDepth / 2, buildingLength, buildingDepth);

    ctx.restore();
  }

  /**
   * Render station placement preview
   */
  renderPreview(
    segmentIds: string[],
    side: 'left' | 'right',
    segments: Map<string, TrackSegment>,
    ctx: CanvasRenderingContext2D
  ): void {
    const sideMultiplier = side === 'left' ? -1 : 1;

    ctx.save();
    ctx.globalAlpha = 0.6;

    for (const segId of segmentIds) {
      const segment = segments.get(segId);
      if (!segment) continue;

      const cellCenterX = segment.gridX * GRID_SIZE + GRID_SIZE / 2;
      const cellCenterY = segment.gridY * GRID_SIZE + GRID_SIZE / 2;

      const start = segment.geometry.start;
      const end = segment.geometry.end;
      const direction = end.subtract(start).normalize();
      const perpendicular = new Vector2D(-direction.y, direction.x);

      const platformCenter = new Vector2D(cellCenterX, cellCenterY)
        .add(perpendicular.multiply(sideMultiplier * (PLATFORM_OFFSET + PLATFORM_WIDTH / 2)));

      ctx.save();
      ctx.translate(platformCenter.x, platformCenter.y);
      ctx.rotate(Math.atan2(direction.y, direction.x));

      // Preview platform (blue tint)
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(-GRID_SIZE / 2, -PLATFORM_WIDTH / 2, GRID_SIZE, PLATFORM_WIDTH);

      ctx.strokeStyle = '#60A5FA';
      ctx.lineWidth = 2;
      ctx.strokeRect(-GRID_SIZE / 2, -PLATFORM_WIDTH / 2, GRID_SIZE, PLATFORM_WIDTH);

      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Check if a point is within a station's clickable area (platform + buildings)
   */
  static isPointOnStation(
    point: Vector2D,
    station: Station,
    segments: Map<string, TrackSegment>
  ): boolean {
    for (const segId of station.segmentIds) {
      const segment = segments.get(segId);
      if (!segment) continue;

      const cellCenterX = segment.gridX * GRID_SIZE + GRID_SIZE / 2;
      const cellCenterY = segment.gridY * GRID_SIZE + GRID_SIZE / 2;

      // Get perpendicular for side offset
      const start = segment.geometry.start;
      const end = segment.geometry.end;
      const direction = end.subtract(start).normalize();
      const perpendicular = new Vector2D(-direction.y, direction.x);
      const sideMultiplier = station.side === 'left' ? -1 : 1;

      // Check platform area
      const platformCenter = new Vector2D(cellCenterX, cellCenterY)
        .add(perpendicular.multiply(sideMultiplier * (PLATFORM_OFFSET + PLATFORM_WIDTH / 2)));

      if (point.distanceTo(platformCenter) <= 20) return true;

      // Check building area
      const buildingCenter = new Vector2D(cellCenterX, cellCenterY)
        .add(perpendicular.multiply(sideMultiplier * (BUILDING_OFFSET + BUILDING_WIDTH / 2)));

      if (point.distanceTo(buildingCenter) <= 20) return true;
    }
    return false;
  }

  /**
   * Find station at a given world position
   */
  static findStationAt(
    worldPos: Vector2D,
    stations: Map<string, Station>,
    segments: Map<string, TrackSegment>
  ): Station | null {
    for (const station of stations.values()) {
      if (this.isPointOnStation(worldPos, station, segments)) {
        return station;
      }
    }
    return null;
  }
}
