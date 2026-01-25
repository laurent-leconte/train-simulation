import { useStore } from '@/state/store';
import { ToolType } from '@/types';

/**
 * Main toolbar component for tool selection
 */
export function Toolbar() {
  const selectedTool = useStore((state) => state.editor.selectedTool);
  const setSelectedTool = useStore((state) => state.setSelectedTool);
  const mode = useStore((state) => state.editor.mode);
  const setEditorMode = useStore((state) => state.setEditorMode);
  const clearCircuit = useStore((state) => state.clearCircuit);

  const isToolActive = (tool: ToolType) => {
    return tool.type === selectedTool.type;
  };

  const getButtonClass = (tool: ToolType) => {
    const baseClass = 'px-4 py-2 rounded font-medium transition-colors';
    const active = isToolActive(tool);
    return active
      ? `${baseClass} bg-blue-600 text-white`
      : `${baseClass} bg-gray-700 text-gray-300 hover:bg-gray-600`;
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700 p-3">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Mode selector */}
        <div className="flex gap-2 border-r border-gray-700 pr-3">
          <button
            onClick={() => setEditorMode('edit')}
            className={
              mode === 'edit'
                ? 'px-4 py-2 rounded bg-green-600 text-white font-medium'
                : 'px-4 py-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 font-medium'
            }
          >
            Mode Édition
          </button>
          <button
            onClick={() => setEditorMode('simulate')}
            className={
              mode === 'simulate'
                ? 'px-4 py-2 rounded bg-green-600 text-white font-medium'
                : 'px-4 py-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 font-medium'
            }
          >
            Mode Simulation
          </button>
        </div>

        {/* Track tools (only in edit mode) */}
        {mode === 'edit' && (
          <>
            <div className="flex gap-2 border-r border-gray-700 pr-3">
              <button
                onClick={() => setSelectedTool({ type: 'select' })}
                className={getButtonClass({ type: 'select' })}
                title="Sélectionner (Échap)"
              >
                ↖️ Sélectionner
              </button>
            </div>

            <div className="flex gap-2 border-r border-gray-700 pr-3">
              <button
                onClick={() => setSelectedTool({ type: 'track' })}
                className={getButtonClass({ type: 'track' })}
                title="Tracer des rails (cliquer-glisser)"
              >
                🛤️ Rail
              </button>
            </div>

            <div className="flex gap-2 border-r border-gray-700 pr-3">
              <button
                onClick={() => setSelectedTool({ type: 'station' })}
                className={getButtonClass({ type: 'station' })}
                title="Placer une gare"
              >
                🏢 Gare
              </button>
              <button
                onClick={() => setSelectedTool({ type: 'signal' })}
                className={getButtonClass({ type: 'signal' })}
                title="Placer un signal"
              >
                🚦 Signal
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSelectedTool({ type: 'delete' })}
                className={getButtonClass({ type: 'delete' })}
                title="Supprimer"
              >
                🗑️ Supprimer
              </button>
              <button
                onClick={clearCircuit}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 font-medium"
                title="Effacer tout"
              >
                ⚠️ Tout effacer
              </button>
            </div>
          </>
        )}

        {/* Simulation controls (only in simulate mode) */}
        {mode === 'simulate' && (
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedTool({ type: 'train' })}
              className={getButtonClass({ type: 'train' })}
              title="Placer un train"
            >
              🚂 Placer Train
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
