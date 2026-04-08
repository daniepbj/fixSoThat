import FeatureHello from "./components/FeatureHello"
import AppLinks from "./components/AppLinks"
import TimerApp from "./components/TimerApp"
import StructuredTaskBuilder from "./components/StructuredTaskBuilder"
import MainTaskList from "./components/MainTaskList"
import FixaPresetPanel from "./components/FixaPresetPanel"
import SaveLoadPanel from "./components/SaveLoadPanel"
import { MainTaskProvider } from "./context/MainTaskContext"

export default function App() {
  return (
    <MainTaskProvider>
      <div className="app-layout">
        {/* ── Left sidebar: focus timer ── */}
        <aside className="app-sidebar">
          <TimerApp sidebarMode />
        </aside>

        {/* ── Main content area ── */}
        <main className="app-main">
          <FeatureHello />
          <AppLinks />
          <StructuredTaskBuilder />
          <MainTaskList />
          <FixaPresetPanel />
          <SaveLoadPanel />
        </main>
      </div>
    </MainTaskProvider>
  )
}
