import { useEffect } from "react"
import FeatureHello from "./components/FeatureHello"
import AppLinks from "./components/AppLinks"
import TimerApp from "./components/TimerApp"
import StructuredTaskBuilder from "./components/StructuredTaskBuilder"
import GuidedCategoryBuilder from "./components/GuidedCategoryBuilder"
import MainTaskList from "./components/MainTaskList"
import FixaPresetPanel from "./components/FixaPresetPanel"
import SaveLoadPanel from "./components/SaveLoadPanel"
import RetryReflectionModal from "./components/RetryReflectionModal"
import { MainTaskProvider, useMainTask } from "./context/MainTaskContext"
import { playClickSound } from "./utils/soundEffects"

export default function App() {
  useEffect(() => {
    function handleClick(e) {
      if (e.target.closest("button")) playClickSound()
    }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [])

  return (
    <MainTaskProvider>
      <AppContent />
    </MainTaskProvider>
  )
}

function AppContent() {
  const { retryReflectionTaskId } = useMainTask()

  return (
    <>
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
          <GuidedCategoryBuilder />
          <MainTaskList />
          <FixaPresetPanel />
          <SaveLoadPanel />
        </main>
      </div>
      {retryReflectionTaskId && <RetryReflectionModal />}
    </>
  )
}
