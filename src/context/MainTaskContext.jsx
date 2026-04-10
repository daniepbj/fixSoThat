import { createContext, useContext, useEffect, useState } from "react"
import { playPowerUpSound, playCompletionSound } from "../utils/soundEffects"
import confetti from "canvas-confetti"
import { useLocalStorage } from "../hooks/useLocalStorage"
import {
  genStepId,
  parseStepBlockTree,
  flattenTreeToSteps,
  getDescendants,
} from "../utils/stepUtils"

const MainTaskContext = createContext(null)

function genTaskId() {
  return `mt-${Math.random().toString(36).slice(2, 10)}`
}

// ── Flat step helpers ────────────────────────────────────────────────────

function makeStep(raw, order, parentId = null, options = {}) {
  return {
    id: options.id || genStepId(),
    raw: raw || "",
    completed: Boolean(options.completed),
    parentId: parentId ?? null,
    order: typeof order === "number" ? order : 0,
    tries: Math.max(0, Number(options.tries) || 0),
  }
}

function normalizeStep(step, order) {
  return {
    id: step?.id || genStepId(),
    raw: step?.raw || "",
    completed: Boolean(step?.completed),
    parentId: step?.parentId ?? null,
    order:
      typeof step?.order === "number"
        ? step.order
        : typeof order === "number"
          ? order
          : 0,
    tries: Math.max(0, Number(step?.tries) || 0),
  }
}

// Bottom-up completion propagation: if all children done → parent done
function normalizeCompletionFlat(flatSteps) {
  const steps = flatSteps.map((s) => ({ ...s }))
  let changed = true
  let maxPasses = steps.length + 2
  while (changed && maxPasses-- > 0) {
    changed = false
    for (const step of steps) {
      const children = steps.filter((s) => s.parentId === step.id)
      if (children.length === 0) continue
      const allDone = children.every((c) => c.completed)
      if (step.completed !== allDone) {
        step.completed = allDone
        changed = true
      }
    }
  }
  return steps
}

function countTreeStats(flatSteps) {
  let total = 0
  let completed = 0
  for (const s of flatSteps || []) {
    total++
    if (s.completed) completed++
  }
  return { total, completed }
}

// Mark a step and all its descendants as completed/uncompleted
function setBranchCompleted(flatSteps, stepId, completed) {
  const descendants = getDescendants(flatSteps, stepId)
  const ids = new Set([stepId, ...descendants.map((d) => d.id)])
  return (flatSteps || []).map((s) =>
    ids.has(s.id) ? { ...s, completed: Boolean(completed) } : s,
  )
}

function updateStepById(flatSteps, stepId, updater) {
  let found = false
  const steps = (flatSteps || []).map((s) => {
    if (s.id === stepId) {
      found = true
      return updater(s)
    }
    return s
  })
  return { steps, found }
}

function removeStepById(flatSteps, stepId) {
  const descendants = getDescendants(flatSteps, stepId)
  const ids = new Set([stepId, ...descendants.map((d) => d.id)])
  return { steps: (flatSteps || []).filter((s) => !ids.has(s.id)), found: true }
}

function findStepById(flatSteps, stepId) {
  return (flatSteps || []).find((s) => s.id === stepId) || null
}

function deriveTaskStatus(task) {
  const { total: totalSteps, completed: completedSteps } = countTreeStats(
    task.steps,
  )
  if (totalSteps > 0 && completedSteps === totalSteps) return "completed"
  return task.status === "completed" && completedSteps !== totalSteps
    ? "active"
    : task.status || "active"
}

function normalizeTask(task) {
  const rawSteps = Array.isArray(task?.steps) ? task.steps : []

  let flatSteps
  if (
    rawSteps.length > 0 &&
    rawSteps.some((s) => "substeps" in s || "children" in s)
  ) {
    // Old embedded format: flatten to flat array with parentId
    flatSteps = flattenTreeToSteps(rawSteps, null)
  } else {
    // Already flat: normalize each step
    flatSteps = rawSteps.map((s, i) => normalizeStep(s, i))
  }

  // Remove dangling parentId references (after step deletions etc.)
  const validIds = new Set(flatSteps.map((s) => s.id))
  flatSteps = flatSteps.map((s) => ({
    ...s,
    parentId:
      s.parentId != null && validIds.has(s.parentId) ? s.parentId : null,
  }))

  // Bottom-up completion normalization
  flatSteps = normalizeCompletionFlat(flatSteps)

  return {
    id: task?.id || genTaskId(),
    title: task?.title || "",
    steps: flatSteps,
    proof: task?.proof || "",
    priority: task?.priority || "",
    status: deriveTaskStatus({ ...task, steps: flatSteps }),
    tries: Math.max(0, Number(task?.tries) || 0),
    retryReflections: Array.isArray(task?.retryReflections)
      ? task.retryReflections
      : [],
    createdAt: task?.createdAt || new Date().toISOString(),
    updatedAt: task?.updatedAt || new Date().toISOString(),
  }
}

// Max order among siblings of a given parentId
function maxSiblingOrder(flatSteps, parentId) {
  const siblings = (flatSteps || []).filter(
    (s) => (s.parentId ?? null) === (parentId ?? null),
  )
  return siblings.length ? Math.max(...siblings.map((s) => s.order ?? 0)) : -1
}

export function MainTaskProvider({ children }) {
  const [mainTasks, setMainTasks] = useLocalStorage(
    "fst_main_tasks",
    [],
    (raw) => (Array.isArray(raw) ? raw : []).map((t) => normalizeTask(t)),
  )
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
  const [retryReflectionTaskId, setRetryReflectionTaskId] = useState(null)

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
      steps: Array.isArray(taskData.steps) ? taskData.steps : [],
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
    playPowerUpSound().then(() => {
      playCompletionSound()
      triggerBigCelebration()
    })
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
    let newTries = 0
    setMainTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        newTries = (t.tries || 0) + 1
        return {
          ...t,
          tries: newTries,
          updatedAt: new Date().toISOString(),
        }
      }),
    )
    // Trigger reflection modal at every multiple of 3
    setTimeout(() => {
      if (newTries > 0 && newTries % 3 === 0) {
        setRetryReflectionTaskId(id)
      }
    }, 0)
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
              const step = findStepById(t.steps, stepId)
              if (!step) return t
              const nextCompleted = !step.completed
              const branchedSteps = setBranchCompleted(
                t.steps,
                stepId,
                nextCompleted,
              )
              const next = normalizeTask({
                ...t,
                steps: branchedSteps,
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
              const step = findStepById(t.steps, stepId)
              if (!step) return t
              const branchedSteps = setBranchCompleted(
                t.steps,
                stepId,
                completed,
              )
              const next = normalizeTask({
                ...t,
                steps: branchedSteps,
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
              steps: updateStepById(t.steps, stepId, (current) => ({
                ...current,
                raw,
              })).steps,
              updatedAt: new Date().toISOString(),
            })
          : t,
      ),
    )
  }

  function addStepToTask(taskId, raw = "") {
    setMainTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t
        const order = maxSiblingOrder(t.steps, null) + 1
        return normalizeTask({
          ...t,
          steps: [...t.steps, makeStep(raw, order, null)],
          updatedAt: new Date().toISOString(),
        })
      }),
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
              steps: removeStepById(t.steps, stepId).steps,
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
              steps: updateStepById(t.steps, stepId, (current) => ({
                ...current,
                tries: (current.tries || 0) + 1,
              })).steps,
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
              steps: updateStepById(t.steps, stepId, (current) => ({
                ...current,
                tries: Math.max(0, (current.tries || 0) - 1),
              })).steps,
              updatedAt: new Date().toISOString(),
            })
          : t,
      ),
    )
  }

  // Add a child step under parentStepId
  function addSubstep(taskId, parentStepId, raw = "") {
    setMainTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t
        if (!findStepById(t.steps, parentStepId)) return t
        const order = maxSiblingOrder(t.steps, parentStepId) + 1
        return normalizeTask({
          ...t,
          steps: [...t.steps, makeStep(raw, order, parentStepId)],
          updatedAt: new Date().toISOString(),
        })
      }),
    )
  }

  // Move a step up or down among its siblings (subtree follows automatically)
  function reorderStep(taskId, stepId, direction) {
    setMainTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t
        const step = t.steps.find((s) => s.id === stepId)
        if (!step) return t
        const siblings = t.steps
          .filter((s) => (s.parentId ?? null) === (step.parentId ?? null))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        const idx = siblings.findIndex((s) => s.id === stepId)
        if (direction === "up" && idx <= 0) return t
        if (direction === "down" && idx >= siblings.length - 1) return t
        const swapStep = siblings[direction === "up" ? idx - 1 : idx + 1]
        const stepOrd = step.order ?? idx
        const swapOrd =
          swapStep.order ?? (direction === "up" ? idx - 1 : idx + 1)
        const newSteps = t.steps.map((s) => {
          if (s.id === stepId) return { ...s, order: swapOrd }
          if (s.id === swapStep.id) return { ...s, order: stepOrd }
          return s
        })
        return normalizeTask({
          ...t,
          steps: newSteps,
          updatedAt: new Date().toISOString(),
        })
      }),
    )
  }

  // Move a step under a different parent (descendants follow automatically)
  function reparentStep(taskId, stepId, newParentId) {
    setMainTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t
        if (!t.steps.find((s) => s.id === stepId)) return t
        if (stepId === (newParentId ?? null)) return t
        // Prevent reparenting into own subtree
        const descendants = getDescendants(t.steps, stepId)
        if (newParentId && descendants.some((d) => d.id === newParentId))
          return t
        const order =
          maxSiblingOrder(
            t.steps.filter((s) => s.id !== stepId),
            newParentId ?? null,
          ) + 1
        const newSteps = t.steps.map((s) =>
          s.id === stepId ? { ...s, parentId: newParentId ?? null, order } : s,
        )
        return normalizeTask({
          ...t,
          steps: newSteps,
          updatedAt: new Date().toISOString(),
        })
      }),
    )
  }

  // Promote a step one level up (parentId → grandparentId), placed after current parent
  function promoteStep(taskId, stepId) {
    setMainTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t
        const step = t.steps.find((s) => s.id === stepId)
        if (!step || step.parentId == null) return t
        const parent = t.steps.find((s) => s.id === step.parentId)
        if (!parent) return t
        const grandparentId = parent.parentId ?? null
        const parentOrder = parent.order ?? 0
        // Place right after parent in grandparent group; use fractional order then renumber
        const newSteps = t.steps.map((s) =>
          s.id === stepId
            ? { ...s, parentId: grandparentId, order: parentOrder + 0.5 }
            : s,
        )
        // Renumber grandparent group to integers
        const gpGroup = newSteps
          .filter((s) => (s.parentId ?? null) === (grandparentId ?? null))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        const renumbered = new Map(gpGroup.map((s, i) => [s.id, i]))
        const finalSteps = newSteps.map((s) =>
          renumbered.has(s.id) ? { ...s, order: renumbered.get(s.id) } : s,
        )
        return normalizeTask({
          ...t,
          steps: finalSteps,
          updatedAt: new Date().toISOString(),
        })
      }),
    )
  }

  // Demote a step under its previous sibling (becomes that sibling's last child)
  function demoteStep(taskId, stepId) {
    setMainTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t
        const step = t.steps.find((s) => s.id === stepId)
        if (!step) return t
        const siblings = t.steps
          .filter((s) => (s.parentId ?? null) === (step.parentId ?? null))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        const idx = siblings.findIndex((s) => s.id === stepId)
        if (idx <= 0) return t
        const prevSibling = siblings[idx - 1]
        const order = maxSiblingOrder(t.steps, prevSibling.id) + 1
        const newSteps = t.steps.map((s) =>
          s.id === stepId ? { ...s, parentId: prevSibling.id, order } : s,
        )
        return normalizeTask({
          ...t,
          steps: newSteps,
          updatedAt: new Date().toISOString(),
        })
      }),
    )
  }

  // Move sourceId next to targetId as a sibling ("before" or "after")
  function moveStepNextTo(taskId, sourceId, targetId, zone) {
    setMainTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t
        const source = t.steps.find((s) => s.id === sourceId)
        const target = t.steps.find((s) => s.id === targetId)
        if (!source || !target) return t
        // Prevent dropping into own subtree
        const descendants = getDescendants(t.steps, sourceId)
        if (descendants.some((d) => d.id === targetId)) return t
        const targetParentId = target.parentId ?? null
        const targetOrder = target.order ?? 0
        // Place source in target's parent group at a fractional order
        const offset = zone === "before" ? -0.5 : 0.5
        const newSteps = t.steps.map((s) =>
          s.id === sourceId
            ? { ...s, parentId: targetParentId, order: targetOrder + offset }
            : s,
        )
        // Renumber siblings to clean integers
        const group = newSteps
          .filter((s) => (s.parentId ?? null) === (targetParentId ?? null))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        const renumbered = new Map(group.map((s, i) => [s.id, i]))
        const finalSteps = newSteps.map((s) =>
          renumbered.has(s.id) ? { ...s, order: renumbered.get(s.id) } : s,
        )
        return normalizeTask({
          ...t,
          steps: finalSteps,
          updatedAt: new Date().toISOString(),
        })
      }),
    )
  }

  function breakDownStepWithFixa(taskId, stepId, stepsBlock) {
    const parsed = parseStepBlockTree(stepsBlock || "")
    if (!parsed.length) return false

    // Flatten the parsed embedded tree into flat steps with stepId as the root parent
    const newFlatSteps = flattenTreeToSteps(parsed, stepId)

    let applied = false
    setMainTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t
        if (!findStepById(t.steps, stepId)) return t
        // Offset root-level new children's orders so they append after existing children
        const existingChildMaxOrder = maxSiblingOrder(t.steps, stepId)
        const adjustedSteps = newFlatSteps.map((s) =>
          (s.parentId ?? null) === (stepId ?? null)
            ? { ...s, order: s.order + existingChildMaxOrder + 1 }
            : s,
        )
        applied = true
        return normalizeTask({
          ...t,
          steps: [...t.steps, ...adjustedSteps],
          updatedAt: new Date().toISOString(),
        })
      }),
    )

    return applied
  }

  // ── Retry reflection ────────────────────────────────────────────────────

  function saveRetryReflection(taskId, reflectionData) {
    const {
      reasons = [],
      freeText = "",
      newSteps = [],
      parentStepId = null,
    } = reflectionData
    const addedStepIds = []
    const now = new Date().toISOString()

    setMainTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t
        let steps = [...t.steps]

        // Create real substeps from the new steps
        for (const stepRaw of newSteps) {
          const raw = (stepRaw || "").trim()
          if (!raw) continue
          const effectiveParent = parentStepId ?? null
          const order = maxSiblingOrder(steps, effectiveParent) + 1
          const newStep = makeStep(raw, order, effectiveParent)
          addedStepIds.push(newStep.id)
          steps = [...steps, newStep]
        }

        const reflection = {
          atTry: t.tries || 0,
          reasons,
          freeText: freeText || "",
          addedStepIds,
          createdAt: now,
        }

        return normalizeTask({
          ...t,
          steps,
          retryReflections: [...(t.retryReflections || []), reflection],
          updatedAt: now,
        })
      }),
    )

    setRetryReflectionTaskId(null)
    return addedStepIds
  }

  function dismissRetryReflection() {
    setRetryReflectionTaskId(null)
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
    retryReflectionTaskId,
    setRetryReflectionTaskId,
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
    reorderStep,
    addSubstep,
    reparentStep,
    promoteStep,
    demoteStep,
    moveStepNextTo,
    toggleStepComplete,
    setStepCompleted,
    updateStep,
    addStepToTask,
    removeStepFromTask,
    breakDownStepWithFixa,
    saveRetryReflection,
    dismissRetryReflection,
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
