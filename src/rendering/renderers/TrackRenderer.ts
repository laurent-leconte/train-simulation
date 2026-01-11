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

    // Draw ties first (under rails)
    this.drawTiesStraight(start, end, direction, perpendicular, ctx);

    // Draw rails
    const railColor = isSelected ? '#60a5fa' : '#94a3b8'; // Blue if selected
    ctx.strokeStyle = railColor;
    ctx.lineWidth = this.RAIL_WIDTH;
    ctx.lineCap = 'round';

    // Rail 1
    ctx.beginPath();
    ctx.moveTo(rail1Start.x, rail1Start.y);
    ctx.lineTo(rail1End.x, rail1End.y);
    ctx.stroke();

    // Rail 2
    ctx.beginPath();
    ctx.moveTo(rail2Start.x, rail2Start.y);
    ctx.lineTo(rail2End.x, rail2End.y);
    ctx.stroke();

    // Draw selection highlight
    if (isSelected) {
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.3)';
      ctx.lineWidth = this.RAIL_GAUGE + 6;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

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

    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = this.TIE_HEIGHT;
    ctx.lineCap = 'butt';

    for (let i = 0; i <= tieCount; i++) {
      const t = i / tieCount;
      const pos = start.lerp(end, t);
      const offset = perpendicular.multiply(this.TIE_WIDTH / 2);

      const tieStart = pos.add(offset);
      const tieEnd = pos.subtract(offset);

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

    // Draw ties first
    if (isCubic) {
      this.drawTiesCurvedCubic(start, controlPoint1, controlPoint2, end, ctx);
    } else {
      this.drawTiesCurved(start, controlPoint1, end, ctx);
    }

    // Draw rails as offset curves
    const railColor = isSelected ? '#60a5fa' : '#94a3b8';
    ctx.strokeStyle = railColor;
    ctx.lineWidth = this.RAIL_WIDTH;
    ctx.lineCap = 'round';

    // Sample the curve and draw offset rails
    const samples = 50;
    const halfGauge = this.RAIL_GAUGE / 2;

    // Rail 1 (offset positive)
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

    // Rail 2 (offset negative)
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

    // Draw selection highlight
    if (isSelected) {
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.3)';
      ctx.lineWidth = this.RAIL_GAUGE + 6;
      ctx.beginPath();
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const point = isCubic
          ? evaluateCubicBezier(start, controlPoint1, controlPoint2!, end, t)
          : evaluateQuadraticBezier(start, controlPoint1, end, t);
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draw cross ties for curved segment (quadratic)
   */
  private drawTiesCurved(
    start: Vector2D,
    control: Vector2D,
    end: Vector2D,
    ctx: CanvasRenderingContext2D
  ): void {
    const samples = 30;

    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = this.TIE_HEIGHT;
    ctx.lineCap = 'butt';

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const pos = evaluateQuadraticBezier(start, control, end, t);
      const tangent = evaluateQuadraticBezierDerivative(start, control, end, t).normalize();
      const perpendicular = tangent.perpendicular();
      const offset = perpendicular.multiply(this.TIE_WIDTH / 2);

      const tieStart = pos.add(offset);
      const tieEnd = pos.subtract(offset);

      ctx.beginPath();
      ctx.moveTo(tieStart.x, tieStart.y);
      ctx.lineTo(tieEnd.x, tieEnd.y);
      ctx.stroke();
    }
  }

  /**
   * Draw cross ties for curved segment (cubic)
   */
  private drawTiesCurvedCubic(
    start: Vector2D,
    control1: Vector2D,
    control2: Vector2D,
    end: Vector2D,
    ctx: CanvasRenderingContext2D
  ): void {
    const samples = 30;

    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = this.TIE_HEIGHT;
    ctx.lineCap = 'butt';

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const pos = evaluateCubicBezier(start, control1, control2, end, t);
      const tangent = evaluateCubicBezierDerivative(start, control1, control2, end, t).normalize();
      const perpendicular = tangent.perpendicular();
      const offset = perpendicular.multiply(this.TIE_WIDTH / 2);

      const tieStart = pos.add(offset);
      const tieEnd = pos.subtract(offset);

      ctx.beginPath();
      ctx.moveTo(tieStart.x, tieStart.y);
      ctx.lineTo(tieEnd.x, tieEnd.y);
      ctx.stroke();
    }
  }

  /**
   * Render nodes (connection points)
   */
  renderNodes(
    nodes: Map<string, { id: string; position: Vector2D }>,
    renderCtx: RenderingContext,
    selectedId?: string | null
  ): void {
    const ctx = renderCtx.getContext();

    ctx.save();

    for (const node of nodes.values()) {
      const isSelected = node.id === selectedId;
      const radius = isSelected ? 6 : 4;
      const color = isSelected ? '#60a5fa' : '#cbd5e1';

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.position.x, node.position.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw outline
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

}
