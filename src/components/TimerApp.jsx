import { useState, useEffect, useRef } from "react"
import { useLocalStorage } from "../hooks/useLocalStorage"
import { createTask, initStorageIfNew, EMOJIS, COLORS } from "../data/seedData"
import TopBar from "./TopBar"
import TimerPanel from "./TimerPanel"
import TaskList from "./TaskList"
import AddTaskForm from "./AddTaskForm"
import DeferredTasksPanel from "./DeferredTasksPanel"
import ReportView from "./ReportView"
import PresetsView from "./PresetsView"
import SettingsView from "./SettingsView"
import BottomNav from "./BottomNav"
import "../timer.css"

// Seed localStorage exactly once – never re-seeds after user clears tasks
initStorageIfNew()

const MAX_TASK_SECONDS = 60 * 60

function clampMinutes(value, fallback = 25) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.max(1, Math.min(60, Math.round(num)))
}

function clampSeconds(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.max(0, Math.min(MAX_TASK_SECONDS, Math.round(num)))
}

function normalizeAdhdFlags(flags) {
  return {
    needsSteps: false,
    needsTime: false,
    needsProof: false,
    priority: false,
    ...(flags || {}),
  }
}

function normalizeTask(task) {
  const estimatedMinutes = clampMinutes(task.estimatedMinutes, 25)
  const fallbackRemaining = estimatedMinutes * 60
  return {
    ...task,
    estimatedMinutes,
    remainingSeconds: clampSeconds(task.remainingSeconds ?? fallbackRemaining),
    spentSeconds: Math.max(0, Number(task.spentSeconds) || 0),
    adhdFlags: normalizeAdhdFlags(task.adhdFlags),
  }
}

export default function TimerApp() {
  // All defaults are [] / {} because initStorageIfNew already populated localStorage
  const [activeTasks, setActiveTasks] = useLocalStorage("fst_active", [])
  const [completedTasks, setCompletedTasks] = useLocalStorage(
    "fst_completed",
    [],
  )
  const [deferredTasks, setDeferredTasks] = useLocalStorage("fst_deferred", [])
  const [presets, setPresets] = useLocalStorage("fst_presets", [])
  const [settings, setSettings] = useLocalStorage("fst_settings", {
    soundEnabled: false,
    autoStartNextTask: true,
    defaultTaskDuration: 25,
    showCompletedByDefault: false,
    matchMainPageStyle: false,
  })
  const [timerRunning, setTimerRunning] = useLocalStorage("fst_running", false)
  const [sessionSeconds, setSessionSeconds] = useLocalStorage("fst_session", 0)
  const [currentView, setCurrentView] = useLocalStorage("fst_view", "timer")
  const [theme, setTheme] = useLocalStorage("fst_theme", "dark")

  const [showAddForm, setShowAddForm] = useState(false)

  // First task is always the "current" active task tied to the timer
  const currentTask = activeTasks[0] ?? null
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  // One-time data normalization for older localStorage schemas.
  useEffect(() => {
    setActiveTasks((prev) => prev.map(normalizeTask))
    setDeferredTasks((prev) => prev.map(normalizeTask))
    setSettings((prev) => ({
      ...prev,
      defaultTaskDuration: clampMinutes(prev.defaultTaskDuration, 25),
      matchMainPageStyle: Boolean(prev.matchMainPageStyle),
    }))
  }, [setActiveTasks, setDeferredTasks, setSettings])

  // ── Timer tick ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerRunning) return
    const id = setInterval(() => {
      setActiveTasks((prev) => {
        if (!prev.length) return prev
        const [head, ...tail] = prev
        if (head.remainingSeconds <= 0) return prev
        return [
          {
            ...head,
            remainingSeconds: head.remainingSeconds - 1,
            spentSeconds: head.spentSeconds + 1,
          },
          ...tail,
        ]
      })
      setSessionSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [timerRunning])

  // ── Auto-complete when timer hits zero ───────────────────────────────────
  useEffect(() => {
    if (!timerRunning || !currentTask || currentTask.remainingSeconds > 0)
      return
    setTimerRunning(false)
    if (settingsRef.current.autoStartNextTask) {
      setTimeout(() => completeTask(currentTask.id), 50)
    }
  }, [currentTask?.remainingSeconds, timerRunning])

  // ── Task actions ─────────────────────────────────────────────────────────

  function completeTask(id) {
    const task = activeTasks.find((t) => t.id === id)
    if (!task) return
    setCompletedTasks((ct) => [
      ...ct,
      { ...task, completedAt: new Date().toISOString() },
    ])
    setActiveTasks((prev) => {
      const remaining = prev.filter((t) => t.id !== id)
      if (settingsRef.current.autoStartNextTask && remaining.length > 0)
        setTimerRunning(true)
      return remaining
    })
  }

  function deleteTask(id) {
    setActiveTasks((prev) => prev.filter((t) => t.id !== id))
  }

  function resetTask(id) {
    setActiveTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              estimatedMinutes: clampMinutes(t.estimatedMinutes, 25),
              remainingSeconds: clampSeconds(clampMinutes(t.estimatedMinutes, 25) * 60),
              spentSeconds: 0,
            }
          : t,
      ),
    )
  }

  function deferTask(id) {
    const task = activeTasks.find((t) => t.id === id)
    if (!task) return
    setDeferredTasks((dt) => [...dt, task])
    setActiveTasks((prev) => prev.filter((t) => t.id !== id))
  }

  function addTask(taskData) {
    const safeMinutes = clampMinutes(taskData.estimatedMinutes, settings.defaultTaskDuration)
    setActiveTasks((prev) => [...prev, createTask({ ...taskData, estimatedMinutes: safeMinutes })])
  }

  function adjustTime(seconds) {
    setActiveTasks((prev) => {
      if (!prev.length) return prev
      const [head, ...tail] = prev
      return [
        {
          ...head,
          remainingSeconds: clampSeconds(head.remainingSeconds + seconds),
        },
        ...tail,
      ]
    })
  }

  // ── Reordering ───────────────────────────────────────────────────────────

  function moveUp(id) {
    setActiveTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === id)
      if (idx <= 0) return prev
      const copy = [...prev]
      ;[copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]]
      return copy
    })
  }

  function moveDown(id) {
    setActiveTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === id)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const copy = [...prev]
      ;[copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]]
      return copy
    })
  }

  function moveToTop(id) {
    setActiveTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === id)
      if (idx <= 0) return prev
      const copy = [...prev]
      const [item] = copy.splice(idx, 1)
      return [item, ...copy]
    })
  }

  function moveToBottom(id) {
    setActiveTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === id)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const copy = [...prev]
      const [item] = copy.splice(idx, 1)
      return [...copy, item]
    })
  }

  function playTask(id) {
    setActiveTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === id)
      if (idx < 0) return prev
      if (idx === 0) return prev
      const copy = [...prev]
      const [item] = copy.splice(idx, 1)
      return [item, ...copy]
    })
    setCurrentView("timer")
    setTimerRunning(true)
  }

  function toggleTaskFlag(id, flagKey) {
    setActiveTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? {
              ...task,
              adhdFlags: {
                ...normalizeAdhdFlags(task.adhdFlags),
                [flagKey]: !normalizeAdhdFlags(task.adhdFlags)[flagKey],
              },
            }
          : task,
      ),
    )
  }

  // ── Quick actions ────────────────────────────────────────────────────────

  function emojiMe() {
    setActiveTasks((prev) => {
      if (!prev.length) return prev
      const [head, ...tail] = prev
      return [
        { ...head, emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)] },
        ...tail,
      ]
    })
  }

  function colorMe() {
    setActiveTasks((prev) => {
      if (!prev.length) return prev
      const [head, ...tail] = prev
      return [
        { ...head, color: COLORS[Math.floor(Math.random() * COLORS.length)] },
        ...tail,
      ]
    })
  }

  function randomTask() {
    setActiveTasks((prev) => {
      if (prev.length < 2) return prev
      const randIdx = Math.floor(Math.random() * (prev.length - 1)) + 1
      const copy = [...prev]
      const [picked] = copy.splice(randIdx, 1)
      return [picked, ...copy]
    })
  }

  function addOvertime(minutes = 5) {
    adjustTime(minutes * 60)
  }

  function clearActiveTasks() {
    if (!window.confirm("Clear all active tasks?")) return
    setActiveTasks([])
    setTimerRunning(false)
  }

  // ── Presets ──────────────────────────────────────────────────────────────

  function savePreset(name) {
    const newId = Math.random().toString(36).slice(2, 10)
    setPresets((prev) => [
      ...prev,
      { id: newId, name, tasks: activeTasks.map((t) => ({ ...t })) },
    ])
  }

  function loadPreset(presetId) {
    const preset = presets.find((p) => p.id === presetId)
    if (!preset) return
    setActiveTasks(
      preset.tasks.map((t) => ({
        ...t,
        id: Math.random().toString(36).slice(2, 10),
        estimatedMinutes: clampMinutes(t.estimatedMinutes, 25),
        remainingSeconds: clampSeconds(clampMinutes(t.estimatedMinutes, 25) * 60),
        spentSeconds: 0,
      })),
    )
    setTimerRunning(false)
    setCurrentView("timer")
  }

  function deletePreset(presetId) {
    setPresets((prev) => prev.filter((p) => p.id !== presetId))
  }

  // ── Deferred ─────────────────────────────────────────────────────────────

  function restoreDeferred(id) {
    const task = deferredTasks.find((t) => t.id === id)
    if (!task) return
    setActiveTasks((at) => [...at, task])
    setDeferredTasks((prev) => prev.filter((t) => t.id !== id))
  }

  function deleteDeferred(id) {
    setDeferredTasks((prev) => prev.filter((t) => t.id !== id))
  }

  // ── Computed ─────────────────────────────────────────────────────────────

  const totalRemainingSeconds = activeTasks.reduce(
    (sum, t) => sum + t.remainingSeconds,
    0,
  )
  const projectedEndTime = new Date(Date.now() + totalRemainingSeconds * 1000)

  const taskProps = {
    activeTasks,
    completedTasks,
    settings,
    completeTask,
    deleteTask,
    resetTask,
    deferTask,
    adjustTime,
    moveUp,
    moveDown,
    moveToTop,
    moveToBottom,
    playTask,
    toggleTaskFlag,
    currentTaskId: currentTask?.id,
    timerRunning,
    emojiMe,
    colorMe,
    randomTask,
    addOvertime,
    clearActiveTasks,
    showAddForm,
    setShowAddForm,
  }

  return (
    <div className={`timer-app timer-app--${theme} ${settings.matchMainPageStyle ? "timer-app--main-style" : ""}`}>
      <TopBar
        sessionSeconds={sessionSeconds}
        projectedEndTime={projectedEndTime}
        settings={settings}
        setSettings={setSettings}
        theme={theme}
        setTheme={setTheme}
      />
      <div className="timer-main">
        {currentView === "timer" && (
          <>
            <TimerPanel
              currentTask={currentTask}
              timerRunning={timerRunning}
              setTimerRunning={setTimerRunning}
              adjustTime={adjustTime}
            />
            <TaskList {...taskProps} />
          </>
        )}
        {currentView === "not-now" && (
          <DeferredTasksPanel
            deferredTasks={deferredTasks}
            restoreDeferred={restoreDeferred}
            deleteDeferred={deleteDeferred}
          />
        )}
        {currentView === "report" && (
          <ReportView
            activeTasks={activeTasks}
            completedTasks={completedTasks}
            deferredTasks={deferredTasks}
            sessionSeconds={sessionSeconds}
          />
        )}
        {currentView === "presets" && (
          <PresetsView
            presets={presets}
            savePreset={savePreset}
            loadPreset={loadPreset}
            deletePreset={deletePreset}
          />
        )}
        {currentView === "settings" && (
          <SettingsView settings={settings} setSettings={setSettings} />
        )}
      </div>

      {showAddForm && (
        <AddTaskForm
          onAdd={addTask}
          onClose={() => setShowAddForm(false)}
          defaultDuration={settings.defaultTaskDuration}
        />
      )}

      <BottomNav currentView={currentView} setCurrentView={setCurrentView} />
    </div>
  )
}
