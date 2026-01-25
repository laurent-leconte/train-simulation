import { TrackSegment, TrackNode, Switch } from '@/types/circuit.types';
import { Train } from '@/types/train.types';

/**
 * Debug state output for troubleshooting simulation issues
 */
export interface DebugState {
  timestamp: string;
  tracks: {
    segments: DebugSegment[];
    nodes: DebugNode[];
    switches: DebugSwitch[];
  };
  trains: DebugTrain[];
}

interface DebugSegment {
  id: string;
  type: string;
  startNode: string;
  endNode: string;
  length: number;
  geometry: {
    start: { x: number; y: number };
    end: { x: number; y: number };
    controlPoint1?: { x: number; y: number };
    controlPoint2?: { x: number; y: number };
  };
}

interface DebugNode {
  id: string;
  position: { x: number; y: number };
  connectedSegments: string[];
}

interface DebugSwitch {
  id: string;
  nodeId: string;
  incomingTrack: string;
  outgoingTracks: string[];
  currentPosition: number;
}

interface DebugTrain {
  id: string;
  isRunning: boolean;
  velocity: number;
  position: {
    segmentId: string;
    distance: number;
    worldPosition: { x: number; y: number };
    direction: { x: number; y: number };
    reversed: boolean;
  };
  carriages: Array<{
    worldPosition: { x: number; y: number };
    direction: { x: number; y: number };
  }>;
  positionHistory: Array<{
    segmentId: string;
    distance: number;
    worldX: number;
    worldY: number;
    timestamp: number;
  }>;
}

/**
 * Serialize simulation state for debugging
 */
export class DebugSerializer {
  static serialize(
    segments: Map<string, TrackSegment>,
    nodes: Map<string, TrackNode>,
    switches: Map<string, Switch>,
    trains: Map<string, Train>
  ): string {
    const state: DebugState = {
      timestamp: new Date().toISOString(),
      tracks: {
        segments: this.serializeSegments(segments),
        nodes: this.serializeNodes(nodes),
        switches: this.serializeSwitches(switches),
      },
      trains: this.serializeTrains(trains),
    };

    return JSON.stringify(state, null, 2);
  }

  private static serializeSegments(segments: Map<string, TrackSegment>): DebugSegment[] {
    const result: DebugSegment[] = [];

    for (const segment of segments.values()) {
      const geom = segment.geometry;
      const debugSegment: DebugSegment = {
        id: segment.id,
        type: segment.type,
        startNode: segment.startNode,
        endNode: segment.endNode,
        length: segment.length,
        geometry: {
          start: { x: geom.start.x, y: geom.start.y },
          end: { x: geom.end.x, y: geom.end.y },
        },
      };

      if ('controlPoint1' in geom && geom.controlPoint1) {
        debugSegment.geometry.controlPoint1 = {
          x: geom.controlPoint1.x,
          y: geom.controlPoint1.y,
        };
      }
      if ('controlPoint2' in geom && geom.controlPoint2) {
        debugSegment.geometry.controlPoint2 = {
          x: geom.controlPoint2.x,
          y: geom.controlPoint2.y,
        };
      }

      result.push(debugSegment);
    }

    return result;
  }

  private static serializeNodes(nodes: Map<string, TrackNode>): DebugNode[] {
    const result: DebugNode[] = [];

    for (const node of nodes.values()) {
      result.push({
        id: node.id,
        position: { x: node.position.x, y: node.position.y },
        connectedSegments: [...node.connectedSegments],
      });
    }

    return result;
  }

  private static serializeSwitches(switches: Map<string, Switch>): DebugSwitch[] {
    const result: DebugSwitch[] = [];

    for (const sw of switches.values()) {
      result.push({
        id: sw.id,
        nodeId: sw.nodeId,
        incomingTrack: sw.incomingTrack,
        outgoingTracks: [...sw.outgoingTracks],
        currentPosition: sw.currentPosition,
      });
    }

    return result;
  }

  private static serializeTrains(trains: Map<string, Train>): DebugTrain[] {
    const result: DebugTrain[] = [];

    for (const train of trains.values()) {
      result.push({
        id: train.id,
        isRunning: train.isRunning,
        velocity: train.velocity,
        position: {
          segmentId: train.position.segmentId,
          distance: train.position.distance,
          worldPosition: {
            x: train.position.worldPosition.x,
            y: train.position.worldPosition.y,
          },
          direction: {
            x: train.position.direction.x,
            y: train.position.direction.y,
          },
          reversed: train.position.reversed,
        },
        carriages: (train.carriagePositions || []).map(cp => ({
          worldPosition: { x: cp.worldPosition.x, y: cp.worldPosition.y },
          direction: { x: cp.direction.x, y: cp.direction.y },
        })),
        positionHistory: train.positionHistory || [],
      });
    }

    return result;
  }
}
