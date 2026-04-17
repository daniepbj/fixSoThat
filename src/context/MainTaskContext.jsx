import { createContext, useContext, useEffect, useState } from "react"
import { playPowerUpSound, playCompletionSound } from "../utils/soundEffects"
import confetti from "canvas-confetti"
import { useLocalStorage } from "../hooks/useLocalStorage"
import { COLORS } from "../data/seedData"
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
  const status = task?.status || "active"
  const steps = Array.isArray(task?.steps) ? task.steps : []
  if (!steps.length) return status
  const hasIncomplete = steps.some((s) => !s.completed)
  return hasIncomplete ? "active" : "completed"
}

function deriveTaskColor(task) {
  if (typeof task?.color === "string" && task.color.trim()) {
    return task.color
  }

  const seed = String(task?.id || task?.title || "main-task")
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  return COLORS[hash % COLORS.length] || "#10b981"
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

  return {
    id: task?.id || genTaskId(),
    title: task?.title || "",
    color: deriveTaskColor(task),
    now: task?.now || "",
    steps: flatSteps,
    proof: task?.proof || "",
    priority: task?.priority || "",
    status: deriveTaskStatus({ ...task, steps: flatSteps }),
    waitCompatible: Boolean(task?.waitCompatible),
    waitCompatibleUpdatedAt: task?.waitCompatibleUpdatedAt || null,
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
  const [deletedMainTasks, setDeletedMainTasks] = useLocalStorage(
    "fst_deleted_main",
    [],
    (raw) =>
      (Array.isArray(raw) ? raw : []).map((t) => ({
        ...normalizeTask(t),
        deletedAt: t?.deletedAt || t?.updatedAt || new Date().toISOString(),
      })),
  )
  const [deferredMainTasks, setDeferredMainTasks] = useLocalStorage(
    "fst_deferred_main",
    [],
    (raw) =>
      (Array.isArray(raw) ? raw : []).map((t) => ({
        ...normalizeTask(t),
        deferredAt: t?.deferredAt || t?.updatedAt || new Date().toISOString(),
      })),
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
    setDeletedMainTasks((prev) =>
      prev.map((task) => ({
        ...normalizeTask(task),
        deletedAt:
          task?.deletedAt || task?.updatedAt || new Date().toISOString(),
      })),
    )
    setDeferredMainTasks((prev) =>
      prev.map((task) => ({
        ...normalizeTask(task),
        deferredAt:
          task?.deferredAt || task?.updatedAt || new Date().toISOString(),
      })),
    )
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
  }, [setDeferredMainTasks, setDeletedMainTasks, setMainTasks, setSaveSlots])

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
      now: taskData.now || "",
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

  function setMainTaskWaitCompatible(id, compatible) {
    const nextCompatible = Boolean(compatible)
    const now = new Date().toISOString()
    setMainTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? normalizeTask({
              ...t,
              waitCompatible: nextCompatible,
              waitCompatibleUpdatedAt: now,
              updatedAt: now,
            })
          : t,
      ),
    )
  }

  function toggleMainTaskWaitCompatible(id) {
    setMainTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const now = new Date().toISOString()
        return normalizeTask({
          ...t,
          waitCompatible: !Boolean(t.waitCompatible),
          waitCompatibleUpdatedAt: now,
          updatedAt: now,
        })
      }),
    )
  }

  function bulkSetMainTaskWaitCompatible(ids, compatible) {
    const idSet = new Set(Array.isArray(ids) ? ids.filter(Boolean) : [])
    if (!idSet.size) return
    const nextCompatible = Boolean(compatible)
    const now = new Date().toISOString()
    setMainTasks((prev) =>
      prev.map((t) =>
        idSet.has(t.id)
          ? normalizeTask({
              ...t,
              waitCompatible: nextCompatible,
              waitCompatibleUpdatedAt: now,
              updatedAt: now,
            })
          : t,
      ),
    )
  }

  function deleteMainTask(id) {
    const task = mainTasks.find((t) => t.id === id)
    if (!task) return

    setDeletedMainTasks((prev) => [
      ...prev,
      { ...task, deletedAt: new Date().toISOString() },
    ])
    setMainTasks((prev) => prev.filter((t) => t.id !== id))
    if (activeMainTaskId === id) setActiveMainTaskId("")
  }

  function undoDeleteMainTask(id) {
    const task = deletedMainTasks.find((t) => t.id === id)
    if (!task) return

    setDeletedMainTasks((prev) => prev.filter((t) => t.id !== id))
    setMainTasks((prev) => {
      const { deletedAt, ...restored } = task
      return [...prev, restored]
    })
  }

  function clearDeletedMainTasks() {
    setDeletedMainTasks([])
  }

  function deferMainTask(id) {
    const task = mainTasks.find((t) => t.id === id)
    if (!task) return

    setDeferredMainTasks((prev) => [
      ...prev,
      { ...task, deferredAt: new Date().toISOString() },
    ])
    setMainTasks((prev) => prev.filter((t) => t.id !== id))
    if (activeMainTaskId === id) setActiveMainTaskId("")
  }

  function restoreDeferredMainTask(id) {
    const task = deferredMainTasks.find((t) => t.id === id)
    if (!task) return

    setDeferredMainTasks((prev) => prev.filter((t) => t.id !== id))
    setMainTasks((prev) => {
      const { deferredAt, ...restored } = task
      return [
        ...prev,
        normalizeTask({
          ...restored,
          status: "active",
          updatedAt: new Date().toISOString(),
        }),
      ]
    })
  }

  function clearDeferredMainTasks() {
    setDeferredMainTasks([])
  }

  function completeMainTask(id) {
    setMainTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? normalizeTask({
              ...t,
              status: "completed",
              steps: (t.steps || []).map((step) => ({
                ...step,
                completed: true,
              })),
              updatedAt: new Date().toISOString(),
            })
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

  function reorderMainTask(dragId, targetId) {
    if (!dragId || !targetId || dragId === targetId) return
    setMainTasks((prev) => {
      const from = prev.findIndex((task) => task.id === dragId)
      const to = prev.findIndex((task) => task.id === targetId)
      if (from < 0 || to < 0 || from === to) return prev
      const copy = [...prev]
      const [item] = copy.splice(from, 1)
      copy.splice(to, 0, item)
      return copy
    })
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
    // Trigger reflection modal exactly when this task reaches 3 tries.
    setTimeout(() => {
      if (newTries === 3) {
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
              return normalizeTask({
                ...t,
                steps: branchedSteps,
                updatedAt: new Date().toISOString(),
              })
            })()
          : t,
      ),
    )
  }

  function setStepCompleted(taskId, stepId, completed) {
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
              return normalizeTask({
                ...t,
                steps: branchedSteps,
                updatedAt: new Date().toISOString(),
              })
            })()
          : t,
      ),
    )
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
    setMainTasks((prev) => {
      const now = new Date().toISOString()
      const next = []

      for (const task of prev) {
        if (task.id !== taskId) {
          next.push(task)
          continue
        }

        const updatedSteps = removeStepById(task.steps, stepId).steps
        if (updatedSteps.length === 0) {
          setDeletedMainTasks((deleted) => [
            ...deleted,
            { ...task, deletedAt: now, updatedAt: now },
          ])
          if (activeMainTaskId === taskId) {
            setActiveMainTaskId("")
          }
          continue
        }

        next.push(
          normalizeTask({
            ...task,
            steps: updatedSteps,
            updatedAt: now,
          }),
        )
      }

      return next
    })
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

  function reorderMainTaskStep(taskId, sourceId, targetId, zone = "after") {
    moveStepNextTo(taskId, sourceId, targetId, zone)
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

  const activeWaitCompatibleMainTasks = mainTasks.filter(
    (task) => task.status === "active" && Boolean(task.waitCompatible),
  )

  const value = {
    mainTasks,
    deletedMainTasks,
    deferredMainTasks,
    saveSlots,
    fixaPresets,
    activeMainTaskId,
    setActiveMainTaskId,
    retryReflectionTaskId,
    setRetryReflectionTaskId,
    addMainTask,
    addMainTaskAndActivate,
    updateMainTask,
    setMainTaskWaitCompatible,
    toggleMainTaskWaitCompatible,
    bulkSetMainTaskWaitCompatible,
    deleteMainTask,
    deferMainTask,
    undoDeleteMainTask,
    clearDeletedMainTasks,
    restoreDeferredMainTask,
    clearDeferredMainTasks,
    completeMainTask,
    restoreMainTask,
    reorderMainTask,
    reorderMainTaskStep,
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
    activeWaitCompatibleMainTasks,
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
