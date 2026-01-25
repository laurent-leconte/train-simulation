import { Vector2D } from '@/core/geometry/Vector2D';
import { SignalState, RailOrientation } from './index';

/**
 * Track node - represents junctions/connection points
 */
export interface TrackNode {
  id: string;
  position: Vector2D;
  connectedSegments: string[];
  type: 'simple' | 'junction' | 'switch';
}

/**
 * Geometry for straight track segments
 */
export interface StraightGeometry {
  type: 'straight';
  start: Vector2D;
  end: Vector2D;
}

/**
 * Geometry for curved track segments (Bezier curve)
 */
export interface CurveGeometry {
  type: 'curve';
  start: Vector2D;
  end: Vector2D;
  controlPoint1: Vector2D;
  controlPoint2?: Vector2D; // For cubic curves (optional)
  radius: number;
  arc: number; // Arc angle in radians
}

export type TrackGeometry = StraightGeometry | CurveGeometry;

/**
 * Track segment - represents a rail segment between two nodes
 */
export interface TrackSegment {
  id: string;
  type: 'straight' | 'curve';
  orientation: RailOrientation; // Grid-based orientation
  startNode: string;
  endNode: string;
  geometry: TrackGeometry;
  length: number; // Pre-calculated length in meters
  gridX: number; // Grid position X
  gridY: number; // Grid position Y
}

/**
 * Switch/turnout - allows train to change tracks
 */
export interface Switch {
  id: string;
  nodeId: string; // Junction node where switch is located
  incomingTrack: string; // Track segment coming into the switch
  outgoingTracks: [string, string]; // Two possible outgoing paths
  currentPosition: 0 | 1; // Which track is currently active
  type: 'left' | 'right' | 'wye';
}

/**
 * Station - where trains can stop (spans 3 cells alongside track)
 */
export interface Station {
  id: string;
  name: string;
  segmentIds: string[]; // The track segments the station spans (up to 3)
  side: 'left' | 'right'; // Which side of the track the platform is on
  stopDuration: number; // Duration in seconds
}

/**
 * Signal - traffic control
 */
export interface Signal {
  id: string;
  segmentId: string; // Track segment where signal is located
  distance: number; // Position along segment
  state: SignalState;
  type: 'automatic' | 'manual';
  protectedZone?: string; // Optional: track segment to protect
}

/**
 * Circuit graph - contains all track elements
 */
export interface CircuitGraph {
  nodes: Map<string, TrackNode>;
  edges: Map<string, TrackSegment>;
  switches: Map<string, Switch>;
  stations: Map<string, Station>;
  signals: Map<string, Signal>;
}

/**
 * Circuit state
 */
export interface CircuitState {
  graph: CircuitGraph;
}
