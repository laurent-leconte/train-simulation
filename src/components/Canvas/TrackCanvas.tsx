import { useCallback, useRef, useState, useEffect } from 'react';
import { useStore } from '@/state/store';
import { Vector2D } from '@/core/geometry/Vector2D';
import { RenderingContext } from '@/rendering/RenderingContext';
import { GridRenderer } from '@/rendering/GridRenderer';
import { TrackRenderer } from '@/rendering/renderers/TrackRenderer';
import { TrainRenderer } from '@/rendering/renderers/TrainRenderer';
import { SwitchRenderer } from '@/rendering/renderers/SwitchRenderer';
import { GridCircuitBuilder } from '@/services/GridCircuitBuilder';
import { TrainPhysics } from '@/services/TrainPhysics';
import { TrainPathFollower } from '@/services/TrainPathFollower';
import { TrackDrawingHelper, Side } from '@/services/TrackDrawingHelper';
import { RailOrientation } from '@/types';
import { Train, DEFAULT_TRAIN_SETTINGS } from '@/types/train.types';
import { Switch } from '@/types/circuit.types';
import { nanoid } from 'nanoid';

/**
 * Main canvas component for track editing and simulation
 */
/**
 * Drag state for track drawing
 */
interface DragState {
  isDrawing: boolean;
  startCell: { gridX: number; gridY: number } | null;
  lastCell: { gridX: number; gridY: number } | null;
  entrySide: Side | null;
  visitedCells: Set<string>;
  pathCells: Array<{ gridX: number; gridY: number }>; // Ordered list for path preview
}

export function TrackCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<Vector2D>(Vector2D.zero());
  const [hoveredGridCell, setHoveredGridCell] = useState<{ gridX: number; gridY: number } | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDrawing: false,
    startCell: null,
    lastCell: null,
    entrySide: null,
    visitedCells: new Set(),
    pathCells: [],
  });

  const gridRendererRef = useRef(new GridRenderer());
  const trackRendererRef = useRef(new TrackRenderer());
  const trainRendererRef = useRef(new TrainRenderer());
  const switchRendererRef = useRef(new SwitchRenderer());

  // Store selectors
  const viewport = useStore((state) => state.ui.viewport);
  const showGrid = useStore((state) => state.editor.showGrid);
  const gridSize = useStore((state) => state.editor.gridSize);
  const snapToGrid = useStore((state) => state.editor.snapToGrid);
  const selectedTool = useStore((state) => state.editor.selectedTool);
  const selectedElement = useStore((state) => state.editor.selectedElement);
  const mode = useStore((state) => state.editor.mode);
  const circuitGraph = useStore((state) => state.circuit.graph);
  const simulation = useStore((state) => state.simulation);
  const updateTrain = useStore((state) => state.updateTrain);

  const setViewportZoom = useStore((state) => state.setViewportZoom);
  const adjustViewportPan = useStore((state) => state.adjustViewportPan);
  const addTrackSegment = useStore((state) => state.addTrackSegment);
  const setSelectedElement = useStore((state) => state.setSelectedElement);
  const addTrain = useStore((state) => state.addTrain);
  const setSimulationRunning = useStore((state) => state.setSimulationRunning);
  const addSwitch = useStore((state) => state.addSwitch);
  const updateSwitch = useStore((state) => state.updateSwitch);
  const removeSwitch = useStore((state) => state.removeSwitch);

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    setupCanvas();

    const handleResize = () => {
      setupCanvas();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Simulation loop - update physics at fixed timestep
  useEffect(() => {
    if (mode !== 'simulate' || !simulation.isRunning || simulation.isPaused) {
      return;
    }

    let lastTime = performance.now();
    let animationFrameId: number;

    const fixedTimeStep = 1 / 60; // 60 FPS physics

    const loop = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;

      // Update physics with fixed timestep
      const adjustedDelta = Math.min(deltaTime * simulation.simulationSpeed, fixedTimeStep * 3);

      // Update each train directly in the store
      simulation.trains.forEach((train) => {
        // Create a mutable copy of the train with deep copy of position
        const trainCopy = {
          ...train,
          position: {
            ...train.position,
            worldPosition: new Vector2D(train.position.worldPosition.x, train.position.worldPosition.y),
            direction: new Vector2D(train.position.direction.x, train.position.direction.y),
          },
        };

        // Update the train (pass switches for routing decisions)
        TrainPhysics.updateTrain(
          trainCopy,
          adjustedDelta,
          circuitGraph.edges,
          circuitGraph.nodes,
          circuitGraph.switches
        );

        // Update store
        updateTrain(train.id, trainCopy);
      });

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [mode, simulation.isRunning, simulation.isPaused, simulation.simulationSpeed, simulation.trains, circuitGraph, updateTrain]);

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const renderCtx = new RenderingContext(ctx, viewport, rect.width, rect.height);

    // Clear canvas
    renderCtx.clear('#1f2937');

    // Save state and apply transformations
    renderCtx.save();
    renderCtx.applyTransform();

    // Render grid
    gridRendererRef.current.render(renderCtx, gridSize, showGrid);

    // Render track segments
    trackRendererRef.current.renderAll(circuitGraph.edges, renderCtx, selectedElement);

    // Render nodes
    trackRendererRef.current.renderNodes(circuitGraph.nodes, renderCtx, selectedElement);

    // Render switches
    switchRendererRef.current.renderAll(
      circuitGraph.switches,
      circuitGraph.nodes,
      circuitGraph.edges,
      renderCtx,
      selectedElement
    );

    // Render trains
    trainRendererRef.current.renderAll(simulation.trains, renderCtx, selectedElement);

    // Render hovered grid cell highlight (for drag-based track drawing)
    if (hoveredGridCell && mode === 'edit' && selectedTool.type === 'track' && !dragState.isDrawing) {
      ctx.save();
      ctx.fillStyle = 'rgba(96, 165, 250, 0.15)';
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.4)';
      ctx.lineWidth = 2;

      const cellX = hoveredGridCell.gridX * gridSize;
      const cellY = hoveredGridCell.gridY * gridSize;

      // Draw cell highlight only (no track preview since orientation is determined by drag)
      ctx.fillRect(cellX, cellY, gridSize, gridSize);
      ctx.strokeRect(cellX, cellY, gridSize, gridSize);

      ctx.restore();
    }

    // Render drag path preview while drawing
    if (dragState.isDrawing && dragState.pathCells.length > 1) {
      ctx.save();

      // Draw path line connecting cell centers
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.7)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      const firstCell = dragState.pathCells[0];
      ctx.moveTo(
        firstCell.gridX * gridSize + gridSize / 2,
        firstCell.gridY * gridSize + gridSize / 2
      );

      for (let i = 1; i < dragState.pathCells.length; i++) {
        const cell = dragState.pathCells[i];
        ctx.lineTo(
          cell.gridX * gridSize + gridSize / 2,
          cell.gridY * gridSize + gridSize / 2
        );
      }
      ctx.stroke();

      // Draw dots at each cell center
      ctx.fillStyle = 'rgba(96, 165, 250, 0.9)';
      for (const cell of dragState.pathCells) {
        ctx.beginPath();
        ctx.arc(
          cell.gridX * gridSize + gridSize / 2,
          cell.gridY * gridSize + gridSize / 2,
          4,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // Highlight current cell
      if (dragState.lastCell) {
        ctx.fillStyle = 'rgba(96, 165, 250, 0.2)';
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)';
        ctx.lineWidth = 2;
        ctx.fillRect(
          dragState.lastCell.gridX * gridSize,
          dragState.lastCell.gridY * gridSize,
          gridSize,
          gridSize
        );
        ctx.strokeRect(
          dragState.lastCell.gridX * gridSize,
          dragState.lastCell.gridY * gridSize,
          gridSize,
          gridSize
        );
      }

      ctx.restore();
    }

    // Restore state
    renderCtx.restore();

    // Render UI overlay (zoom level, etc.)
    renderOverlay(ctx, rect.width, rect.height);
  }, [viewport, showGrid, gridSize, circuitGraph, selectedElement, hoveredGridCell, mode, selectedTool, simulation.trains, dragState]);

  // Render overlay (UI elements in screen space)
  const renderOverlay = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '14px monospace';
    ctx.fillText(`Zoom: ${(viewport.zoom * 100).toFixed(0)}%`, 10, 20);
    ctx.fillText(
      `Pan: (${viewport.pan.x.toFixed(0)}, ${viewport.pan.y.toFixed(0)})`,
      10,
      40
    );
    ctx.restore();
  };

  // Trigger render on viewport changes
  useEffect(() => {
    render();
  }, [render]);

  // Mouse wheel handler (zoom)
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();

      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.1, Math.min(viewport.zoom + delta, 10));

      setViewportZoom(newZoom);
    },
    [viewport.zoom, setViewportZoom]
  );

  // Handle canvas click for delete tool
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (mode !== 'edit') return;
      if (e.button !== 0) return; // Only left click

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const screenPos = new Vector2D(e.clientX - rect.left, e.clientY - rect.top);
      const renderCtx = new RenderingContext(canvas.getContext('2d')!, viewport, rect.width, rect.height);
      const worldPos = renderCtx.screenToWorld(screenPos);

      // Convert to grid coordinates
      const { gridX, gridY } = GridCircuitBuilder.worldToGrid(worldPos, gridSize);

      if (selectedTool.type === 'delete') {
        // Delete track at clicked position
        const track = GridCircuitBuilder.getTrackAt(gridX, gridY, circuitGraph.edges);
        if (track) {
          useStore.setState((state) => {
            state.circuit.graph.edges.delete(track.id);
            // TODO: Clean up orphaned nodes
          });
        }
      }
    },
    [mode, selectedTool, viewport, gridSize, circuitGraph]
  );

  // Helper to find a junction node near a world position
  const findJunctionNodeAt = useCallback(
    (worldPos: Vector2D): string | null => {
      for (const [nodeId, node] of circuitGraph.nodes) {
        // Check if this node has 3+ connected segments (junction)
        if (node.connectedSegments.length >= 3) {
          const distance = worldPos.distanceTo(node.position);
          if (distance < 20) { // 20px click radius
            return nodeId;
          }
        }
      }
      return null;
    },
    [circuitGraph.nodes]
  );

  // Helper to create a switch at a junction node
  const createSwitchAtNode = useCallback(
    (nodeId: string) => {
      const node = circuitGraph.nodes.get(nodeId);
      if (!node || node.connectedSegments.length < 3) return;

      // Check if switch already exists at this node
      for (const sw of circuitGraph.switches.values()) {
        if (sw.nodeId === nodeId) {
          return;
        }
      }

      // A switch is formed by two tracks in the same grid cell sharing an edge.
      // The shared edge is the entrance. The third track (in a different cell)
      // coming to that shared edge is the incoming track.

      // Group segments by grid cell
      const segmentsByCell: Map<string, string[]> = new Map();
      for (const segmentId of node.connectedSegments) {
        const segment = circuitGraph.edges.get(segmentId);
        if (!segment) continue;

        const cellKey = `${segment.gridX},${segment.gridY}`;
        const existing = segmentsByCell.get(cellKey) || [];
        existing.push(segmentId);
        segmentsByCell.set(cellKey, existing);
      }

      // Find the cell with 2 segments (the switch cell) and the cell with 1 segment (incoming)
      let switchSegments: string[] = [];
      let incomingSegmentId: string | null = null;

      for (const [, segments] of segmentsByCell) {
        if (segments.length === 2) {
          switchSegments = segments;
        } else if (segments.length === 1) {
          // This could be the incoming track, but we need to verify it connects
          // to the shared edge of the switch segments
          if (!incomingSegmentId) {
            incomingSegmentId = segments[0];
          }
        }
      }

      // If we didn't find a clear switch pattern, fall back to first segment as incoming
      if (switchSegments.length !== 2 || !incomingSegmentId) {
        // Fallback: just use first segment as incoming
        const segments = node.connectedSegments;
        incomingSegmentId = segments[0];
        switchSegments = [segments[1], segments[2]];
      }

      const newSwitch: Switch = {
        id: nanoid(),
        nodeId,
        incomingTrack: incomingSegmentId,
        outgoingTracks: [switchSegments[0], switchSegments[1]],
        currentPosition: 0,
        type: 'left', // Default type
      };

      addSwitch(newSwitch);
    },
    [circuitGraph.nodes, circuitGraph.edges, circuitGraph.switches, addSwitch]
  );

  // Mouse down handler (start dragging for track tool, or panning)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Handle switch tool - place or toggle switch
      if (mode === 'edit' && selectedTool.type === 'switch' && e.button === 0) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const screenPos = new Vector2D(e.clientX - rect.left, e.clientY - rect.top);
        const renderCtx = new RenderingContext(canvas.getContext('2d')!, viewport, rect.width, rect.height);
        const worldPos = renderCtx.screenToWorld(screenPos);

        // First check if clicking on existing switch to toggle it
        const existingSwitch = SwitchRenderer.findSwitchAt(
          worldPos,
          circuitGraph.switches,
          circuitGraph.nodes
        );

        if (existingSwitch) {
          // Toggle the switch position
          const newPosition = existingSwitch.currentPosition === 0 ? 1 : 0;
          updateSwitch(existingSwitch.id, newPosition);
          return;
        }

        // Otherwise, try to create a new switch at a junction node
        const junctionNodeId = findJunctionNodeAt(worldPos);
        if (junctionNodeId) {
          createSwitchAtNode(junctionNodeId);
        }

        return;
      }

      // If we're in edit mode with track tool, start drag-based drawing
      if (mode === 'edit' && selectedTool.type === 'track' && e.button === 0) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const screenPos = new Vector2D(e.clientX - rect.left, e.clientY - rect.top);
        const renderCtx = new RenderingContext(canvas.getContext('2d')!, viewport, rect.width, rect.height);
        const worldPos = renderCtx.screenToWorld(screenPos);

        // Convert to grid coordinates
        const { gridX, gridY } = GridCircuitBuilder.worldToGrid(worldPos, gridSize);

        // Check if starting on an existing track - if so, detect which edge to branch from
        let initialEntrySide: Side | null = null;
        const existingTracks = Array.from(circuitGraph.edges.values()).filter(
          seg => seg.gridX === gridX && seg.gridY === gridY
        );

        if (existingTracks.length > 0) {
          // Find which edge of the existing track(s) we're closest to
          const existingEdges = new Set<string>();
          for (const track of existingTracks) {
            const edges = GridCircuitBuilder.getEdgesForOrientation(track.orientation);
            edges.forEach(e => existingEdges.add(e));
          }

          // Find closest edge that belongs to an existing track
          const clickedSide = TrackDrawingHelper.detectSide(worldPos, gridX, gridY, gridSize);

          if (existingEdges.has(clickedSide)) {
            // User clicked near an edge that has a track endpoint
            // Set this as the entry side - the new track will branch from here
            initialEntrySide = clickedSide;
          }
        }

        setDragState({
          isDrawing: true,
          startCell: { gridX, gridY },
          lastCell: { gridX, gridY },
          entrySide: initialEntrySide, // Set if branching from existing track, null otherwise
          visitedCells: new Set(),
          pathCells: [{ gridX, gridY }],
        });

        return;
      }

      // Handle delete tool
      if (mode === 'edit' && selectedTool.type === 'delete' && e.button === 0) {
        handleClick(e);
        return;
      }

      // If in simulation mode and clicking on track, place a train or toggle switch
      if (mode === 'simulate' && e.button === 0) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const screenPos = new Vector2D(e.clientX - rect.left, e.clientY - rect.top);
        const renderCtx = new RenderingContext(canvas.getContext('2d')!, viewport, rect.width, rect.height);
        const worldPos = renderCtx.screenToWorld(screenPos);

        // First check if clicking on a switch to toggle it
        const clickedSwitch = SwitchRenderer.findSwitchAt(
          worldPos,
          circuitGraph.switches,
          circuitGraph.nodes
        );

        if (clickedSwitch) {
          // Toggle the switch position
          const newPosition = clickedSwitch.currentPosition === 0 ? 1 : 0;
          updateSwitch(clickedSwitch.id, newPosition);
          return;
        }

        // Otherwise, try to place a train
        // Find closest track segment
        let closestSegment: string | null = null;
        let closestDistance = Infinity;

        for (const segment of circuitGraph.edges.values()) {
          // Simple distance check to segment (could be improved)
          const segmentStart = segment.geometry.start;
          const distToStart = worldPos.distanceTo(segmentStart);

          if (distToStart < closestDistance && distToStart < 30) {
            closestDistance = distToStart;
            closestSegment = segment.id;
          }
        }

        if (closestSegment && simulation.trains.size === 0) {
          // Place a train at the start of this segment
          const position = TrainPathFollower.initializeAtSegment(
            closestSegment,
            circuitGraph.edges,
            0
          );

          if (position) {
            // Calculate initial carriage positions
            const carriagePositions = TrainPathFollower.calculateCarriagePositions(
              position,
              DEFAULT_TRAIN_SETTINGS.length,
              DEFAULT_TRAIN_SETTINGS.carriageCount,
              DEFAULT_TRAIN_SETTINGS.carriageLength,
              DEFAULT_TRAIN_SETTINGS.carriageGap,
              circuitGraph.edges,
              circuitGraph.nodes
            );

            const newTrain: Train = {
              id: nanoid(),
              position,
              velocity: 0,
              ...DEFAULT_TRAIN_SETTINGS,
              carriagePositions,
              isRunning: true, // Start the train immediately
            };

            addTrain(newTrain);
            setSimulationRunning(true);
          }
        }

        return;
      }

      // Otherwise, handle panning
      if (e.button === 0 || e.button === 1) {
        // Left or middle button
        setIsPanning(true);
        setLastMousePos(new Vector2D(e.clientX, e.clientY));
        e.preventDefault();
      }
    },
    [mode, selectedTool, handleClick, viewport, circuitGraph, simulation.trains, addTrain, setSimulationRunning, findJunctionNodeAt, createSwitchAtNode, updateSwitch, gridSize]
  );

  // Helper function to place a track at a grid position
  const placeTrackAtCell = useCallback(
    (cellX: number, cellY: number, orientation: RailOrientation) => {
      // Check if track would conflict with existing tracks (same edge used)
      // This allows Y-junctions where multiple tracks share a cell but use different edges
      if (GridCircuitBuilder.trackWouldConflict(cellX, cellY, orientation, gridSize, circuitGraph.edges)) {
        return;
      }

      try {
        // Create mutable copy of nodes map
        const nodesCopy = new Map();
        circuitGraph.nodes.forEach((node, key) => {
          nodesCopy.set(key, {
            ...node,
            position: new Vector2D(node.position.x, node.position.y),
            connectedSegments: [...node.connectedSegments],
          });
        });

        // Create mutable copy of edges for checking junctions
        const edgesCopy = new Map(circuitGraph.edges);

        // Create track at grid position
        const result = GridCircuitBuilder.createGridTrack(
          cellX,
          cellY,
          orientation,
          gridSize,
          nodesCopy
        );

        // Add the new segment to edges copy
        edgesCopy.set(result.segment.id, result.segment);

        // Check for new Y-junctions and auto-create switches
        const newSwitches: Switch[] = [];
        for (const [nodeId, node] of nodesCopy) {
          if (node.connectedSegments.length >= 3) {
            // Check if switch already exists at this node
            let switchExists = false;
            for (const sw of circuitGraph.switches.values()) {
              if (sw.nodeId === nodeId) {
                switchExists = true;
                break;
              }
            }

            if (!switchExists) {
              // Auto-create switch using the same logic as createSwitchAtNode
              const segmentsByCell: Map<string, string[]> = new Map();
              for (const segmentId of node.connectedSegments) {
                const segment = edgesCopy.get(segmentId);
                if (!segment) continue;

                const cellKey = `${segment.gridX},${segment.gridY}`;
                const existing = segmentsByCell.get(cellKey) || [];
                existing.push(segmentId);
                segmentsByCell.set(cellKey, existing);
              }

              let switchSegments: string[] = [];
              let incomingSegmentId: string | null = null;

              for (const [, segments] of segmentsByCell) {
                if (segments.length === 2) {
                  switchSegments = segments;
                } else if (segments.length === 1) {
                  if (!incomingSegmentId) {
                    incomingSegmentId = segments[0];
                  }
                }
              }

              if (switchSegments.length === 2 && incomingSegmentId) {
                newSwitches.push({
                  id: nanoid(),
                  nodeId,
                  incomingTrack: incomingSegmentId,
                  outgoingTracks: [switchSegments[0], switchSegments[1]],
                  currentPosition: 0,
                  type: 'left',
                });
              }
            }
          }
        }

        // Update the store
        useStore.setState((state) => {
          state.circuit.graph.nodes = nodesCopy;
          state.circuit.graph.edges.set(result.segment.id, result.segment);

          // Add any auto-created switches
          for (const sw of newSwitches) {
            state.circuit.graph.switches.set(sw.id, sw);
          }
        });
      } catch (error) {
        console.error('Failed to create track:', error);
      }
    },
    [circuitGraph, gridSize]
  );

  // Mouse move handler (drag drawing, pan, and update hover)
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const screenPos = new Vector2D(e.clientX - rect.left, e.clientY - rect.top);
      const renderCtx = new RenderingContext(canvas.getContext('2d')!, viewport, rect.width, rect.height);
      const worldPos = renderCtx.screenToWorld(screenPos);

      // Convert to grid coordinates
      const { gridX, gridY } = GridCircuitBuilder.worldToGrid(worldPos, gridSize);

      // Handle drag-based track drawing
      if (dragState.isDrawing && dragState.lastCell) {
        // Check if we've moved to a new cell
        if (gridX !== dragState.lastCell.gridX || gridY !== dragState.lastCell.gridY) {

          // Get all cells to process (Bresenham for non-adjacent, single cell for adjacent)
          const cellsToProcess = TrackDrawingHelper.getTraversedCells(
            dragState.lastCell.gridX,
            dragState.lastCell.gridY,
            gridX,
            gridY
          );

          // Determine initial entry side from first drag direction if not set
          // Entry side = opposite of exit direction (if going north, we entered from south)
          let currentEntrySide = dragState.entrySide;
          if (!currentEntrySide && cellsToProcess.length > 0) {
            const firstExit = TrackDrawingHelper.getExitSideFromDirection(
              dragState.lastCell.gridX,
              dragState.lastCell.gridY,
              cellsToProcess[0].gridX,
              cellsToProcess[0].gridY
            );
            currentEntrySide = TrackDrawingHelper.getOppositeSide(firstExit);
          }

          if (!currentEntrySide) {
            return; // Can't determine direction yet
          }

          let lastProcessedCell = dragState.lastCell;
          const newPathCells = [...dragState.pathCells];
          const newVisitedCells = new Set(dragState.visitedCells);

          // Process each cell in the path
          for (const cell of cellsToProcess) {
            // Determine exit side based on direction of movement
            const exitSide = TrackDrawingHelper.getExitSideFromDirection(
              lastProcessedCell.gridX,
              lastProcessedCell.gridY,
              cell.gridX,
              cell.gridY
            );

            // Determine track orientation for the previous cell
            const orientation = TrackDrawingHelper.getTrackOrientation(currentEntrySide, exitSide);

            const prevCellKey = `${lastProcessedCell.gridX},${lastProcessedCell.gridY}`;

            // Place track if valid orientation and no edge conflict
            // Note: we don't check visitedCells here anymore - trackWouldConflict handles duplicates
            if (orientation) {
              placeTrackAtCell(lastProcessedCell.gridX, lastProcessedCell.gridY, orientation);
              newVisitedCells.add(prevCellKey);
            }

            // Add to path for preview
            newPathCells.push(cell);

            // Update for next iteration
            currentEntrySide = TrackDrawingHelper.getOppositeSide(exitSide);
            lastProcessedCell = cell;
          }

          setDragState({
            ...dragState,
            lastCell: { gridX, gridY },
            entrySide: currentEntrySide,
            visitedCells: newVisitedCells,
            pathCells: newPathCells,
          });
        }

        return; // Skip hover and panning when drawing
      }

      // Update hovered grid cell (only when not drawing)
      setHoveredGridCell({ gridX, gridY });

      const currentPos = new Vector2D(e.clientX, e.clientY);

      if (isPanning) {
        const delta = currentPos.subtract(lastMousePos);
        // Adjust for zoom level
        const adjustedDelta = delta.divide(viewport.zoom);
        adjustViewportPan(adjustedDelta);
        setLastMousePos(currentPos);
      }
    },
    [isPanning, lastMousePos, viewport, adjustViewportPan, gridSize, dragState, circuitGraph, placeTrackAtCell]
  );

  // Mouse up handler (finish drawing and stop panning)
  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Handle final track placement when drag drawing
      if (dragState.isDrawing && dragState.lastCell && dragState.entrySide) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const screenPos = new Vector2D(e.clientX - rect.left, e.clientY - rect.top);
          const renderCtx = new RenderingContext(canvas.getContext('2d')!, viewport, rect.width, rect.height);
          const worldPos = renderCtx.screenToWorld(screenPos);

          // Detect exit side for the final cell
          const exitSide = TrackDrawingHelper.detectSide(
            worldPos,
            dragState.lastCell.gridX,
            dragState.lastCell.gridY,
            gridSize
          );

          // Determine track orientation
          const orientation = TrackDrawingHelper.getTrackOrientation(dragState.entrySide, exitSide);

          // Place final track if valid (conflict detection handles duplicates)
          if (orientation) {
            placeTrackAtCell(dragState.lastCell.gridX, dragState.lastCell.gridY, orientation);
          }
        }
      }

      // Reset drag state if we were drawing
      if (dragState.isDrawing) {
        setDragState({
          isDrawing: false,
          startCell: null,
          lastCell: null,
          entrySide: null,
          visitedCells: new Set(),
          pathCells: [],
        });
      }

      setIsPanning(false);
    },
    [dragState, viewport, gridSize, placeTrackAtCell]
  );

  // Mouse leave handler (stop drawing and panning)
  const handleMouseLeave = useCallback(() => {
    // Stop drawing if leaving canvas
    if (dragState.isDrawing) {
      setDragState({
        isDrawing: false,
        startCell: null,
        lastCell: null,
        entrySide: null,
        visitedCells: new Set(),
        pathCells: [],
      });
    }
    setIsPanning(false);
  }, [dragState.isDrawing]);

  // Right click handler (prevent context menu)
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  }, []);

  // Determine cursor style
  const getCursorStyle = () => {
    if (isPanning) return 'grabbing';
    if (mode === 'edit' && selectedTool.type === 'track') return 'crosshair';
    return 'grab';
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
      style={{ cursor: getCursorStyle() }}
    />
  );
}
