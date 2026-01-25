import { Train, PositionSnapshot, TrainPosition } from '@/types/train.types';
import { TrackSegment, TrackNode, Switch, Station } from '@/types/circuit.types';
import { TrainPathFollower } from './TrainPathFollower';

// Small buffer so the locomotive stops slightly before the very end of the station
const STATION_STOP_BUFFER = 5;

// Need enough history to cover locomotive + all carriages + gaps
// At 100px/s and 60fps, ~162px of train needs ~100 position samples
const MAX_POSITION_HISTORY = 100;

/**
 * Physics engine for train simulation (simplified on/off model)
 */
export class TrainPhysics {
  /**
   * Update train physics for one timestep
   * @param train The train to update
   * @param deltaTime Time step in seconds
   * @param segments Available track segments
   * @param nodes Available track nodes
   * @param switches Available switches (for routing decisions)
   * @param stations Available stations (for stopping)
   */
  static updateTrain(
    train: Train,
    deltaTime: number,
    segments: Map<string, TrackSegment>,
    nodes: Map<string, TrackNode>,
    switches?: Map<string, Switch>,
    stations?: Map<string, Station>
  ): void {
    // Handle station stop countdown
    if (train.stoppedAtStation && train.stationStopTimeRemaining > 0) {
      train.stationStopTimeRemaining -= deltaTime;
      if (train.stationStopTimeRemaining > 0) {
        // Still stopped at station
        train.velocity = 0;
        return;
      }
      // Timer expired - train will resume moving but stoppedAtStation stays set
      // until the train leaves the zone (checked below after movement)
    }

    // Simple on/off control
    if (train.isRunning) {
      train.velocity = train.speed;
    } else {
      train.velocity = 0;
    }

    // Move train along track
    const deltaDistance = train.velocity * deltaTime;

    if (deltaDistance !== 0) {
      const newPosition = TrainPathFollower.moveAlongTrack(
        train.position,
        deltaDistance,
        segments,
        nodes,
        switches
      );

      if (newPosition) {
        train.position = newPosition;

        // Check if we should stop at a station or clear previous station
        if (stations) {
          let atAnyStation = false;
          let currentStation: Station | null = null;

          for (const station of stations.values()) {
            // Check if train is on any of the station's segments
            const isOnStationSegment = station.segmentIds.includes(newPosition.segmentId);

            if (isOnStationSegment) {
              atAnyStation = true;
              currentStation = station;
              break;
            }
          }

          if (currentStation) {
            if (train.stoppedAtStation === currentStation.id) {
              // Already stopped at this station - do nothing
            } else if (train.approachingStation === currentStation.id) {
              // Already approaching this station - check if we've reached the stop position
              if (this.hasReachedStopPosition(train, newPosition)) {
                // We've reached the stop position - stop the train
                train.stoppedAtStation = currentStation.id;
                train.stationStopTimeRemaining = currentStation.stopDuration;
                train.approachingStation = null;
                train.velocity = 0;
              }
            } else if (!train.stoppedAtStation && !train.approachingStation) {
              // First time entering this station - calculate stop position
              const stopPos = this.calculateStationStopPosition(
                newPosition,
                currentStation,
                segments,
                nodes,
                switches
              );
              if (stopPos) {
                train.approachingStation = currentStation.id;
                train.stationStopTargetSegmentId = stopPos.segmentId;
                train.stationStopTargetDistance = stopPos.distance;
              } else {
                // Couldn't calculate stop position - stop immediately
                train.stoppedAtStation = currentStation.id;
                train.stationStopTimeRemaining = currentStation.stopDuration;
                train.velocity = 0;
              }
            }
          }

          // Clear station flags if we've left ALL station zones
          if (!atAnyStation) {
            if (train.stoppedAtStation) {
              train.stoppedAtStation = null;
            }
            if (train.approachingStation) {
              train.approachingStation = null;
              train.stationStopTargetSegmentId = null;
              train.stationStopTargetDistance = 0;
            }
          }
        }

        // Record position history
        const snapshot: PositionSnapshot = {
          segmentId: newPosition.segmentId,
          distance: newPosition.distance,
          worldX: newPosition.worldPosition.x,
          worldY: newPosition.worldPosition.y,
          timestamp: Date.now(),
        };

        if (!train.positionHistory) {
          train.positionHistory = [];
        }
        train.positionHistory.push(snapshot);

        // Keep only the last N positions
        if (train.positionHistory.length > MAX_POSITION_HISTORY) {
          train.positionHistory = train.positionHistory.slice(-MAX_POSITION_HISTORY);
        }
      } else {
        train.velocity = 0;
      }
    }

    // Update carriage positions (pass position history for correct junction routing)
    if (train.carriageCount > 0) {
      train.carriagePositions = TrainPathFollower.calculateCarriagePositions(
        train.position,
        train.length,
        train.carriageCount,
        train.carriageLength,
        train.carriageGap,
        segments,
        nodes,
        train.positionHistory
      );
    }
  }

  /**
   * Update all trains in the simulation
   */
  static updateAllTrains(
    trains: Map<string, Train>,
    deltaTime: number,
    segments: Map<string, TrackSegment>,
    nodes: Map<string, TrackNode>,
    switches?: Map<string, Switch>,
    stations?: Map<string, Station>
  ): void {
    for (const train of trains.values()) {
      this.updateTrain(train, deltaTime, segments, nodes, switches, stations);
    }
  }

  /**
   * Check if the train has reached its target stop position
   */
  private static hasReachedStopPosition(train: Train, currentPosition: TrainPosition): boolean {
    if (!train.stationStopTargetSegmentId) return false;

    // If on the target segment, check if we've reached or passed the target distance
    if (currentPosition.segmentId === train.stationStopTargetSegmentId) {
      if (currentPosition.reversed) {
        // Moving backwards along segment - stop when distance <= target
        return currentPosition.distance <= train.stationStopTargetDistance;
      } else {
        // Moving forwards along segment - stop when distance >= target
        return currentPosition.distance >= train.stationStopTargetDistance;
      }
    }

    return false;
  }

  /**
   * Calculate where the train should stop in the station
   * Returns the position at the end of the last station segment (in the train's direction)
   */
  private static calculateStationStopPosition(
    currentPosition: TrainPosition,
    station: Station,
    segments: Map<string, TrackSegment>,
    nodes: Map<string, TrackNode>,
    switches?: Map<string, Switch>
  ): { segmentId: string; distance: number } | null {
    const stationSegmentSet = new Set(station.segmentIds);

    // Start from current position and walk forward until we exit the station
    let pos: TrainPosition | null = { ...currentPosition };
    let lastStationSegmentId = currentPosition.segmentId;
    let lastStationReversed = currentPosition.reversed;

    // Walk through the station, tracking which segment is the last one before we exit
    const visited = new Set<string>();
    while (pos && stationSegmentSet.has(pos.segmentId)) {
      if (visited.has(pos.segmentId)) break; // Prevent infinite loops
      visited.add(pos.segmentId);

      lastStationSegmentId = pos.segmentId;
      lastStationReversed = pos.reversed;

      // Try to move to the next segment
      const segment = segments.get(pos.segmentId);
      if (!segment) break;

      // Move to the end of this segment
      const distanceToEnd = lastStationReversed ? pos.distance : segment.length - pos.distance;

      // Move forward by that distance plus a bit to cross into the next segment
      const nextPos = TrainPathFollower.moveAlongTrack(
        pos,
        distanceToEnd + 1, // +1 to cross the boundary
        segments,
        nodes,
        switches
      );

      if (!nextPos || nextPos.segmentId === pos.segmentId) {
        // Couldn't move further - this is the last segment
        break;
      }

      pos = nextPos;
    }

    // The stop position is at the end of the last station segment
    const lastSegment = segments.get(lastStationSegmentId);
    if (!lastSegment) return null;

    // If traversing reversed, stop near distance 0; otherwise stop near segment.length
    const stopDistance = lastStationReversed
      ? STATION_STOP_BUFFER
      : lastSegment.length - STATION_STOP_BUFFER;

    return {
      segmentId: lastStationSegmentId,
      distance: Math.max(0, Math.min(stopDistance, lastSegment.length)),
    };
  }
}
