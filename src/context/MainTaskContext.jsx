import { createContext, useContext, useEffect } from "react"
import confetti from "canvas-confetti"
import { useLocalStorage } from "../hooks/useLocalStorage"
import { genStepId } from "../utils/stepUtils"

const MainTaskContext = createContext(null)

function genTaskId() {
  return `mt-${Math.random().toString(36).slice(2, 10)}`
}

function makeStep(raw, order) {
  return {
    id: genStepId(),
    raw: raw || "",
    completed: false,
    order,
    tries: 0,
    linkedAfter: null,
  }
}

function normalizeStep(step, order) {
  return {
    id: step?.id || genStepId(),
    raw: step?.raw || "",
    completed: Boolean(step?.completed),
    order,
    tries: Math.max(0, Number(step?.tries) || 0),
    linkedAfter: step?.linkedAfter || null,
  }
}

function deriveTaskStatus(task) {
  const totalSteps = task.steps.length
  const completedSteps = task.steps.filter((step) => step.completed).length
  if (totalSteps > 0 && completedSteps === totalSteps) return "completed"
  return task.status === "completed" && completedSteps !== totalSteps
    ? "active"
    : task.status || "active"
}

function normalizeTask(task) {
  const steps = (task?.steps || []).map((step, index) => normalizeStep(step, index))
  return {
    id: task?.id || genTaskId(),
    title: task?.title || "",
    steps,
    proof: task?.proof || "",
    priority: task?.priority || "",
    status: deriveTaskStatus({ ...task, steps }),
    tries: Math.max(0, Number(task?.tries) || 0),
    createdAt: task?.createdAt || new Date().toISOString(),
    updatedAt: task?.updatedAt || new Date().toISOString(),
  }
}

export function MainTaskProvider({ children }) {
  const [mainTasks, setMainTasks] = useLocalStorage("fst_main_tasks", [])
  const [saveSlots, setSaveSlots] = useLocalStorage("fst_save_slots", [
    null,
    null,
    null,
    null,
    null,
  ])
  const [fixaPresets, setFixaPresets] = useLocalStorage("fst_fixa_presets", [])
  const [activeMainTaskId, setActiveMainTaskId] = useLocalStorage(
    "fst_active_main_task",
    "",
  )

  useEffect(() => {
    setMainTasks((prev) => prev.map((task) => normalizeTask(task)))
    setSaveSlots((prev) =>
      prev.map((slot) =>
        slot
          ? {
              ...slot,
              tasks: (slot.tasks || []).map((task) => normalizeTask(task)),
            }
          : slot,
      ),
    )
  }, [setMainTasks, setSaveSlots])

  useEffect(() => {
    if (!activeMainTaskId) return
    const exists = mainTasks.some((task) => task.id === activeMainTaskId)
    if (!exists) setActiveMainTaskId("")
  }, [activeMainTaskId, mainTasks, setActiveMainTaskId])

  // ── Main Task CRUD ──────────────────────────────────────────────────────

  function addMainTask(taskData) {
    const now = new Date().toISOString()
    const task = normalizeTask({
      id: genTaskId(),
      title: taskData.title || "",
      steps: (taskData.steps || []).map((s, i) =>
        makeStep(typeof s === "string" ? s : s.raw, i),
      ),
      proof: taskData.proof || "",
      priority: taskData.priority || "",
      status: "active",
      tries: 0,
      createdAt: now,
      updatedAt: now,
    })
    setMainTasks((prev) => [...prev, task])
    return task
  }

  function updateMainTask(id, updates) {
    setMainTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? normalizeTask({
              ...t,
              ...updates,
              updatedAt: new Date().toISOString(),
            })
          : t,
      ),
    )
  }

  function deleteMainTask(id) {
    setMainTasks((prev) => prev.filter((t) => t.id !== id))
    if (activeMainTaskId === id) setActiveMainTaskId("")
  }

  function completeMainTask(id) {
    setMainTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: "completed", updatedAt: new Date().toISOString() }
          : t,
      ),
    )
    if (activeMainTaskId === id) setActiveMainTaskId("")
    triggerBigCelebration()
  }

  function restoreMainTask(id) {
    setMainTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: "active", updatedAt: new Date().toISOString() }
          : t,
      ),
    )
  }

  function incrementTries(id) {
    setMainTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              tries: (t.tries || 0) + 1,
              updatedAt: new Date().toISOString(),
            }
          : t,
      ),
    )
  }

  function decrementTries(id) {
    setMainTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              tries: Math.max(0, (t.tries || 0) - 1),
              updatedAt: new Date().toISOString(),
            }
          : t,
      ),
    )
  }

  // ── Step operations ─────────────────────────────────────────────────────

  function toggleStepComplete(taskId, stepId) {
    let becameCompleted = false
    setMainTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? (() => {
              const next = normalizeTask({
                ...t,
                steps: t.steps.map((s) =>
                  s.id === stepId ? { ...s, completed: !s.completed } : s,
                ),
                updatedAt: new Date().toISOString(),
              })
              becameCompleted =
                t.status !== "completed" && next.status === "completed"
              return next
            })()
          : t,
      ),
    )
    if (becameCompleted) {
      if (activeMainTaskId === taskId) setActiveMainTaskId("")
      triggerBigCelebration()
    }
  }

  function setStepCompleted(taskId, stepId, completed) {
    let becameCompleted = false
    setMainTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? (() => {
              const next = normalizeTask({
                ...t,
                steps: t.steps.map((s) =>
                  s.id === stepId ? { ...s, completed: Boolean(completed) } : s,
                ),
                updatedAt: new Date().toISOString(),
              })
              becameCompleted =
                t.status !== "completed" && next.status === "completed"
              return next
            })()
          : t,
      ),
    )
    if (becameCompleted) {
      if (activeMainTaskId === taskId) setActiveMainTaskId("")
      triggerBigCelebration()
    }
  }

  function updateStep(taskId, stepId, raw) {
    setMainTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? normalizeTask({
              ...t,
              steps: t.steps.map((s) => (s.id === stepId ? { ...s, raw } : s)),
              updatedAt: new Date().toISOString(),
            })
          : t,
      ),
    )
  }

  function addStepToTask(taskId, raw = "") {
    setMainTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? normalizeTask({
              ...t,
              steps: [...t.steps, makeStep(raw, t.steps.length)],
              updatedAt: new Date().toISOString(),
            })
          : t,
      ),
    )
  }

  function addMainTaskAndActivate(taskData) {
    const task = addMainTask(taskData)
    if (task?.id) setActiveMainTaskId(task.id)
    return task
  }

  function removeStepFromTask(taskId, stepId) {
    setMainTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? normalizeTask({
              ...t,
              steps: t.steps
                .filter((s) => s.id !== stepId)
                .map((s, i) => ({ ...s, order: i })),
              updatedAt: new Date().toISOString(),
            })
          : t,
      ),
    )
  }

  function incrementStepTries(taskId, stepId) {
    setMainTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? normalizeTask({
              ...t,
              steps: t.steps.map((s) =>
                s.id === stepId ? { ...s, tries: (s.tries || 0) + 1 } : s,
              ),
              updatedAt: new Date().toISOString(),
            })
          : t,
      ),
    )
  }

  function decrementStepTries(taskId, stepId) {
    setMainTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? normalizeTask({
              ...t,
              steps: t.steps.map((s) =>
                s.id === stepId
                  ? { ...s, tries: Math.max(0, (s.tries || 0) - 1) }
                  : s,
              ),
              updatedAt: new Date().toISOString(),
            })
          : t,
      ),
    )
  }

  function reorderSteps(taskId, fromIndex, toIndex) {
    setMainTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t
        if (fromIndex < 0 || toIndex < 0 || fromIndex >= t.steps.length || toIndex >= t.steps.length) {
          return t
        }
        const steps = [...t.steps]
        const [item] = steps.splice(fromIndex, 1)
        steps.splice(toIndex, 0, item)
        return normalizeTask({
          ...t,
          steps: steps.map((s, i) => ({ ...s, order: i })),
          updatedAt: new Date().toISOString(),
        })
      }),
    )
  }

  function setStepLink(taskId, stepId, relationValue) {
    setMainTasks((prev) =>
      prev.map((t) =>
        t.id !== taskId
          ? t
          : normalizeTask({
              ...t,
              steps: (() => {
                const steps = t.steps.map((s) => ({ ...s }))
                for (const step of steps) {
                  if (step.id === stepId || step.linkedAfter === stepId) {
                    step.linkedAfter = null
                  }
                }
                if (!relationValue) return steps

                const [relation, targetId] = relationValue.split(":")
                if (!targetId) return steps

                if (relation === "after") {
                  return steps.map((step) =>
                    step.id === stepId ? { ...step, linkedAfter: targetId } : step,
                  )
                }

                if (relation === "before") {
                  return steps.map((step) =>
                    step.id === targetId ? { ...step, linkedAfter: stepId } : step,
                  )
                }

                return steps
              })(),
              updatedAt: new Date().toISOString(),
            }),
      ),
    )
  }

  // ── Save/load slots ─────────────────────────────────────────────────────

  function saveSlot(index, name) {
    setSaveSlots((prev) => {
      const copy = [...prev]
      copy[index] = {
        name: name || `Save ${index + 1}`,
        tasks: JSON.parse(JSON.stringify(mainTasks)),
        savedAt: new Date().toISOString(),
      }
      return copy
    })
  }

  function loadSlot(index) {
    const slot = saveSlots[index]
    if (!slot) return false
    setMainTasks((slot.tasks || []).map((task) => normalizeTask(task)))
    setActiveMainTaskId("")
    // Do not auto-activate — user selects which task to work on
    return true
  }

  function clearSlot(index) {
    setSaveSlots((prev) => {
      const copy = [...prev]
      copy[index] = null
      return copy
    })
  }

  // ── Fixa presets ────────────────────────────────────────────────────────

  function saveFixaPreset(presetData) {
    const now = new Date().toISOString()
    const preset = {
      id: `fp-${Math.random().toString(36).slice(2, 10)}`,
      name: presetData.name || "Untitled",
      title: presetData.title || "",
      stepsBlock: presetData.stepsBlock || "",
      proof: presetData.proof || "",
      priority: presetData.priority || "",
      createdAt: now,
    }
    setFixaPresets((prev) => [...prev, preset])
    return preset
  }

  function deleteFixaPreset(id) {
    setFixaPresets((prev) => prev.filter((p) => p.id !== id))
  }

  function loadFixaPreset(presetId) {
    const preset = fixaPresets.find((p) => p.id === presetId)
    if (!preset) return null
    return preset
  }

  // ── Celebration ──────────────────────────────────────────────────────────

  function triggerBigCelebration() {
    const defaults = {
      startVelocity: 45,
      spread: 100,
      ticks: 90,
      zIndex: 9999,
    }
    confetti({
      ...defaults,
      particleCount: 80,
      angle: 60,
      origin: { x: 0, y: 0.65 },
    })
    confetti({
      ...defaults,
      particleCount: 80,
      angle: 120,
      origin: { x: 1, y: 0.65 },
    })
    setTimeout(() => {
      confetti({
        ...defaults,
        particleCount: 80,
        angle: 60,
        origin: { x: 0.1, y: 0.5 },
      })
      confetti({
        ...defaults,
        particleCount: 80,
        angle: 120,
        origin: { x: 0.9, y: 0.5 },
      })
    }, 260)
    setTimeout(() => {
      confetti({
        particleCount: 160,
        spread: 180,
        origin: { x: 0.5, y: 0.35 },
        startVelocity: 55,
        ticks: 110,
        zIndex: 9999,
      })
    }, 520)
  }

  const value = {
    mainTasks,
    saveSlots,
    fixaPresets,
    activeMainTaskId,
    setActiveMainTaskId,
    addMainTask,
    addMainTaskAndActivate,
    updateMainTask,
    deleteMainTask,
    completeMainTask,
    restoreMainTask,
    incrementTries,
    decrementTries,
    incrementStepTries,
    decrementStepTries,
    reorderSteps,
    setStepLink,
    toggleStepComplete,
    setStepCompleted,
    updateStep,
    addStepToTask,
    removeStepFromTask,
    saveSlot,
    loadSlot,
    clearSlot,
    saveFixaPreset,
    deleteFixaPreset,
    loadFixaPreset,
    triggerBigCelebration,
  }

  return (
    <MainTaskContext.Provider value={value}>
      {children}
    </MainTaskContext.Provider>
  )
}

export function useMainTask() {
  const ctx = useContext(MainTaskContext)
  if (!ctx) throw new Error("useMainTask must be used inside MainTaskProvider")
  return ctx
}
