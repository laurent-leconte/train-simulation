import { Vector2D } from '@/core/geometry/Vector2D';
import { Station, TrackSegment } from '@/types/circuit.types';
import { RenderingContext } from '../RenderingContext';

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

    for (const station of stations.values()) {
      const isSelected = station.id === selectedId;
      this.renderStation(station, segments, ctx, isSelected);
    }
  }

  /**
   * Render a single station (spanning multiple cells alongside track)
   */
  private renderStation(
    station: Station,
    segments: Map<string, TrackSegment>,
    ctx: CanvasRenderingContext2D,
    isSelected: boolean
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

    // Draw platform for each cell
    const sideMultiplier = station.side === 'left' ? -1 : 1;

    for (let i = 0; i < stationSegments.length; i++) {
      this.drawCellPlatform(ctx, stationSegments[i], sideMultiplier, isSelected, i, stationSegments.length);
    }

    ctx.restore();
  }

  /**
   * Draw platform for a single cell
   */
  private drawCellPlatform(
    ctx: CanvasRenderingContext2D,
    segment: TrackSegment,
    sideMultiplier: number,
    isSelected: boolean,
    cellIndex: number,
    totalCells: number
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

    // Draw building behind platform (not for every cell, creates varied look)
    this.drawBuilding(ctx, segment, sideMultiplier, isSelected, cellIndex, totalCells);
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
