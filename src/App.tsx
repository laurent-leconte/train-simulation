import { TrackCanvas } from './components/Canvas/TrackCanvas'
import { Toolbar } from './components/Toolbar/Toolbar'
import { SimulationControls } from './components/SimulationControls/SimulationControls'
import { useStore } from './state/store'

function App() {
  const mode = useStore((state) => state.editor.mode);

  return (
    <div className="w-full h-full flex flex-col bg-gray-900">
      <header className="bg-gray-800 text-white p-4 shadow-lg">
        <h1 className="text-2xl font-bold">Simulateur de Train Électrique</h1>
      </header>
      <Toolbar />
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 bg-gray-700 relative">
          <TrackCanvas />
          {mode === 'simulate' && <SimulationControls />}
        </div>
      </main>
    </div>
  )
}

export default App
