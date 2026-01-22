import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { Vector2D } from '@/core/geometry/Vector2D';
import { ViewportState, ToolType, EditorMode, SignalState } from '@/types';
import { CircuitState } from '@/types/circuit.types';
import { Train } from '@/types/train.types';
import { TrackSegment, TrackNode, Switch, Station, Signal } from '@/types/circuit.types';

/**
 * Simulation state
 */
interface SimulationState {
  isRunning: boolean;
  isPaused: boolean;
  simulationSpeed: number; // 1.0 = real-time
  currentTime: number; // Simulation time in seconds
  trains: Map<string, Train>;
}

// Enable Map/Set support in Immer
enableMapSet();

/**
 * Editor state
 */
interface EditorState {
  mode: EditorMode;
  selectedTool: ToolType;
  selectedElement: string | null;
  snapToGrid: boolean;
  gridSize: number;
  showGrid: boolean;
}

/**
 * UI state
 */
interface UIState {
  viewport: ViewportState;
}

/**
 * Complete application state
 */
interface AppState {
  // State slices
  circuit: CircuitState;
  simulation: SimulationState;
  editor: EditorState;
  ui: UIState;

  // Circuit actions
  addTrackSegment: (segment: TrackSegment) => void;
  removeTrackSegment: (id: string) => void;
  updateNodes: (nodes: Map<string, TrackNode>) => void;
  addSwitch: (switchObj: Switch) => void;
  removeSwitch: (id: string) => void;
  updateSwitch: (id: string, position: 0 | 1) => void;
  addStation: (station: Station) => void;
  removeStation: (id: string) => void;
  updateStation: (id: string, updates: Partial<Station>) => void;
  addSignal: (signal: Signal) => void;
  removeSignal: (id: string) => void;
  updateSignal: (id: string, state: SignalState) => void;
  clearCircuit: () => void;

  // Train actions
  addTrain: (train: Train) => void;
  removeTrain: (id: string) => void;
  updateTrain: (id: string, updates: Partial<Train>) => void;

  // Simulation actions
  setSimulationRunning: (running: boolean) => void;
  setSimulationPaused: (paused: boolean) => void;
  setSimulationSpeed: (speed: number) => void;
  resetSimulation: () => void;

  // Editor actions
  setEditorMode: (mode: EditorMode) => void;
  setSelectedTool: (tool: ToolType) => void;
  setSelectedElement: (id: string | null) => void;
  setSnapToGrid: (snap: boolean) => void;
  setGridSize: (size: number) => void;
  setShowGrid: (show: boolean) => void;

  // UI actions
  setViewportZoom: (zoom: number) => void;
  setViewportPan: (pan: Vector2D) => void;
  adjustViewportZoom: (delta: number) => void;
  adjustViewportPan: (delta: Vector2D) => void;
}

/**
 * Initial state
 */
const initialCircuitState: CircuitState = {
  graph: {
    nodes: new Map(),
    edges: new Map(),
    switches: new Map(),
    stations: new Map(),
    signals: new Map(),
  },
};

const initialSimulationState: SimulationState = {
  isRunning: false,
  isPaused: false,
  simulationSpeed: 1.0,
  currentTime: 0,
  trains: new Map(),
};

const initialEditorState: EditorState = {
  mode: 'edit',
  selectedTool: { type: 'select' },
  selectedElement: null,
  snapToGrid: true, // Always snap to grid
  gridSize: 50, // Larger grid cells for easier placement
  showGrid: true,
};

const initialUIState: UIState = {
  viewport: {
    zoom: 1.0,
    pan: Vector2D.zero(),
  },
};

/**
 * Main application store
 */
export const useStore = create<AppState>()(
  immer((set) => ({
    // Initial state
    circuit: initialCircuitState,
    simulation: initialSimulationState,
    editor: initialEditorState,
    ui: initialUIState,

    // Circuit actions
    addTrackSegment: (segment) =>
      set((state) => {
        state.circuit.graph.edges.set(segment.id, segment);
      }),

    removeTrackSegment: (id) =>
      set((state) => {
        state.circuit.graph.edges.delete(id);
      }),

    updateNodes: (nodes) =>
      set((state) => {
        state.circuit.graph.nodes = nodes;
      }),

    addSwitch: (switchObj) =>
      set((state) => {
        state.circuit.graph.switches.set(switchObj.id, switchObj);
      }),

    removeSwitch: (id) =>
      set((state) => {
        state.circuit.graph.switches.delete(id);
      }),

    updateSwitch: (id, position) =>
      set((state) => {
        const switchObj = state.circuit.graph.switches.get(id);
        if (switchObj) {
          switchObj.currentPosition = position;
        }
      }),

    addStation: (station) =>
      set((state) => {
        state.circuit.graph.stations.set(station.id, station);
      }),

    removeStation: (id) =>
      set((state) => {
        state.circuit.graph.stations.delete(id);
      }),

    updateStation: (id, updates) =>
      set((state) => {
        const station = state.circuit.graph.stations.get(id);
        if (station) {
          Object.assign(station, updates);
        }
      }),

    addSignal: (signal) =>
      set((state) => {
        state.circuit.graph.signals.set(signal.id, signal);
      }),

    removeSignal: (id) =>
      set((state) => {
        state.circuit.graph.signals.delete(id);
      }),

    updateSignal: (id, signalState) =>
      set((state) => {
        const signal = state.circuit.graph.signals.get(id);
        if (signal) {
          signal.state = signalState;
        }
      }),

    clearCircuit: () =>
      set((state) => {
        state.circuit.graph.nodes.clear();
        state.circuit.graph.edges.clear();
        state.circuit.graph.switches.clear();
        state.circuit.graph.stations.clear();
        state.circuit.graph.signals.clear();
        // Also clear trains and reset simulation
        state.simulation.trains.clear();
        state.simulation.isRunning = false;
        state.simulation.isPaused = false;
        state.simulation.currentTime = 0;
      }),

    // Train actions
    addTrain: (train) =>
      set((state) => {
        state.simulation.trains.set(train.id, train);
      }),

    removeTrain: (id) =>
      set((state) => {
        state.simulation.trains.delete(id);
      }),

    updateTrain: (id, updates) =>
      set((state) => {
        const train = state.simulation.trains.get(id);
        if (train) {
          Object.assign(train, updates);
        }
      }),

    // Simulation actions
    setSimulationRunning: (running) =>
      set((state) => {
        state.simulation.isRunning = running;
        if (running) {
          state.simulation.isPaused = false;
        }
      }),

    setSimulationPaused: (paused) =>
      set((state) => {
        state.simulation.isPaused = paused;
      }),

    setSimulationSpeed: (speed) =>
      set((state) => {
        state.simulation.simulationSpeed = Math.max(0.1, Math.min(speed, 5.0));
      }),

    resetSimulation: () =>
      set((state) => {
        state.simulation.isRunning = false;
        state.simulation.isPaused = false;
        state.simulation.currentTime = 0;
        state.simulation.trains.clear();
      }),

    // Editor actions
    setEditorMode: (mode) =>
      set((state) => {
        state.editor.mode = mode;
        if (mode === 'simulate') {
          // When entering simulate mode, deselect any selected elements
          state.editor.selectedElement = null;
          state.editor.selectedTool = { type: 'select' };
        }
      }),

    setSelectedTool: (tool) =>
      set((state) => {
        state.editor.selectedTool = tool;
        // Deselect element when changing tools
        state.editor.selectedElement = null;
      }),

    setSelectedElement: (id) =>
      set((state) => {
        state.editor.selectedElement = id;
      }),

    setSnapToGrid: (snap) =>
      set((state) => {
        state.editor.snapToGrid = snap;
      }),

    setGridSize: (size) =>
      set((state) => {
        state.editor.gridSize = Math.max(5, Math.min(size, 100));
      }),

    setShowGrid: (show) =>
      set((state) => {
        state.editor.showGrid = show;
      }),

    // UI actions
    setViewportZoom: (zoom) =>
      set((state) => {
        state.ui.viewport.zoom = Math.max(0.1, Math.min(zoom, 10));
      }),

    setViewportPan: (pan) =>
      set((state) => {
        state.ui.viewport.pan = pan;
      }),

    adjustViewportZoom: (delta) =>
      set((state) => {
        const newZoom = state.ui.viewport.zoom + delta;
        state.ui.viewport.zoom = Math.max(0.1, Math.min(newZoom, 10));
      }),

    adjustViewportPan: (delta) =>
      set((state) => {
        state.ui.viewport.pan = state.ui.viewport.pan.add(delta);
      }),
  }))
);
