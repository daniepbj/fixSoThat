import { useEffect } from "react"
import FeatureHello from "./components/FeatureHello"
import AppLinks from "./components/AppLinks"
import TimerApp from "./components/TimerApp"
import StructuredTaskBuilder from "./components/StructuredTaskBuilder"
import GuidedCategoryBuilder from "./components/GuidedCategoryBuilder"
import AdhdBridgeBuilder from "./components/AdhdBridgeBuilder"
import GuidedSmallImprovementBuilder from "./components/GuidedSmallImprovementBuilder"
import MainTaskList from "./components/MainTaskList"
import FixaPresetPanel from "./components/FixaPresetPanel"
import SaveLoadPanel from "./components/SaveLoadPanel"
import RetryReflectionModal from "./components/RetryReflectionModal"
import { MainTaskProvider, useMainTask } from "./context/MainTaskContext"
import { AppSyncProvider } from "./context/AppSyncContext"
import { useLocalStorage } from "./hooks/useLocalStorage"
import { playClickSound } from "./utils/soundEffects"
import { getTimezoneOverride, setTimezoneOverride } from "./utils/timeUtils"

const DEFAULT_SECTION_ORDER = [
  "structured-task-builder",
  "main-task-list",
  "guided-small-improvement-builder",
  "guided-category-builder",
  "adhd-bridge-builder",
  "fixa-preset-panel",
  "save-load-panel",
  "app-links",
  "feature-hello",
]

const SECTION_LABELS = {
  "structured-task-builder": "Structured task writer",
  "guided-small-improvement-builder": "Build a small improvement",
  "guided-category-builder": "Guided category builder",
  "adhd-bridge-builder": "ADHD bridge builder",
  "main-task-list": "Task list",
  "fixa-preset-panel": "Presets / templates",
  "save-load-panel": "Save / Load",
  "app-links": "Apps I use",
  "feature-hello": "Feature component",
}

const DEFAULT_SECTION_COLLAPSED = {
  "structured-task-builder": false,
  "guided-small-improvement-builder": true,
  "guided-category-builder": true,
  "adhd-bridge-builder": true,
  "main-task-list": false,
  "fixa-preset-panel": false,
  "save-load-panel": true,
  "app-links": true,
  "feature-hello": true,
}

// Keep only valid known ids (no dupes), then append any missing ones
function normalizeSectionOrder(order) {
  const source = Array.isArray(order) ? order : []
  const result = []
  for (const id of source) {
    if (DEFAULT_SECTION_ORDER.includes(id) && !result.includes(id)) {
      result.push(id)
    }
  }
  for (const id of DEFAULT_SECTION_ORDER) {
    if (!result.includes(id)) result.push(id)
  }
  return result
}

// Normalize collapse state: fill missing known sections, discard orphaned ones, default unknown sections to collapsed
function normalizeSectionCollapsed(collapsed) {
  if (!collapsed || typeof collapsed !== "object") {
    return DEFAULT_SECTION_COLLAPSED
  }
  const normalized = {}
  for (const id of DEFAULT_SECTION_ORDER) {
    normalized[id] = collapsed[id] ?? DEFAULT_SECTION_COLLAPSED[id]
  }
  return normalized
}

export default function App() {
  useEffect(() => {
    // Default timezone to Oslo if the user has never set an override
    if (!getTimezoneOverride()) setTimezoneOverride("Europe/Oslo")
    function handleClick(e) {
      if (e.target.closest("button")) playClickSound()
    }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [])

  return (
    <AppSyncProvider>
      <MainTaskProvider>
        <AppContent />
      </MainTaskProvider>
    </AppSyncProvider>
  )
}

function AppContent() {
  const { retryReflectionTaskId } = useMainTask()
  const [rawOrder, setRawOrder] = useLocalStorage(
    "fst_section_order",
    DEFAULT_SECTION_ORDER,
  )
  const sectionOrder = normalizeSectionOrder(rawOrder)

  const [rawCollapsed, setRawCollapsed] = useLocalStorage(
    "fst_section_collapsed",
    DEFAULT_SECTION_COLLAPSED,
    normalizeSectionCollapsed,
  )
  const sectionCollapsed = normalizeSectionCollapsed(rawCollapsed)

  function moveSection(id, direction) {
    setRawOrder((prev) => {
      const order = normalizeSectionOrder(prev)
      const from = order.indexOf(id)
      const to =
        direction === "top"
          ? 0
          : direction === "up"
            ? from - 1
            : direction === "down"
              ? from + 1
              : order.length - 1
      if (from < 0 || to < 0 || to >= order.length || from === to) return order
      const next = [...order]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  function toggleSectionCollapsed(id) {
    setRawCollapsed((prev) => {
      const current = normalizeSectionCollapsed(prev)
      return { ...current, [id]: !current[id] }
    })
  }

  function getSectionControls(id, index) {
    return {
      label: SECTION_LABELS[id] || id,
      canMoveTop: index > 0,
      canMoveUp: index > 0,
      canMoveDown: index < sectionOrder.length - 1,
      canMoveBottom: index < sectionOrder.length - 1,
      onMoveTop: () => moveSection(id, "top"),
      onMoveUp: () => moveSection(id, "up"),
      onMoveDown: () => moveSection(id, "down"),
      onMoveBottom: () => moveSection(id, "bottom"),
    }
  }

  function getSectionProps(id) {
    return {
      sectionCollapsed: sectionCollapsed[id] ?? false,
      onToggleSectionCollapsed: () => toggleSectionCollapsed(id),
    }
  }

  function renderSection(id, controls) {
    const props = getSectionProps(id)
    switch (id) {
      case "structured-task-builder":
        return (
          <StructuredTaskBuilder
            key={id}
            sectionControls={controls}
            {...props}
          />
        )
      case "guided-small-improvement-builder":
        return (
          <GuidedSmallImprovementBuilder
            key={id}
            sectionControls={controls}
            {...props}
          />
        )
      case "guided-category-builder":
        return (
          <GuidedCategoryBuilder
            key={id}
            sectionControls={controls}
            {...props}
          />
        )
      case "adhd-bridge-builder":
        return (
          <AdhdBridgeBuilder key={id} sectionControls={controls} {...props} />
        )
      case "main-task-list":
        return <MainTaskList key={id} sectionControls={controls} {...props} />
      case "fixa-preset-panel":
        return (
          <FixaPresetPanel key={id} sectionControls={controls} {...props} />
        )
      case "save-load-panel":
        return <SaveLoadPanel key={id} sectionControls={controls} {...props} />
      case "app-links":
        return <AppLinks key={id} sectionControls={controls} {...props} />
      case "feature-hello":
        return <FeatureHello key={id} sectionControls={controls} {...props} />
      default:
        return null
    }
  }

  return (
    <>
      <div className="app-layout">
        {/* ── Left sidebar: focus timer ── */}
        <aside className="app-sidebar">
          <TimerApp sidebarMode />
        </aside>

        {/* ── Main content area ── */}
        <main className="app-main">
          {sectionOrder.map((id, index) =>
            renderSection(id, getSectionControls(id, index)),
          )}
        </main>
      </div>
      {retryReflectionTaskId && <RetryReflectionModal />}
    </>
  )
}
