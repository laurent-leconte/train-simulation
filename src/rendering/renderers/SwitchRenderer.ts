import { Vector2D } from '@/core/geometry/Vector2D';
import { Switch, TrackNode, TrackSegment } from '@/types/circuit.types';
import { RenderingContext } from '../RenderingContext';

/**
 * Renders switches (aiguillages) on the canvas
 */
export class SwitchRenderer {
  private readonly INDICATOR_RADIUS = 8;
  private readonly LEVER_LENGTH = 12;

  /**
   * Render all switches
   */
  renderAll(
    switches: Map<string, Switch>,
    nodes: Map<string, TrackNode>,
    segments: Map<string, TrackSegment>,
    renderCtx: RenderingContext,
    selectedId?: string | null
  ): void {
    const ctx = renderCtx.getContext();

    for (const sw of switches.values()) {
      const isSelected = sw.id === selectedId;
      this.renderSwitch(sw, nodes, segments, ctx, isSelected);
    }
  }

  /**
   * Render a single switch
   */
  private renderSwitch(
    sw: Switch,
    nodes: Map<string, TrackNode>,
    segments: Map<string, TrackSegment>,
    ctx: CanvasRenderingContext2D,
    isSelected: boolean
  ): void {
    const node = nodes.get(sw.nodeId);
    if (!node) return;

    const position = node.position;

    // Get the active outgoing track to determine lever direction
    const activeTrackId = sw.outgoingTracks[sw.currentPosition];
    const activeSegment = segments.get(activeTrackId);

    // Calculate lever direction (pointing towards active track)
    let leverDirection = new Vector2D(1, 0); // Default direction
    if (activeSegment) {
      // Find which end of the segment connects to this node
      const segmentStart = activeSegment.geometry.start;
      const segmentEnd = activeSegment.geometry.end;

      // Determine direction from node to segment
      const distToStart = position.distanceTo(segmentStart);
      const distToEnd = position.distanceTo(segmentEnd);

      if (distToStart < distToEnd) {
        // Node is at start, direction goes towards end
        leverDirection = segmentEnd.subtract(segmentStart).normalize();
      } else {
        // Node is at end, direction goes towards start
        leverDirection = segmentStart.subtract(segmentEnd).normalize();
      }
    }

    ctx.save();

    // Draw switch base (circle)
    ctx.beginPath();
    ctx.arc(position.x, position.y, this.INDICATOR_RADIUS, 0, Math.PI * 2);

    // Fill with color based on state
    const baseColor = isSelected ? '#FFD700' : '#4B5563'; // Gold if selected, gray otherwise
    ctx.fillStyle = baseColor;
    ctx.fill();

    // Draw border
    ctx.strokeStyle = isSelected ? '#FFA500' : '#1F2937';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw lever indicating active direction
    const leverEnd = position.add(leverDirection.multiply(this.LEVER_LENGTH));

    ctx.beginPath();
    ctx.moveTo(position.x, position.y);
    ctx.lineTo(leverEnd.x, leverEnd.y);

    // Lever color: green for position 0, blue for position 1
    ctx.strokeStyle = sw.currentPosition === 0 ? '#22C55E' : '#3B82F6';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Draw small circle at lever end
    ctx.beginPath();
    ctx.arc(leverEnd.x, leverEnd.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = sw.currentPosition === 0 ? '#22C55E' : '#3B82F6';
    ctx.fill();

    // Draw position indicator text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sw.currentPosition === 0 ? 'A' : 'B', position.x, position.y);

    ctx.restore();
  }

  /**
   * Check if a point is within a switch's clickable area
   */
  static isPointOnSwitch(
    point: Vector2D,
    sw: Switch,
    nodes: Map<string, TrackNode>
  ): boolean {
    const node = nodes.get(sw.nodeId);
    if (!node) return false;

    const distance = point.distanceTo(node.position);
    return distance <= 15; // Slightly larger than visual radius for easier clicking
  }

  /**
   * Find switch at a given world position
   */
  static findSwitchAt(
    worldPos: Vector2D,
    switches: Map<string, Switch>,
    nodes: Map<string, TrackNode>
  ): Switch | null {
    for (const sw of switches.values()) {
      if (this.isPointOnSwitch(worldPos, sw, nodes)) {
        return sw;
      }
    }
    return null;
  }
}
