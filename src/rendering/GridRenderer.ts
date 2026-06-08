import { Vector2D } from '@/core/geometry/Vector2D';
import { RenderingContext } from './RenderingContext';
import { IsoDrawable, worldDepth, shade } from './iso';

/**
 * Renders background scenery and grid on the canvas
 */
export class GridRenderer {
  private treePositions: Array<{ x: number; y: number; type: number }> = [];
  private lastSeedUpdate = 0;

  /**
   * Initialize tree positions based on a seed
   */
  private initializeTrees(seed: number, gridSize: number): void {
    if (this.lastSeedUpdate === seed && this.treePositions.length > 0) {
      return;
    }

    this.lastSeedUpdate = seed;
    this.treePositions = [];

    // Generate pseudo-random tree positions
    const random = (x: number, y: number) => {
      const value = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
      return value - Math.floor(value);
    };

    // Generate trees in a grid pattern with randomness
    for (let gx = -50; gx < 50; gx++) {
      for (let gy = -50; gy < 50; gy++) {
        const rand = random(gx, gy);
        // About 3% chance of tree
        if (rand < 0.03) {
          const treeType = Math.floor(random(gx + 1000, gy + 1000) * 3);
          this.treePositions.push({
            x: gx * gridSize + gridSize / 2,
            y: gy * gridSize + gridSize / 2,
            type: treeType,
          });
        }
      }
    }
  }

  /**
   * Draw a pixel art tree
   */
  private drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, type: number): void {
    ctx.save();

    // Different tree types
    if (type === 0) {
      // Pine tree
      // Trunk
      ctx.fillStyle = '#654321';
      ctx.fillRect(x - 2, y, 4, 8);

      // Foliage (triangular) - darker green
      ctx.fillStyle = '#2F5233';
      ctx.beginPath();
      ctx.moveTo(x, y - 12);
      ctx.lineTo(x - 8, y + 2);
      ctx.lineTo(x + 8, y + 2);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x - 6, y + 4);
      ctx.lineTo(x + 6, y + 4);
      ctx.closePath();
      ctx.fill();
    } else if (type === 1) {
      // Round tree
      // Trunk
      ctx.fillStyle = '#654321';
      ctx.fillRect(x - 2, y, 4, 6);

      // Foliage (round) - darker green
      ctx.fillStyle = '#3D6B3D';
      ctx.beginPath();
      ctx.arc(x, y - 4, 8, 0, Math.PI * 2);
      ctx.fill();

      // Highlight - slightly lighter
      ctx.fillStyle = '#4A7C4A';
      ctx.beginPath();
      ctx.arc(x - 2, y - 6, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Bush - darker green
      ctx.fillStyle = '#3A5F3A';
      ctx.beginPath();
      ctx.arc(x - 3, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 3, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y - 3, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  render(
    renderCtx: RenderingContext,
    gridSize: number,
    showGrid: boolean,
    occupiedCells?: Set<string>
  ): void {
    const ctx = renderCtx.getContext();
    const bounds = renderCtx.getVisibleBounds();

    // Calculate grid start and end positions
    const startX = Math.floor(bounds.min.x / gridSize) * gridSize;
    const endX = Math.ceil(bounds.max.x / gridSize) * gridSize;
    const startY = Math.floor(bounds.min.y / gridSize) * gridSize;
    const endY = Math.ceil(bounds.max.y / gridSize) * gridSize;

    ctx.save();

    // Draw prairie grass field background (darker greens)
    const grassPattern = ctx.createLinearGradient(0, startY, 0, endY);
    grassPattern.addColorStop(0, '#567D46');
    grassPattern.addColorStop(0.5, '#6B8E55');
    grassPattern.addColorStop(1, '#567D46');
    ctx.fillStyle = grassPattern;
    ctx.fillRect(startX - gridSize, startY - gridSize, endX - startX + gridSize * 2, endY - startY + gridSize * 2);

    // Add grass texture (small random patches)
    ctx.fillStyle = 'rgba(74, 103, 65, 0.3)';
    const random = (x: number, y: number) => {
      const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return value - Math.floor(value);
    };

    for (let gx = Math.floor(startX / 10); gx < endX / 10; gx++) {
      for (let gy = Math.floor(startY / 10); gy < endY / 10; gy++) {
        if (random(gx, gy) > 0.7) {
          ctx.fillRect(gx * 10, gy * 10, 3, 3);
        }
      }
    }

    ctx.restore();

    // Initialize trees. In top-down they are flat ground decals drawn here;
    // in iso they have height and are drawn in the depth-sorted tall phase
    // (see collectIsoTrees), so we skip them here.
    this.initializeTrees(12345, gridSize);

    if (renderCtx.getViewMode() === 'topdown') {
      ctx.save();
      // Draw trees that are in view (skip cells occupied by track)
      for (const tree of this.treePositions) {
        if (tree.x >= startX - 20 && tree.x <= endX + 20 &&
            tree.y >= startY - 20 && tree.y <= endY + 20 &&
            !this.treeIsOccluded(tree, gridSize, occupiedCells)) {
          this.drawTree(ctx, tree.x, tree.y, tree.type);
        }
      }
      ctx.restore();
    }

    // Draw grid lines if enabled
    if (showGrid) {
      ctx.save();

      // Grid style
      ctx.strokeStyle = 'rgba(139, 69, 19, 0.2)'; // Brown transparent
      ctx.lineWidth = 1 / renderCtx.getViewport().zoom;

      // Draw vertical lines
      ctx.beginPath();
      for (let x = startX; x <= endX; x += gridSize) {
        ctx.moveTo(x, bounds.min.y);
        ctx.lineTo(x, bounds.max.y);
      }
      ctx.stroke();

      // Draw horizontal lines
      ctx.beginPath();
      for (let y = startY; y <= endY; y += gridSize) {
        ctx.moveTo(bounds.min.x, y);
        ctx.lineTo(bounds.max.x, y);
      }
      ctx.stroke();

      ctx.restore();
    }
  }

  /**
   * Collect in-view trees as depth-tagged billboards for the iso tall phase.
   */
  collectIsoTrees(
    renderCtx: RenderingContext,
    gridSize: number,
    occupiedCells?: Set<string>
  ): IsoDrawable[] {
    const ctx = renderCtx.getContext();
    const bounds = renderCtx.getVisibleBounds();
    this.initializeTrees(12345, gridSize);

    const drawables: IsoDrawable[] = [];
    for (const tree of this.treePositions) {
      if (
        tree.x >= bounds.min.x - 20 && tree.x <= bounds.max.x + 20 &&
        tree.y >= bounds.min.y - 20 && tree.y <= bounds.max.y + 20 &&
        !this.treeIsOccluded(tree, gridSize, occupiedCells)
      ) {
        const t = tree; // capture
        drawables.push({
          depth: worldDepth(new Vector2D(t.x, t.y)),
          draw: () => this.drawTreeIso(ctx, renderCtx, t.x, t.y, t.type),
        });
      }
    }
    return drawables;
  }

  /**
   * A tree is hidden when its grid cell is occupied by a track segment, so it
   * doesn't poke through the rails.
   */
  private treeIsOccluded(
    tree: { x: number; y: number },
    gridSize: number,
    occupiedCells?: Set<string>
  ): boolean {
    if (!occupiedCells || occupiedCells.size === 0) return false;
    const gx = Math.floor(tree.x / gridSize);
    const gy = Math.floor(tree.y / gridSize);
    return occupiedCells.has(`${gx},${gy}`);
  }

  /**
   * Draw a tree as an upright billboard anchored at its projected base.
   */
  private drawTreeIso(
    ctx: CanvasRenderingContext2D,
    renderCtx: RenderingContext,
    worldX: number,
    worldY: number,
    type: number
  ): void {
    const z = renderCtx.getViewport().zoom;
    const base = renderCtx.worldToScreen(new Vector2D(worldX, worldY));
    const trunkH = 8 * z;

    ctx.save();

    // Soft ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, 7 * z, 3.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#5b3a1a';
    ctx.fillRect(base.x - 1.5 * z, base.y - trunkH, 3 * z, trunkH);

    const topY = base.y - trunkH;

    if (type === 0) {
      // Pine — stacked triangles
      const drawCone = (cy: number, w: number, h: number, color: string) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(base.x, cy - h);
        ctx.lineTo(base.x - w, cy);
        ctx.lineTo(base.x + w, cy);
        ctx.closePath();
        ctx.fill();
      };
      drawCone(topY, 9 * z, 12 * z, '#2F5233');
      drawCone(topY - 7 * z, 7 * z, 11 * z, '#356039');
    } else if (type === 1) {
      // Round tree
      ctx.fillStyle = '#3D6B3D';
      ctx.beginPath();
      ctx.arc(base.x, topY - 6 * z, 9 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade('#3D6B3D', 1.25);
      ctx.beginPath();
      ctx.arc(base.x - 3 * z, topY - 8 * z, 3.5 * z, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Bush cluster
      ctx.fillStyle = '#3A5F3A';
      for (const [dx, dy, r] of [[-4, 0, 5], [4, 0, 5], [0, -4, 5]] as const) {
        ctx.beginPath();
        ctx.arc(base.x + dx * z, topY + dy * z, r * z, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
