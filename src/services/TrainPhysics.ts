import { Train } from '@/types/train.types';
import { TrackSegment, TrackNode, Switch } from '@/types/circuit.types';
import { TrainPathFollower } from './TrainPathFollower';

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
   */
  static updateTrain(
    train: Train,
    deltaTime: number,
    segments: Map<string, TrackSegment>,
    nodes: Map<string, TrackNode>,
    switches?: Map<string, Switch>
  ): void {
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
      } else {
        train.velocity = 0;
      }
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
    switches?: Map<string, Switch>
  ): void {
    for (const train of trains.values()) {
      this.updateTrain(train, deltaTime, segments, nodes, switches);
    }
  }
}
