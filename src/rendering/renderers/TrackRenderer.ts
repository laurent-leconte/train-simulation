import { Vector2D } from '@/core/geometry/Vector2D';
import { TrackSegment, StraightGeometry, CurveGeometry } from '@/types/circuit.types';
import { RenderingContext } from '../RenderingContext';
import {
  evaluateQuadraticBezier,
  evaluateQuadraticBezierDerivative,
  evaluateCubicBezier,
  evaluateCubicBezierDerivative
} from '@/core/geometry/Bezier';

/**
 * Renders track segments on the canvas
 */
export class TrackRenderer {
  private readonly RAIL_GAUGE = 8; // Distance between rails in pixels
  private readonly RAIL_WIDTH = 2; // Width of each rail
  private readonly TIE_WIDTH = 12; // Width of cross ties
  private readonly TIE_HEIGHT = 2; // Height of cross ties
  private readonly TIE_SPACING = 15; // Spacing between ties

  /**
   * Render all track segments
   */
  renderAll(
    segments: Map<string, TrackSegment>,
    renderCtx: RenderingContext,
    selectedId?: string | null
  ): void {
    const ctx = renderCtx.getContext();

    // Render all segments
    for (const segment of segments.values()) {
      const isSelected = segment.id === selectedId;
      this.renderSegment(segment, ctx, isSelected);
    }
  }

  /**
   * Render a preview of a track geometry (for hover preview)
   */
  renderPreview(
    geometry: StraightGeometry | CurveGeometry,
    ctx: CanvasRenderingContext2D
  ): void {
    ctx.save();
    ctx.globalAlpha = 0.6; // Make preview semi-transparent

    if (geometry.type === 'straight') {
      this.renderStraightSegment(geometry, ctx, false);
    } else {
      this.renderCurvedSegment(geometry, ctx, false);
    }

    ctx.restore();
  }

  /**
   * Render a single track segment
   */
  private renderSegment(
    segment: TrackSegment,
    ctx: CanvasRenderingContext2D,
    isSelected: boolean
  ): void {
    if (segment.type === 'straight') {
      this.renderStraightSegment(segment.geometry as StraightGeometry, ctx, isSelected);
    } else if (segment.type === 'curve') {
      this.renderCurvedSegment(segment.geometry as CurveGeometry, ctx, isSelected);
    }
  }

  /**
   * Render a straight track segment
   */
  private renderStraightSegment(
    geometry: StraightGeometry,
    ctx: CanvasRenderingContext2D,
    isSelected: boolean
  ): void {
    const { start, end } = geometry;

    // Calculate perpendicular offset for rails
    const direction = end.subtract(start).normalize();
    const perpendicular = direction.perpendicular();
    const offset = perpendicular.multiply(this.RAIL_GAUGE / 2);

    // Rail positions
    const rail1Start = start.add(offset);
    const rail1End = end.add(offset);
    const rail2Start = start.subtract(offset);
    const rail2End = end.subtract(offset);

    ctx.save();

    // Draw gravel bed (ballast) first
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = this.RAIL_GAUGE + 6;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    // Draw ties (wooden sleepers)
    this.drawTiesStraight(start, end, direction, perpendicular, ctx);

    // Draw rails with realistic steel color
    const railColor = isSelected ? '#FFD700' : '#696969'; // Gold if selected, dark gray otherwise
    ctx.strokeStyle = railColor;
    ctx.lineWidth = this.RAIL_WIDTH + 1;
    ctx.lineCap = 'round';

    // Rail 1 - outer dark line
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = this.RAIL_WIDTH + 2;
    ctx.beginPath();
    ctx.moveTo(rail1Start.x, rail1Start.y);
    ctx.lineTo(rail1End.x, rail1End.y);
    ctx.stroke();

    // Rail 1 - inner light line
    ctx.strokeStyle = railColor;
    ctx.lineWidth = this.RAIL_WIDTH;
    ctx.beginPath();
    ctx.moveTo(rail1Start.x, rail1Start.y);
    ctx.lineTo(rail1End.x, rail1End.y);
    ctx.stroke();

    // Rail 2 - outer dark line
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = this.RAIL_WIDTH + 2;
    ctx.beginPath();
    ctx.moveTo(rail2Start.x, rail2Start.y);
    ctx.lineTo(rail2End.x, rail2End.y);
    ctx.stroke();

    // Rail 2 - inner light line
    ctx.strokeStyle = railColor;
    ctx.lineWidth = this.RAIL_WIDTH;
    ctx.beginPath();
    ctx.moveTo(rail2Start.x, rail2Start.y);
    ctx.lineTo(rail2End.x, rail2End.y);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw cross ties for straight segment
   */
  private drawTiesStraight(
    start: Vector2D,
    end: Vector2D,
    direction: Vector2D,
    perpendicular: Vector2D,
    ctx: CanvasRenderingContext2D
  ): void {
    const length = start.distanceTo(end);
    const tieCount = Math.floor(length / this.TIE_SPACING);

    for (let i = 0; i <= tieCount; i++) {
      const t = i / tieCount;
      const pos = start.lerp(end, t);
      const offset = perpendicular.multiply(this.TIE_WIDTH / 2);

      const tieStart = pos.add(offset);
      const tieEnd = pos.subtract(offset);

      // Draw wooden tie with darker outline
      ctx.strokeStyle = '#3E2723';
      ctx.lineWidth = this.TIE_HEIGHT + 2;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(tieStart.x, tieStart.y);
      ctx.lineTo(tieEnd.x, tieEnd.y);
      ctx.stroke();

      // Draw wooden tie center
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = this.TIE_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(tieStart.x, tieStart.y);
      ctx.lineTo(tieEnd.x, tieEnd.y);
      ctx.stroke();
    }
  }

  /**
   * Render a curved track segment (Bezier curve)
   */
  private renderCurvedSegment(
    geometry: CurveGeometry,
    ctx: CanvasRenderingContext2D,
    isSelected: boolean
  ): void {
    const { start, end, controlPoint1, controlPoint2 } = geometry;
    const isCubic = controlPoint2 !== undefined;

    ctx.save();

    // Draw gravel bed (ballast) first
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = this.RAIL_GAUGE + 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (isCubic) {
      ctx.moveTo(start.x, start.y);
      ctx.bezierCurveTo(controlPoint1.x, controlPoint1.y, controlPoint2!.x, controlPoint2!.y, end.x, end.y);
    } else {
      ctx.moveTo(start.x, start.y);
      ctx.quadraticCurveTo(controlPoint1.x, controlPoint1.y, end.x, end.y);
    }
    ctx.stroke();

    // Draw ties
    if (isCubic) {
      this.drawTiesCurvedCubic(start, controlPoint1, controlPoint2, end, ctx);
    } else {
      this.drawTiesCurved(start, controlPoint1, end, ctx);
    }

    // Draw rails as offset curves with realistic steel color
    const railColor = isSelected ? '#FFD700' : '#696969';
    const samples = 50;
    const halfGauge = this.RAIL_GAUGE / 2;

    // Rail 1 (offset positive) - outer dark line
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = this.RAIL_WIDTH + 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      let point, tangent;

      if (isCubic) {
        point = evaluateCubicBezier(start, controlPoint1, controlPoint2!, end, t);
        tangent = evaluateCubicBezierDerivative(start, controlPoint1, controlPoint2!, end, t).normalize();
      } else {
        point = evaluateQuadraticBezier(start, controlPoint1, end, t);
        tangent = evaluateQuadraticBezierDerivative(start, controlPoint1, end, t).normalize();
      }

      const perpendicular = tangent.perpendicular();
      const offsetPoint = point.add(perpendicular.multiply(halfGauge));

      if (i === 0) {
        ctx.moveTo(offsetPoint.x, offsetPoint.y);
      } else {
        ctx.lineTo(offsetPoint.x, offsetPoint.y);
      }
    }
    ctx.stroke();

    // Rail 1 - inner light line
    ctx.strokeStyle = railColor;
    ctx.lineWidth = this.RAIL_WIDTH;
    ctx.beginPath();
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      let point, tangent;

      if (isCubic) {
        point = evaluateCubicBezier(start, controlPoint1, controlPoint2!, end, t);
        tangent = evaluateCubicBezierDerivative(start, controlPoint1, controlPoint2!, end, t).normalize();
      } else {
        point = evaluateQuadraticBezier(start, controlPoint1, end, t);
        tangent = evaluateQuadraticBezierDerivative(start, controlPoint1, end, t).normalize();
      }

      const perpendicular = tangent.perpendicular();
      const offsetPoint = point.add(perpendicular.multiply(halfGauge));

      if (i === 0) {
        ctx.moveTo(offsetPoint.x, offsetPoint.y);
      } else {
        ctx.lineTo(offsetPoint.x, offsetPoint.y);
      }
    }
    ctx.stroke();

    // Rail 2 (offset negative) - outer dark line
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = this.RAIL_WIDTH + 2;
    ctx.beginPath();
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      let point, tangent;

      if (isCubic) {
        point = evaluateCubicBezier(start, controlPoint1, controlPoint2!, end, t);
        tangent = evaluateCubicBezierDerivative(start, controlPoint1, controlPoint2!, end, t).normalize();
      } else {
        point = evaluateQuadraticBezier(start, controlPoint1, end, t);
        tangent = evaluateQuadraticBezierDerivative(start, controlPoint1, end, t).normalize();
      }

      const perpendicular = tangent.perpendicular();
      const offsetPoint = point.subtract(perpendicular.multiply(halfGauge));

      if (i === 0) {
        ctx.moveTo(offsetPoint.x, offsetPoint.y);
      } else {
        ctx.lineTo(offsetPoint.x, offsetPoint.y);
      }
    }
    ctx.stroke();

    // Rail 2 - inner light line
    ctx.strokeStyle = railColor;
    ctx.lineWidth = this.RAIL_WIDTH;
    ctx.beginPath();
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      let point, tangent;

      if (isCubic) {
        point = evaluateCubicBezier(start, controlPoint1, controlPoint2!, end, t);
        tangent = evaluateCubicBezierDerivative(start, controlPoint1, controlPoint2!, end, t).normalize();
      } else {
        point = evaluateQuadraticBezier(start, controlPoint1, end, t);
        tangent = evaluateQuadraticBezierDerivative(start, controlPoint1, end, t).normalize();
      }

      const perpendicular = tangent.perpendicular();
      const offsetPoint = point.subtract(perpendicular.multiply(halfGauge));

      if (i === 0) {
        ctx.moveTo(offsetPoint.x, offsetPoint.y);
      } else {
        ctx.lineTo(offsetPoint.x, offsetPoint.y);
      }
    }
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw ties for curved segment (quadratic Bezier)
   */
  private drawTiesCurved(
    start: Vector2D,
    controlPoint: Vector2D,
    end: Vector2D,
    ctx: CanvasRenderingContext2D
  ): void {
    // Same as cubic but for quadratic
    const samples = 20;

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const point = evaluateQuadraticBezier(start, controlPoint, end, t);
      const tangent = evaluateQuadraticBezierDerivative(start, controlPoint, end, t).normalize();
      const perpendicular = tangent.perpendicular();

      const tieStart = point.add(perpendicular.multiply(this.TIE_WIDTH / 2));
      const tieEnd = point.subtract(perpendicular.multiply(this.TIE_WIDTH / 2));

      // Wooden tie outline
      ctx.strokeStyle = '#3E2723';
      ctx.lineWidth = this.TIE_HEIGHT + 2;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(tieStart.x, tieStart.y);
      ctx.lineTo(tieEnd.x, tieEnd.y);
      ctx.stroke();

      // Wooden tie center
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = this.TIE_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(tieStart.x, tieStart.y);
      ctx.lineTo(tieEnd.x, tieEnd.y);
      ctx.stroke();
    }
  }

  /**
   * Draw ties for curved segment (cubic Bezier)
   */
  private drawTiesCurvedCubic(
    start: Vector2D,
    cp1: Vector2D,
    cp2: Vector2D,
    end: Vector2D,
    ctx: CanvasRenderingContext2D
  ): void {
    const samples = 20;

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const point = evaluateCubicBezier(start, cp1, cp2, end, t);
      const tangent = evaluateCubicBezierDerivative(start, cp1, cp2, end, t).normalize();
      const perpendicular = tangent.perpendicular();

      const tieStart = point.add(perpendicular.multiply(this.TIE_WIDTH / 2));
      const tieEnd = point.subtract(perpendicular.multiply(this.TIE_WIDTH / 2));

      // Wooden tie outline
      ctx.strokeStyle = '#3E2723';
      ctx.lineWidth = this.TIE_HEIGHT + 2;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(tieStart.x, tieStart.y);
      ctx.lineTo(tieEnd.x, tieEnd.y);
      ctx.stroke();

      // Wooden tie center
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = this.TIE_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(tieStart.x, tieStart.y);
      ctx.lineTo(tieEnd.x, tieEnd.y);
      ctx.stroke();
    }
  }

  /**
   * Render nodes (connections between segments)
   */
  renderNodes(
    nodes: Map<string, any>,
    renderCtx: RenderingContext,
    selectedId?: string | null
  ): void {
    // Optionally render nodes for debugging
    // For now we skip this to keep the graphics clean
  }
}
