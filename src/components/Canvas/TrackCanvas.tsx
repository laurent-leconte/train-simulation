import { useCallback, useRef, useState, useEffect } from 'react';
import { useStore } from '@/state/store';
import { Vector2D } from '@/core/geometry/Vector2D';
import { RenderingContext } from '@/rendering/RenderingContext';
import { GridRenderer } from '@/rendering/GridRenderer';
import { TrackRenderer } from '@/rendering/renderers/TrackRenderer';
import { TrainRenderer } from '@/rendering/renderers/TrainRenderer';
import { GridCircuitBuilder } from '@/services/GridCircuitBuilder';
import { TrainPhysics } from '@/services/TrainPhysics';
import { TrainPathFollower } from '@/services/TrainPathFollower';
import { Train, DEFAULT_TRAIN_SETTINGS } from '@/types/train.types';
import { nanoid } from 'nanoid';

/**
 * Main canvas component for track editing and simulation
 */
export function TrackCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<Vector2D>(Vector2D.zero());
  const [hoveredGridCell, setHoveredGridCell] = useState<{ gridX: number; gridY: number } | null>(null);

  const gridRendererRef = useRef(new GridRenderer());
  const trackRendererRef = useRef(new TrackRenderer());
  const trainRendererRef = useRef(new TrainRenderer());

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
      console.log('Simulation not running:', { mode, isRunning: simulation.isRunning, isPaused: simulation.isPaused });
      return;
    }

    console.log('Starting simulation loop with', simulation.trains.size, 'trains');

    let lastTime = performance.now();
    let animationFrameId: number;

    const fixedTimeStep = 1 / 60; // 60 FPS physics

    const loop = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;

      // Update physics with fixed timestep
      const adjustedDelta = Math.min(deltaTime * simulation.simulationSpeed, fixedTimeStep * 3);

      console.log('Simulation tick, deltaTime:', adjustedDelta);

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

        // Update the train
        TrainPhysics.updateTrain(
          trainCopy,
          adjustedDelta,
          circuitGraph.edges,
          circuitGraph.nodes
        );

        // Update store
        updateTrain(train.id, trainCopy);
      });

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      console.log('Stopping simulation loop');
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

    // Render trains
    trainRendererRef.current.renderAll(simulation.trains, renderCtx, selectedElement);

    // Render hovered grid cell highlight with track preview
    if (hoveredGridCell && mode === 'edit' && selectedTool.type === 'track') {
      ctx.save();
      ctx.fillStyle = 'rgba(96, 165, 250, 0.15)';
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.4)';
      ctx.lineWidth = 2;

      const cellX = hoveredGridCell.gridX * gridSize;
      const cellY = hoveredGridCell.gridY * gridSize;

      // Draw cell highlight
      ctx.fillRect(cellX, cellY, gridSize, gridSize);
      ctx.strokeRect(cellX, cellY, gridSize, gridSize);

      // Get the geometry for the selected track orientation
      const { geometry } = GridCircuitBuilder.getGeometryForOrientation(
        selectedTool.orientation,
        cellX,
        cellY,
        gridSize
      );

      // Render preview of the track
      trackRendererRef.current.renderPreview(geometry, ctx);

      ctx.restore();
    }

    // Restore state
    renderCtx.restore();

    // Render UI overlay (zoom level, etc.)
    renderOverlay(ctx, rect.width, rect.height);
  }, [viewport, showGrid, gridSize, circuitGraph, selectedElement, hoveredGridCell, mode, selectedTool, simulation.trains]);

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

  // Handle canvas click for placing tracks
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

      if (selectedTool.type === 'track') {
        try {
          // Check if track already exists at this position
          if (GridCircuitBuilder.trackExistsAt(gridX, gridY, circuitGraph.edges)) {
            console.log('Track already exists at this position');
            return;
          }

          // Create mutable copy of nodes map
          const nodesCopy = new Map();
          circuitGraph.nodes.forEach((node, key) => {
            nodesCopy.set(key, {
              ...node,
              position: new Vector2D(node.position.x, node.position.y),
              connectedSegments: [...node.connectedSegments],
            });
          });

          // Create track at grid position
          const result = GridCircuitBuilder.createGridTrack(
            gridX,
            gridY,
            selectedTool.orientation,
            gridSize,
            nodesCopy
          );

          // Update the store
          useStore.setState((state) => {
            state.circuit.graph.nodes = nodesCopy;
            state.circuit.graph.edges.set(result.segment.id, result.segment);
          });
        } catch (error) {
          console.error('Failed to create track:', error);
        }
      } else if (selectedTool.type === 'delete') {
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

  // Mouse down handler (start panning or handle clicks)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // If we're drawing, let the click handler manage it
      if (mode === 'edit' && selectedTool.type === 'track' && e.button === 0) {
        handleClick(e);
        return;
      }

      // If in simulation mode and clicking on track, place a train
      if (mode === 'simulate' && e.button === 0) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const screenPos = new Vector2D(e.clientX - rect.left, e.clientY - rect.top);
        const renderCtx = new RenderingContext(canvas.getContext('2d')!, viewport, rect.width, rect.height);
        const worldPos = renderCtx.screenToWorld(screenPos);

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
            const newTrain: Train = {
              id: nanoid(),
              position,
              velocity: 0,
              ...DEFAULT_TRAIN_SETTINGS,
              isRunning: true, // Start the train immediately
            };

            console.log('Created train:', newTrain);
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
    [mode, selectedTool, handleClick, viewport, circuitGraph, simulation.trains, addTrain, setSimulationRunning]
  );

  // Mouse move handler (pan and update hover)
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const screenPos = new Vector2D(e.clientX - rect.left, e.clientY - rect.top);
      const renderCtx = new RenderingContext(canvas.getContext('2d')!, viewport, rect.width, rect.height);
      const worldPos = renderCtx.screenToWorld(screenPos);

      // Update hovered grid cell
      const { gridX, gridY } = GridCircuitBuilder.worldToGrid(worldPos, gridSize);
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
    [isPanning, lastMousePos, viewport, adjustViewportPan, gridSize]
  );

  // Mouse up handler (stop panning)
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Mouse leave handler (stop panning)
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

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
