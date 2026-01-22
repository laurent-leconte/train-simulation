import { useStore } from '@/state/store';
import { useEffect, useCallback } from 'react';

/**
 * Simulation controls component (simplified on/off model)
 */
export function SimulationControls() {
  const simulation = useStore((state) => state.simulation);
  const setSimulationRunning = useStore((state) => state.setSimulationRunning);
  const setSimulationPaused = useStore((state) => state.setSimulationPaused);
  const setSimulationSpeed = useStore((state) => state.setSimulationSpeed);
  const updateTrain = useStore((state) => state.updateTrain);
  const trains = Array.from(simulation.trains.values());

  // Keyboard controls for train on/off
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (trains.length === 0) return;

      // Control the first train (for now)
      const train = trains[0];

      switch (e.key.toLowerCase()) {
        case ' ':
          // Toggle train on/off
          e.preventDefault();
          updateTrain(train.id, { isRunning: !train.isRunning });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [trains, updateTrain]);

  const handlePlayPause = useCallback(() => {
    if (!simulation.isRunning) {
      setSimulationRunning(true);
      setSimulationPaused(false);
    } else {
      setSimulationPaused(!simulation.isPaused);
    }
  }, [simulation.isRunning, simulation.isPaused, setSimulationRunning, setSimulationPaused]);

  const handleStop = useCallback(() => {
    setSimulationRunning(false);
    setSimulationPaused(false);
  }, [setSimulationRunning, setSimulationPaused]);

  const handleSpeedChange = useCallback((speed: number) => {
    setSimulationSpeed(speed);
  }, [setSimulationSpeed]);

  const handleToggleTrain = useCallback(() => {
    if (trains.length > 0) {
      const train = trains[0];
      updateTrain(train.id, { isRunning: !train.isRunning });
    }
  }, [trains, updateTrain]);

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4">
      <div className="flex items-center gap-4">
        {/* Play/Pause/Stop controls */}
        <div className="flex gap-2">
          <button
            onClick={handlePlayPause}
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white font-medium"
          >
            {!simulation.isRunning || simulation.isPaused ? '▶ Play' : '⏸ Pause'}
          </button>
          <button
            onClick={handleStop}
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-medium"
            disabled={!simulation.isRunning}
          >
            ⏹ Stop
          </button>
        </div>

        {/* Speed control */}
        <div className="flex items-center gap-2">
          <span className="text-gray-300 text-sm">Vitesse:</span>
          <button
            onClick={() => handleSpeedChange(0.5)}
            className={`px-3 py-1 rounded text-sm ${
              simulation.simulationSpeed === 0.5
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            0.5x
          </button>
          <button
            onClick={() => handleSpeedChange(1.0)}
            className={`px-3 py-1 rounded text-sm ${
              simulation.simulationSpeed === 1.0
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            1x
          </button>
          <button
            onClick={() => handleSpeedChange(2.0)}
            className={`px-3 py-1 rounded text-sm ${
              simulation.simulationSpeed === 2.0
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            2x
          </button>
        </div>

        {/* Train controls */}
        {trains.length > 0 && (
          <div className="border-l border-gray-700 pl-4 flex items-center gap-2">
            <span className="text-gray-300 text-sm">Train:</span>
            <button
              onClick={handleToggleTrain}
              className={`px-3 py-1 rounded text-sm font-medium ${
                trains[0].isRunning
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-600 hover:bg-gray-500 text-white'
              }`}
            >
              {trains[0].isRunning ? '⏸ Arrêter' : '▶ Démarrer'}
            </button>
            <div className="text-white text-sm">
              Vitesse: {trains[0].velocity.toFixed(1)} px/s
            </div>
            <div className="text-gray-400 text-xs">
              (Espace: Basculer train)
            </div>
          </div>
        )}

        {trains.length === 0 && (
          <div className="border-l border-gray-700 pl-4 text-gray-400 text-sm">
            Cliquez sur un rail pour placer un train
          </div>
        )}
      </div>
    </div>
  );
}
