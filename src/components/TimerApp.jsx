import { useState, useEffect, useRef } from "react"
import { useLocalStorage } from "../hooks/useLocalStorage"
import { nowISO, secondsSince } from "../utils/timeUtils"
import { initStorageIfNew, COLORS } from "../data/seedData"
import confetti from "canvas-confetti"
import TopBar from "./TopBar"
import TimerPanel from "./TimerPanel"
import TaskList from "./TaskList"
import AddTaskForm from "./AddTaskForm"
import DeferredTasksPanel from "./DeferredTasksPanel"
import ReportView from "./ReportView"
import PresetsView from "./PresetsView"
import SettingsView from "./SettingsView"
import BottomNav from "./BottomNav"
import SidebarTaskSteps from "./SidebarTaskSteps"
import BreakOverlay from "./BreakOverlay"
import { TimerProvider } from "../context/TimerContext"
import { useMainTask } from "../context/MainTaskContext"
import "../timer.css"
import { playAlarmOnce } from "../utils/alarm"
import { parseStepRaw, formatStepRaw } from "../utils/stepUtils"
import {
  addTrackFromFile,
  deleteTrack,
  getTrack,
  listTracks,
} from "../utils/musicStore"
import { playClickSound, playCompletionSound } from "../utils/soundEffects"

// Seed localStorage exactly once – never re-seeds after user clears tasks
initStorageIfNew()

const MAX_TASK_SECONDS = 60 * 60
const DEFAULT_TASK_DURATION = 2
const DEFAULT_MUSIC_VOLUME = 1
const DEFAULT_SETTINGS = {
  soundEnabled: false,
  autoStartNextTask: true,
  autoScrollOnAlarm: true,
  defaultTaskDuration: DEFAULT_TASK_DURATION,
  showCompletedByDefault: false,
  matchMainPageStyle: true,
  alarmMode: "nag",
  idlePromptSeconds: 30,
  pomodoroEnabled: true,
  pomodoroWorkMinutes: 20,
  pomodoroBreakMinutes: 5,
}

function clampMinutes(value, fallback = DEFAULT_TASK_DURATION) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return fallback
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
  const estimatedMinutes = clampMinutes(
    task.estimatedMinutes,
    DEFAULT_TASK_DURATION,
  )
  const fallbackRemaining = estimatedMinutes * 60
  return {
    ...task,
    estimatedMinutes,
    remainingSeconds: clampSeconds(task.remainingSeconds ?? fallbackRemaining),
    spentSeconds: Math.max(0, Number(task.spentSeconds) || 0),
    adhdFlags: normalizeAdhdFlags(task.adhdFlags),
  }
}

function pickNextColor(currentColor) {
  if (COLORS.length <= 1) return COLORS[0] || currentColor || "#10b981"

  let nextColor = currentColor
  for (
    let attempt = 0;
    attempt < 4 && nextColor === currentColor;
    attempt += 1
  ) {
    nextColor = COLORS[Math.floor(Math.random() * COLORS.length)]
  }

  if (nextColor !== currentColor) return nextColor

  const currentIndex = COLORS.indexOf(currentColor)
  if (currentIndex >= 0) {
    return COLORS[(currentIndex + 1) % COLORS.length]
  }

  return COLORS[0]
}

export default function TimerApp({ sidebarMode = false }) {
  const {
    mainTasks,
    activeMainTaskId,
    activateMainTask,
    deleteMainTask,
    queuedSteps,
    updateStepTimer,
    resetStepTimer,
    addMainTaskAndActivate,
    setStepCompleted,
    incrementTries,
    incrementStepTries,
    updateMainTask,
    reorderMainTask,
    reorderMainTaskStep,
    playRequested,
    clearPlayRequest,
    triggerFocusFlash,
  } = useMainTask()

  const mountedRef = useRef(false)

  // All defaults are [] / {} because initStorageIfNew already populated localStorage
  const [completedTasks, setCompletedTasks] = useLocalStorage(
    "fst_completed",
    [],
  )
  const [deletedTasks, setDeletedTasks] = useLocalStorage(
    "fst_deleted_active",
    [],
  )
  const [deferredTasks, setDeferredTasks] = useLocalStorage("fst_deferred", [])
  const [presets, setPresets] = useLocalStorage("fst_presets", [])
  const [settings, setSettings] = useLocalStorage(
    "fst_settings",
    DEFAULT_SETTINGS,
  )
  const [timerRunning, setTimerRunning] = useLocalStorage("fst_running", false)
  const [sessionSeconds, setSessionSeconds] = useLocalStorage("fst_session", 0)
  const [currentView, setCurrentView] = useLocalStorage("fst_view", "timer")
  const [theme, setTheme] = useLocalStorage("fst_theme", "dark")
  const [musicVolume, setMusicVolume] = useLocalStorage(
    "fst_music_volume",
    DEFAULT_MUSIC_VOLUME,
  )
  const [musicLoop, setMusicLoop] = useLocalStorage("fst_music_loop", true)
  const [musicMuted, setMusicMuted] = useLocalStorage("fst_music_muted", false)
  const [selectedTrackId, setSelectedTrackId] = useLocalStorage(
    "fst_music_selected_track",
    "",
  )

  const [showAddForm, setShowAddForm] = useState(false)
  const [alarmActive, setAlarmActive] = useState(false)
  const [idleInputText, setIdleInputText] = useState("")
  // null = timer running (idle inactive); number = countdown value (≥ 0)
  const [idleCountdown, setIdleCountdown] = useState(null)
  const [uploadedTracks, setUploadedTracks] = useState([])
  const [musicUiMessage, setMusicUiMessage] = useState("")
  const [audioBlockedMessage, setAudioBlockedMessage] = useState("")
  const [previewTrackId, setPreviewTrackId] = useState("")

  // ── Pomodoro state ───────────────────────────────────────────────────────
  // Timestamps stored as ISO instants via Temporal — survives refresh, no drift.
  const [pomoWorkStart, setPomodoroWorkStart] = useLocalStorage(
    "fst_pomo_work_start",
    null,
  )
  const [breakStartISO, setBreakStartISO] = useLocalStorage(
    "fst_pomo_break_start",
    null,
  )
  const [onBreak, setOnBreak] = useState(false)
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(0)
  const pomoEnabled = Boolean(settings.pomodoroEnabled)
  const pomoWorkDuration = (settings.pomodoroWorkMinutes || 20) * 60
  const pomoBreakDuration = (settings.pomodoroBreakMinutes || 5) * 60
  const alarmIntervalRef = useRef(null)
  // Wall-clock anchor for drift-free timer: { startedAt: ms, startingRemaining: s, headId: string }
  const timerEpochRef = useRef(null)
  const taskMusicRef = useRef(null)
  const taskMusicUrlRef = useRef("")
  const previewAudioRef = useRef(null)
  const previewUrlRef = useRef("")
  const confettiTimerRef = useRef(null)
  const colorFrameRef = useRef(0)
  const lastConfettiAtRef = useRef(0)
  const lastTryIncrementKeyRef = useRef("")
  // Refs so effects can read latest values without stale-closure issues
  const triggerFocusFlashRef = useRef(triggerFocusFlash)
  triggerFocusFlashRef.current = triggerFocusFlash
  const queuedStepsRef = useRef(queuedSteps)
  queuedStepsRef.current = queuedSteps
  const prevCurrentTaskIdRef = useRef(null)

  // ── Derived timer queue ────────────────────────────────────────────────────────
  // activeTasks is derived from queuedSteps (MainTaskContext is source of truth).
  // deferredStepIds are step IDs the user has "not now"-ed from the timer queue;
  // those steps remain in mainTasks but are temporarily hidden from the queue.
  const [deferredStepIds, setDeferredStepIds] = useLocalStorage(
    "fst_deferred_step_ids",
    [],
  )
  const deferredStepIdSet = new Set(deferredStepIds)

  function toTimerTask(entry) {
    const parsed = parseStepRaw(entry.step.raw)
    return {
      id: entry.step.id,
      title: parsed.text || entry.step.raw || "Step",
      estimatedMinutes: Math.max(1, parsed.minutes || 2),
      remainingSeconds: entry.remainingSeconds,
      spentSeconds: entry.spentSeconds,
      color: entry.mainTask.color,
      sourceMainTaskId: entry.mainTask.id,
      sourceStepId: entry.step.id,
      sourceMainTaskTitle: entry.mainTask.title,
      stepDepth: entry.depth,
      emoji: "\u2705",
      adhdFlags: {},
    }
  }

  const activeTasks = queuedSteps
    .filter((e) => !deferredStepIdSet.has(e.step.id))
    .map(toTimerTask)

  // First task is always the "current" active task tied to the timer
  const currentTask = activeTasks[0] ?? null
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  if (!taskMusicRef.current && typeof Audio !== "undefined") {
    taskMusicRef.current = new Audio()
    taskMusicRef.current.preload = "auto"
  }

  // One-time data normalization for older localStorage schemas.
  // Also reset timerRunning on first mount — prevents ghost timers from persisted state.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      setTimerRunning(false)
    }
    setDeletedTasks((prev) => prev.map(normalizeTask))
    setDeferredTasks((prev) => prev.map(normalizeTask))
    setSettings((prev) => ({
      ...DEFAULT_SETTINGS,
      ...prev,
      defaultTaskDuration: clampMinutes(
        prev.defaultTaskDuration,
        DEFAULT_TASK_DURATION,
      ),
      matchMainPageStyle: prev.matchMainPageStyle ?? true,
      autoScrollOnAlarm: prev.autoScrollOnAlarm ?? true,
      alarmMode: prev.alarmMode ?? "nag",
      pomodoroEnabled: prev.pomodoroEnabled ?? true,
      pomodoroWorkMinutes: Math.max(
        1,
        Math.min(120, Number(prev.pomodoroWorkMinutes) || 20),
      ),
      pomodoroBreakMinutes: Math.max(
        1,
        Math.min(30, Number(prev.pomodoroBreakMinutes) || 5),
      ),
    }))
    setMusicVolume((prev) => {
      const n = Number(prev)
      if (!Number.isFinite(n)) return DEFAULT_MUSIC_VOLUME
      return Math.max(0, Math.min(1, n))
    })
  }, [
    setDeletedTasks,
    setDeferredTasks,
    setMusicVolume,
    setSettings,
    setTimerRunning,
  ])

  function scrollToElement(
    selector,
    options = { behavior: "smooth", block: "center" },
  ) {
    if (typeof document === "undefined") return false
    const el = document.querySelector(selector)
    if (!el) return false
    el.scrollIntoView(options)
    return true
  }

  function focusAlarmTarget(task) {
    if (!task?.sourceMainTaskId) return
    setCurrentView("timer")
    activateMainTask(task.sourceMainTaskId)

    const stepSelector = task.sourceStepId
      ? `[data-main-step-id="${task.sourceStepId}"]`
      : ""
    const mainTaskSelector = `[data-main-task-id="${task.sourceMainTaskId}"]`
    const timerTaskSelector = `[data-task-id="${task.id}"]`

    let attempts = 0
    const maxAttempts = 8

    const runFocus = () => {
      attempts += 1
      const foundTimerTask = scrollToElement(timerTaskSelector, {
        behavior: "smooth",
        block: "nearest",
      })
      const foundMainTask = scrollToElement(mainTaskSelector)
      const foundStep = stepSelector ? scrollToElement(stepSelector) : true

      const done = foundMainTask && foundStep && foundTimerTask
      if (done || attempts >= maxAttempts) return
      window.setTimeout(runFocus, 120)
    }

    window.setTimeout(runFocus, 20)
  }

  // Effects A, B, C removed — activeTasks is now derived from queuedSteps (MainTaskContext).

  // Autostart hook for builder play: if a newly created main task is marked
  // in localStorage, start the timer as soon as its first synced timer task
  // is at the head of the queue.
  useEffect(() => {
    if (!activeMainTaskId || onBreak) return
    try {
      const intentId = window.localStorage.getItem("fst_autostart_main_task")
      if (!intentId || intentId !== activeMainTaskId) return
      const head = queuedSteps[0]
      if (!head || head.mainTask.id !== activeMainTaskId) return
      if (head.remainingSeconds <= 0) return
      if (!timerRunning) setTimerRunning(true)
      window.localStorage.removeItem("fst_autostart_main_task")
    } catch {
      // no-op
    }
  }, [activeMainTaskId, queuedSteps, timerRunning, onBreak, setTimerRunning])

  // ── Consume play requests from MainTaskCard (direct context state, no poll) ──
  useEffect(() => {
    if (!playRequested) return
    const { mainTaskId } = playRequested
    clearPlayRequest()
    activateMainTask(mainTaskId)
    setCurrentView("timer")
    setTimerRunning(true)
    // Highlight the first queued step of the activated task
    const firstEntry = queuedStepsRef.current.find(
      (e) => e.mainTask.id === mainTaskId,
    )
    triggerFocusFlashRef.current(mainTaskId, firstEntry?.step?.id ?? null)
  }, [
    playRequested,
    clearPlayRequest,
    activateMainTask,
    setCurrentView,
    setTimerRunning,
  ])

  // ── Highlight active step in MainTaskCard when the timer queue advances ──────
  // Fires whenever currentTask changes to a new step (completion, navigation).
  useEffect(() => {
    const newId = currentTask?.id ?? null
    if (!newId || newId === prevCurrentTaskIdRef.current) {
      prevCurrentTaskIdRef.current = newId
      return
    }
    prevCurrentTaskIdRef.current = newId
    if (currentTask?.sourceMainTaskId && currentTask?.sourceStepId) {
      triggerFocusFlashRef.current(
        currentTask.sourceMainTaskId,
        currentTask.sourceStepId,
      )
    }
  }, [
    currentTask?.id,
    currentTask?.sourceMainTaskId,
    currentTask?.sourceStepId,
  ])

  // ── Consume fst_stop_alarm signal from the builder ───────────────────────
  // The builder lives outside TimerProvider so it can't call stopAlarm() directly.
  // It writes "fst_stop_alarm" to localStorage; we poll and consume it here.
  useEffect(() => {
    const id = setInterval(() => {
      try {
        if (window.localStorage.getItem("fst_stop_alarm") === "1") {
          window.localStorage.removeItem("fst_stop_alarm")
          setAlarmActive(false)
          clearInterval(alarmIntervalRef.current)
          alarmIntervalRef.current = null
        }
      } catch {}
    }, 300)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Idle prompt: show quick-add after X seconds of timer not running ──────
  useEffect(() => {
    if (timerRunning || onBreak) {
      setIdleCountdown(null)
      return
    }
    // Start countdown when timer stops
    const delay = Math.max(5, Number(settings.idlePromptSeconds) || 30)
    setIdleCountdown(delay)
    const id = setInterval(() => {
      setIdleCountdown((prev) => (prev === null ? null : Math.max(0, prev - 1)))
    }, 1000)
    return () => clearInterval(id)
  }, [timerRunning, onBreak, settings.idlePromptSeconds])

  // ── Timer tick (wall-clock anchored — no drift, head-change safe) ───────
  useEffect(() => {
    if (!timerRunning || onBreak) return
    // Re-anchor whenever the current head task changes so the interval can't
    // stay pinned to an old head and appear frozen.
    const head = activeTasks[0] ?? null
    if (!head || head.remainingSeconds <= 0) return
    timerEpochRef.current = {
      startedAt: Date.now(),
      startingRemaining: head.remainingSeconds,
      startingSpent: head.spentSeconds,
      headId: head.id, // head.id === step.id in the new model
    }
    const id = setInterval(() => {
      const epoch = timerEpochRef.current
      if (!epoch) return
      const elapsedSecs = Math.floor((Date.now() - epoch.startedAt) / 1000)
      // Write time back to context (source of truth for step timers)
      if (currentTask?.id === epoch.headId) {
        const remaining = Math.max(0, epoch.startingRemaining - elapsedSecs)
        const spent = epoch.startingSpent + elapsedSecs
        if (remaining !== currentTask.remainingSeconds) {
          updateStepTimer(epoch.headId, {
            remainingSeconds: remaining,
            spentSeconds: spent,
          })
        }
      }
      setSessionSeconds(epoch.startingSpent + elapsedSecs)
    }, 500)
    return () => {
      clearInterval(id)
      timerEpochRef.current = null
    }
  }, [timerRunning, onBreak, currentTask?.id])

  // ── Pomodoro: start work session timestamp when timer starts ─────────────
  useEffect(() => {
    if (!pomoEnabled || !timerRunning || onBreak) return
    // If no work session is running, stamp the start time now
    if (!pomoWorkStart) {
      setPomodoroWorkStart(nowISO())
    }
  }, [pomoEnabled, timerRunning, onBreak, pomoWorkStart, setPomodoroWorkStart])

  // ── Pomodoro: check if work session exceeded ─────────────────────────────
  // NOTE: intentionally no timerRunning guard — the pomo clock is wall-time
  // based (secondsSince) and must keep running even when a task timer stops.
  useEffect(() => {
    if (!pomoEnabled || onBreak || !pomoWorkStart) return
    const id = setInterval(() => {
      const elapsed = secondsSince(pomoWorkStart)
      if (elapsed >= pomoWorkDuration) {
        setOnBreak(true)
        setBreakStartISO(nowISO())
        setPomodoroWorkStart(null)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [
    pomoEnabled,
    onBreak,
    pomoWorkStart,
    pomoWorkDuration,
    setBreakStartISO,
    setPomodoroWorkStart,
  ])

  // ── Break countdown (Temporal-based) ─────────────────────────────────────
  useEffect(() => {
    if (!onBreak || !breakStartISO) return
    function tick() {
      const elapsed = secondsSince(breakStartISO)
      const remaining = Math.max(0, pomoBreakDuration - elapsed)
      setBreakSecondsLeft(remaining)
      if (remaining <= 0) {
        setOnBreak(false)
        setBreakStartISO(null)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [onBreak, breakStartISO, pomoBreakDuration, setBreakStartISO])

  // ── Restore break state on mount (survives refresh) ──────────────────────
  useEffect(() => {
    if (!breakStartISO) return
    const elapsed = secondsSince(breakStartISO)
    const remaining = pomoBreakDuration - elapsed
    if (remaining > 0) {
      setOnBreak(true)
      setBreakSecondsLeft(remaining)
    } else {
      setBreakStartISO(null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stop timer when there are no active tasks ────────────────────────────
  useEffect(() => {
    if (activeTasks.length === 0) {
      if (timerRunning && !pomoEnabled) {
        setTimerRunning(false)
      }
      setSessionSeconds(0)
      if (!pomoEnabled) {
        setPomodoroWorkStart(null)
        setBreakStartISO(null)
        setOnBreak(false)
      }
    }
  }, [
    activeTasks.length,
    timerRunning,
    pomoEnabled,
    setTimerRunning,
    setSessionSeconds,
    setPomodoroWorkStart,
    setBreakStartISO,
  ])

  // ── Alarm ────────────────────────────────────────────────────────────────
  function triggerAlarm() {
    const mode = settingsRef.current.alarmMode ?? "silent"
    setAlarmActive(true)

    if (settingsRef.current.autoScrollOnAlarm !== false && currentTask) {
      focusAlarmTarget(currentTask)
    }

    clearInterval(alarmIntervalRef.current)
    if (mode === "silent") return
    playAlarmOnce()
    if (mode === "nag") {
      alarmIntervalRef.current = setInterval(playAlarmOnce, 60_000)
    } else if (mode === "continuous") {
      alarmIntervalRef.current = setInterval(playAlarmOnce, 2_500)
    }
  }

  function stopAlarm() {
    setAlarmActive(false)
    clearInterval(alarmIntervalRef.current)
    alarmIntervalRef.current = null
  }

  // ── Auto-complete when timer hits zero ───────────────────────────────────
  useEffect(() => {
    if (!timerRunning || !currentTask || currentTask.remainingSeconds > 0)
      return

    if (currentTask.sourceMainTaskId) {
      const key = `${currentTask.sourceMainTaskId}:${currentTask.id}:${currentTask.remainingSeconds}`
      if (lastTryIncrementKeyRef.current !== key) {
        incrementTries(currentTask.sourceMainTaskId)
        if (currentTask.sourceStepId) {
          incrementStepTries(
            currentTask.sourceMainTaskId,
            currentTask.sourceStepId,
          )
        }
        lastTryIncrementKeyRef.current = key
      }
    }

    setTimerRunning(false)
    triggerAlarm()
  }, [
    currentTask?.remainingSeconds,
    currentTask?.id,
    currentTask?.sourceMainTaskId,
    currentTask?.sourceStepId,
    incrementTries,
    incrementStepTries,
    timerRunning,
  ])

  // ── Auto-dismiss alarm when timer restarts ───────────────────────────────
  useEffect(() => {
    if (!timerRunning) return
    setAlarmActive(false)
    clearInterval(alarmIntervalRef.current)
    alarmIntervalRef.current = null
  }, [timerRunning])

  // ── Music persistence and playback ───────────────────────────────────────
  useEffect(() => {
    let alive = true
    listTracks()
      .then((tracks) => {
        if (!alive) return
        setUploadedTracks(tracks)
      })
      .catch((err) => {
        console.error("Failed to load tracks", err)
        if (alive)
          setMusicUiMessage("Could not load saved tracks from IndexedDB.")
      })

    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (colorFrameRef.current && typeof window !== "undefined") {
        window.cancelAnimationFrame(colorFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const audio = taskMusicRef.current
    if (!audio) return
    audio.volume = Math.max(0, Math.min(1, Number(musicVolume) || 0))
    audio.loop = Boolean(musicLoop)
    audio.muted = Boolean(musicMuted)
    // Keep preview volume in sync with the same slider
    if (previewAudioRef.current) {
      previewAudioRef.current.volume = Math.max(
        0,
        Math.min(1, Number(musicVolume) || 0),
      )
    }
  }, [musicVolume, musicLoop, musicMuted])

  useEffect(() => {
    if (!uploadedTracks.length) {
      if (selectedTrackId) setSelectedTrackId("")
      return
    }
    if (!selectedTrackId) {
      setSelectedTrackId(uploadedTracks[0].id)
      return
    }
    const found = uploadedTracks.some((t) => t.id === selectedTrackId)
    if (!found) {
      setSelectedTrackId(uploadedTracks[0]?.id ?? "")
    }
  }, [uploadedTracks, selectedTrackId, setSelectedTrackId])

  useEffect(() => {
    let cancelled = false

    async function loadSelectedTrack() {
      const audio = taskMusicRef.current
      if (!audio) return

      if (taskMusicUrlRef.current) {
        URL.revokeObjectURL(taskMusicUrlRef.current)
        taskMusicUrlRef.current = ""
      }

      audio.pause()
      audio.removeAttribute("src")
      audio.load()

      if (!selectedTrackId) return

      const row = await getTrack(selectedTrackId)
      if (!row || !row.blob || cancelled) return

      const url = URL.createObjectURL(row.blob)
      taskMusicUrlRef.current = url
      audio.src = url
      audio.currentTime = 0
    }

    loadSelectedTrack().catch((err) => {
      console.error("Failed to load selected track", err)
      setMusicUiMessage("Failed to load selected music track.")
    })

    return () => {
      cancelled = true
    }
  }, [selectedTrackId])

  useEffect(() => {
    const audio = taskMusicRef.current
    if (!audio) return

    const shouldPlay = Boolean(timerRunning && currentTask && selectedTrackId)
    if (!shouldPlay) {
      audio.pause()
      return
    }

    if (previewAudioRef.current && !previewAudioRef.current.paused) {
      previewAudioRef.current.pause()
      setPreviewTrackId("")
    }

    if (audio.paused) {
      audio
        .play()
        .then(() => setAudioBlockedMessage(""))
        .catch(() => {
          setAudioBlockedMessage(
            "Browser blocked autoplay. Press play once in Music Settings to enable audio.",
          )
        })
    }
  }, [timerRunning, currentTask?.id, selectedTrackId, previewTrackId])

  useEffect(() => {
    return () => {
      clearInterval(alarmIntervalRef.current)
      clearTimeout(confettiTimerRef.current)
      if (taskMusicRef.current) {
        taskMusicRef.current.pause()
        taskMusicRef.current.removeAttribute("src")
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current.removeAttribute("src")
      }
      if (taskMusicUrlRef.current) URL.revokeObjectURL(taskMusicUrlRef.current)
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  function triggerCelebration() {
    const now = Date.now()
    const delta = now - lastConfettiAtRef.current
    const run = () => {
      confetti({
        particleCount: 55,
        spread: 65,
        startVelocity: 34,
        origin: { y: 0.72 },
      })
      lastConfettiAtRef.current = Date.now()
    }
    if (delta < 220) {
      clearTimeout(confettiTimerRef.current)
      confettiTimerRef.current = setTimeout(run, 220 - delta)
      return
    }
    run()
  }

  function refreshTracks() {
    return listTracks().then((tracks) => {
      setUploadedTracks(tracks)
      return tracks
    })
  }

  function isSupportedAudioFile(file) {
    const validMime = /^audio\//.test(file.type || "")
    const validExt = /\.(mp3|wav|ogg|m4a)$/i.test(file.name || "")
    return validMime || validExt
  }

  async function handleMusicUpload(files) {
    const picked = Array.from(files || [])
    if (!picked.length) return

    const valid = picked.filter(isSupportedAudioFile)
    const invalidCount = picked.length - valid.length

    if (!valid.length) {
      setMusicUiMessage(
        "No supported audio files selected. Use mp3, wav, ogg, or m4a.",
      )
      return
    }

    for (const file of valid) {
      await addTrackFromFile(file)
    }

    const tracks = await refreshTracks()
    if (!selectedTrackId && tracks.length) {
      setSelectedTrackId(tracks[tracks.length - 1].id)
    }

    const invalidHint =
      invalidCount > 0 ? ` ${invalidCount} unsupported file(s) skipped.` : ""
    setMusicUiMessage(`Uploaded ${valid.length} track(s).${invalidHint}`)
  }

  async function handleDeleteTrack(trackId) {
    if (previewTrackId === trackId && previewAudioRef.current) {
      previewAudioRef.current.pause()
      setPreviewTrackId("")
    }
    await deleteTrack(trackId)
    const tracks = await refreshTracks()
    if (selectedTrackId === trackId) {
      setSelectedTrackId(tracks[0]?.id ?? "")
    }
    setMusicUiMessage("Track removed.")
  }

  function toggleMusicPlaybackFromUI() {
    const audio = taskMusicRef.current
    if (!audio) return
    playClickSound(musicVolume)
    if (audio.paused) {
      audio
        .play()
        .then(() => {
          setAudioBlockedMessage("")
          if (!timerRunning && currentTask) setTimerRunning(true)
        })
        .catch(() => {
          setAudioBlockedMessage(
            "Browser blocked autoplay. Press this play button once to enable audio.",
          )
        })
    } else {
      audio.pause()
      if (timerRunning) setTimerRunning(false)
    }
  }

  async function previewTrack(trackId) {
    const track = uploadedTracks.find((t) => t.id === trackId)
    if (!track) return

    if (
      previewTrackId === trackId &&
      previewAudioRef.current &&
      !previewAudioRef.current.paused
    ) {
      previewAudioRef.current.pause()
      setPreviewTrackId("")
      return
    }

    const row = await getTrack(trackId)
    if (!row?.blob) return

    if (!previewAudioRef.current && typeof Audio !== "undefined") {
      previewAudioRef.current = new Audio()
    }
    const preview = previewAudioRef.current
    const bg = taskMusicRef.current
    if (!preview || !bg) return

    preview.pause()
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)

    if (!bg.paused) bg.pause()

    previewUrlRef.current = URL.createObjectURL(row.blob)
    preview.src = previewUrlRef.current
    preview.volume = Math.max(0, Math.min(1, Number(musicVolume) || 0))
    preview.muted = Boolean(musicMuted)
    preview.loop = false

    preview.onended = () => setPreviewTrackId("")

    preview
      .play()
      .then(() => setPreviewTrackId(trackId))
      .catch(() => {
        setAudioBlockedMessage(
          "Preview was blocked. Press play once to enable audio.",
        )
      })
  }

  function toggleTimerWithClick() {
    if (!currentTask) return

    // If user resumes from the alarm state, count it as a retry attempt.
    if (alarmActive && currentTask.sourceMainTaskId) {
      incrementTries(currentTask.sourceMainTaskId)
      if (currentTask.sourceStepId) {
        incrementStepTries(
          currentTask.sourceMainTaskId,
          currentTask.sourceStepId,
        )
      }
    }

    setTimerRunning((running) => !running)
  }

  // ── Task actions ─────────────────────────────────────────────────────────

  function completeTask(id) {
    stopAlarm()
    const task = activeTasks.find((t) => t.id === id)
    if (!task) return

    if (task.sourceMainTaskId && task.sourceStepId) {
      setStepCompleted(task.sourceMainTaskId, task.sourceStepId, true)
      // Clear the step timer on completion so it doesn't accumulate stale data
      resetStepTimer(task.sourceStepId, task.estimatedMinutes)
    }

    playCompletionSound(musicVolume)
    triggerCelebration()
    setCompletedTasks((ct) => [
      ...ct,
      { ...task, completedAt: new Date().toISOString() },
    ])
    // Auto-start next: activeTasks is re-derived after setStepCompleted, so
    // just check that there will be more steps (activeTasks.length > 1)
    if (settingsRef.current.autoStartNextTask && activeTasks.length > 1) {
      setTimerRunning(true)
    }
  }

  function restoreCompletedTask(id) {
    const task = completedTasks.find((t) => t.id === id)
    if (!task) return

    if (task.sourceMainTaskId && task.sourceStepId) {
      setStepCompleted(task.sourceMainTaskId, task.sourceStepId, false)
      // Restore step timer to estimated time
      const mins = clampMinutes(
        task.estimatedMinutes,
        settings.defaultTaskDuration,
      )
      resetStepTimer(task.sourceStepId, mins)
    }

    setCompletedTasks((prev) => prev.filter((t) => t.id !== id))
    setCurrentView("timer")
  }

  function softDeleteTask(id) {
    stopAlarm()
    const task = activeTasks.find((t) => t.id === id)
    if (!task) return

    // Bug fix: delete the whole main task (not just one step) so the queue
    // and main task list stay in sync.
    if (task.sourceMainTaskId) {
      deleteMainTask(task.sourceMainTaskId)
      return
    }

    setDeletedTasks((prev) => [
      ...prev,
      { ...task, deletedAt: new Date().toISOString() },
    ])
  }

  function undoDeleteTask(id) {
    const task = deletedTasks.find((t) => t.id === id)
    if (!task) return
    setDeletedTasks((prev) => prev.filter((t) => t.id !== id))
    setCurrentView("timer")
  }

  function clearDeletedTasks() {
    setDeletedTasks([])
  }

  function resetTask(id) {
    const task = activeTasks.find((t) => t.id === id)
    if (!task) return

    if (task.sourceMainTaskId) {
      incrementTries(task.sourceMainTaskId)
      if (task.sourceStepId) {
        incrementStepTries(task.sourceMainTaskId, task.sourceStepId)
      }
    }

    const newRemaining = clampSeconds(
      clampMinutes(task.estimatedMinutes, DEFAULT_TASK_DURATION) * 60,
    )
    // Reset timer in context (source of truth)
    resetStepTimer(task.id, task.estimatedMinutes)
    // Re-anchor epoch so the wall-clock tick uses the reset value
    if (timerEpochRef.current?.headId === id) {
      timerEpochRef.current = {
        startedAt: Date.now(),
        startingRemaining: newRemaining,
        startingSpent: 0,
        headId: id,
      }
    }
  }

  function deferTask(id) {
    const task = activeTasks.find((t) => t.id === id)
    if (!task) return
    // Add step ID to the hidden set so it doesn't appear in the derived queue
    setDeferredStepIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setDeferredTasks((dt) => [
      ...dt,
      { ...task, deferredAt: new Date().toISOString() },
    ])
  }

  function addTask(taskData) {
    const toAdd = Array.isArray(taskData) ? taskData : [taskData]
    if (toAdd.some((d) => !d.sourceMainTaskId)) {
      // Create a main task with each item as a step, then activate it.
      // The sync effect will generate the corresponding timer tasks.
      const steps = toAdd.map((d) => {
        // Parse trailing number from title: "example task 3" → text="example task", minutes=3
        const parsed = parseStepRaw(d.title || "New Task")
        const mins =
          parsed.minutes > 0
            ? parsed.minutes
            : clampMinutes(d.estimatedMinutes, settings.defaultTaskDuration)
        return {
          raw: formatStepRaw(parsed.text || d.title || "New Task", mins),
        }
      })
      const firstParsed = parseStepRaw(toAdd[0].title || "New Task")
      const title =
        toAdd.length === 1
          ? firstParsed.text || toAdd[0].title || "New Task"
          : `${toAdd.length} tasks`
      addMainTaskAndActivate({ title, steps })
      return
    }
    // Tasks already linked to a main task: addTask is only called from AddTaskForm
    // which always creates a main task. The direct setActiveTasks path is removed.
    addMainTaskAndActivate({ title: "New Task", steps: [] })
  }

  function handleIdleAdd() {
    const text = idleInputText.trim()
    if (!text) return
    // Parse trailing number so "inbox 5" becomes a 5-minute task
    const parsed = parseStepRaw(text)
    const mins =
      parsed.minutes > 0 ? parsed.minutes : settings.defaultTaskDuration
    const created = addMainTaskAndActivate({
      title: parsed.text || text,
      steps: [{ raw: formatStepRaw(parsed.text || text, mins) }],
    })
    // Write autostart intent; the existing useEffect consumes it once the
    // task is synced to activeTasks — avoids setTimerRunning before queue ready.
    if (created?.id) {
      window.localStorage.setItem("fst_autostart_main_task", created.id)
    }
    setIdleInputText("")
  }

  function adjustTime(seconds) {
    if (!currentTask) return
    const newRemaining = clampSeconds(currentTask.remainingSeconds + seconds)
    // Re-anchor epoch so the wall-clock tick uses the adjusted value
    if (timerEpochRef.current?.headId === currentTask.id) {
      timerEpochRef.current = {
        startedAt: Date.now(),
        startingRemaining: newRemaining,
        startingSpent: currentTask.spentSeconds,
        headId: currentTask.id,
      }
    }
    updateStepTimer(currentTask.id, {
      remainingSeconds: newRemaining,
      spentSeconds: currentTask.spentSeconds,
    })
  }

  // ── Reordering ───────────────────────────────────────────────────────────
  // All reordering goes through MainTaskContext (source of truth).
  // activeTasks is derived, so calling context reorder ops causes a re-render.

  function syncLinkedQueueMove(dragId, targetId, zone) {
    if (!dragId || !targetId || dragId === targetId) return
    const fromTask = activeTasks.find((t) => t.id === dragId)
    const toTask = activeTasks.find((t) => t.id === targetId)
    if (!fromTask?.sourceMainTaskId || !toTask?.sourceMainTaskId) return

    if (toTask.sourceMainTaskId === fromTask.sourceMainTaskId) {
      reorderMainTaskStep(
        fromTask.sourceMainTaskId,
        fromTask.sourceStepId,
        toTask.sourceStepId,
        zone,
      )
    } else {
      reorderMainTask(fromTask.sourceMainTaskId, toTask.sourceMainTaskId)
    }
  }

  function moveUp(id) {
    const idx = activeTasks.findIndex((t) => t.id === id)
    if (idx <= 0) return
    syncLinkedQueueMove(id, activeTasks[idx - 1].id, "before")
  }

  function moveDown(id) {
    const idx = activeTasks.findIndex((t) => t.id === id)
    if (idx < 0 || idx >= activeTasks.length - 1) return
    syncLinkedQueueMove(id, activeTasks[idx + 1].id, "after")
  }

  function moveToTop(id) {
    const idx = activeTasks.findIndex((t) => t.id === id)
    if (idx <= 0) return
    syncLinkedQueueMove(id, activeTasks[0].id, "before")
  }

  function moveToBottom(id) {
    const idx = activeTasks.findIndex((t) => t.id === id)
    if (idx < 0 || idx >= activeTasks.length - 1) return
    syncLinkedQueueMove(id, activeTasks[activeTasks.length - 1].id, "after")
  }

  function reorderTask(dragId, targetId) {
    if (!dragId || !targetId || dragId === targetId) return
    const fromIndex = activeTasks.findIndex((t) => t.id === dragId)
    const toIndex = activeTasks.findIndex((t) => t.id === targetId)
    const zone = fromIndex < toIndex ? "after" : "before"
    syncLinkedQueueMove(dragId, targetId, zone)
  }

  function playTask(id) {
    const task = activeTasks.find((t) => t.id === id)
    if (!task) return
    // Bug fix: activate the source main task (moves it to position 0 in queue)
    if (task.sourceMainTaskId) {
      activateMainTask(task.sourceMainTaskId)
    }
    setCurrentView("timer")
    setTimerRunning(true)
    if (settingsRef.current.autoScrollOnAlarm !== false) {
      focusAlarmTarget(task)
    }
  }

  function toggleTaskFlag(id, _flagKey) {
    // adhdFlags are not persisted in the new model (step shape doesn't carry them).
    // No-op for now — can be wired to step metadata if needed.
  }

  // ── Quick actions ────────────────────────────────────────────────────────

  function emojiMe() {
    // Emoji is decorative — no-op in derived queue model.
  }

  function colorMe() {
    if (!currentTask || typeof window === "undefined") return
    if (colorFrameRef.current) return

    colorFrameRef.current = window.requestAnimationFrame(() => {
      colorFrameRef.current = 0
      const nextColor = pickNextColor(currentTask.color)
      if (currentTask.sourceMainTaskId) {
        updateMainTask(currentTask.sourceMainTaskId, { color: nextColor })
      }
    })
  }

  function randomTask() {
    // Bug fix: pick a random *main task* (not timer queue entry) and activate it.
    const activeMains = mainTasks.filter((t) => t.status === "active")
    if (activeMains.length < 2) return
    const currentMainId = currentTask?.sourceMainTaskId
    const candidates = activeMains.filter((t) => t.id !== currentMainId)
    if (!candidates.length) return
    const picked = candidates[Math.floor(Math.random() * candidates.length)]
    activateMainTask(picked.id)
    setTimerRunning(true)
  }

  function addOvertime(minutes = 5) {
    adjustTime(minutes * 60)
  }

  function clearActiveTasks() {
    // In the derived queue model, "clearing" means completing all active main
    // tasks. Too destructive for an accidental click — just stop the timer.
    if (!window.confirm("Stop timer and clear active queue?")) return
    setTimerRunning(false)
  }

  // ── Presets ──────────────────────────────────────────────────────────────

  function savePreset(name) {
    const newId = Math.random().toString(36).slice(2, 10)
    // Save a snapshot of the current queue shape (title + color) for later recall.
    setPresets((prev) => [
      ...prev,
      { id: newId, name, tasks: activeTasks.map((t) => ({ ...t })) },
    ])
  }

  function loadPreset(presetId) {
    // Presets are legacy standalone tasks — no longer synced to mainTasks.
    // For now, keep the preset data but don't push to activeTasks (derived).
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
    // Remove step ID from the hidden set so it reappears in the derived queue
    setDeferredStepIds((prev) => prev.filter((sid) => sid !== task.id))
    setDeferredTasks((prev) => prev.filter((t) => t.id !== id))
    setCurrentView("timer")
  }

  function deleteDeferred(id) {
    setDeferredTasks((prev) => prev.filter((t) => t.id !== id))
  }

  // ── Computed ─────────────────────────────────────────────────────────────

  const totalRemainingSeconds = activeTasks.reduce(
    (sum, t) => sum + t.remainingSeconds,
    0,
  )

  const timerContextValue = {
    currentTask,
    timerRunning,
    setTimerRunning,
    toggleTimerWithClick,
    adjustTime,
    alarmActive,
    stopAlarm,
    onBreak,
    breakSecondsLeft,
    pomoEnabled,
    pomoWorkStart,
    pomoWorkDuration,
    hasSelectedTrack: Boolean(selectedTrackId),
    hasUploadedTracks: uploadedTracks.length > 0,
  }

  function skipBreak() {
    setOnBreak(false)
    setBreakSecondsLeft(0)
    setBreakStartISO(null)
  }

  const musicProps = {
    uploadedTracks,
    selectedTrackId,
    setSelectedTrackId,
    musicVolume,
    setMusicVolume,
    musicLoop,
    setMusicLoop,
    musicMuted,
    setMusicMuted,
    onUploadTracks: handleMusicUpload,
    onDeleteTrack: handleDeleteTrack,
    onPreviewTrack: previewTrack,
    previewTrackId,
    onToggleMusicPlayback: toggleMusicPlaybackFromUI,
    isMusicPlaying: Boolean(
      taskMusicRef.current && !taskMusicRef.current.paused,
    ),
    audioBlockedMessage,
    musicUiMessage,
  }

  const taskProps = {
    activeTasks,
    completedTasks,
    deletedTasks,
    settings,
    completeTask,
    restoreCompletedTask,
    deleteTask: softDeleteTask,
    undoDeleteTask,
    clearDeletedTasks,
    resetTask,
    deferTask,
    adjustTime,
    moveUp,
    moveDown,
    moveToTop,
    moveToBottom,
    reorderTask,
    playTask,
    toggleTaskFlag,
    emojiMe,
    colorMe,
    randomTask,
    addOvertime,
    clearActiveTasks,
    showAddForm,
    setShowAddForm,
  }

  return (
    <div
      className={`timer-app timer-app--${theme} ${settings.matchMainPageStyle ? "timer-app--main-style" : ""} ${sidebarMode ? "timer-app--sidebar" : ""}`}
    >
      <TopBar
        sessionSeconds={sessionSeconds}
        totalRemainingSeconds={totalRemainingSeconds}
        settings={settings}
        setSettings={setSettings}
        theme={theme}
        setTheme={setTheme}
        pomoEnabled={pomoEnabled}
        pomoWorkStart={pomoWorkStart}
        pomoWorkDuration={pomoWorkDuration}
        onBreak={onBreak}
        musicMuted={musicMuted}
        setMusicMuted={setMusicMuted}
      />
      <TimerProvider value={timerContextValue}>
        <div className="timer-main">
          {currentView === "timer" && (
            <>
              <TimerPanel />
              {!timerRunning && !onBreak && (
                <div
                  className={`idle-prompt${idleCountdown === 0 ? " idle-prompt--urgent" : ""}`}
                >
                  <div className="idle-prompt__header">
                    <span className="idle-prompt__label">
                      Vad är nästa uppgift?
                    </span>
                    {idleCountdown !== null && (
                      <span
                        className={`idle-prompt__countdown${idleCountdown === 0 ? " idle-prompt__countdown--zero" : ""}`}
                      >
                        {idleCountdown}s
                      </span>
                    )}
                  </div>
                  <div className="idle-prompt__row">
                    <input
                      className="idle-prompt__input"
                      value={idleInputText}
                      onChange={(e) => setIdleInputText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleIdleAdd()}
                      placeholder="t.ex. inbox 5"
                    />
                    <button
                      className="idle-prompt__btn"
                      onClick={handleIdleAdd}
                      disabled={!idleInputText.trim()}
                      aria-label="Start task"
                    >
                      ▶
                    </button>
                  </div>
                </div>
              )}
              <SidebarTaskSteps />
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
              deletedTasks={deletedTasks}
              deferredTasks={deferredTasks}
              sessionSeconds={sessionSeconds}
              undoDeleteTask={undoDeleteTask}
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
            <SettingsView
              settings={settings}
              setSettings={setSettings}
              music={musicProps}
            />
          )}
        </div>
      </TimerProvider>

      {/* Add Task Modal (scoped locally) */}
      <div className="add-task-form-parent">
        {showAddForm && (
          <AddTaskForm
            onAdd={addTask}
            onClose={() => setShowAddForm(false)}
            defaultDuration={settings.defaultTaskDuration}
          />
        )}
      </div>

      <BottomNav currentView={currentView} setCurrentView={setCurrentView} />

      {onBreak && (
        <BreakOverlay
          secondsLeft={breakSecondsLeft}
          totalSeconds={pomoBreakDuration}
          onSkip={skipBreak}
          taskMusicRef={taskMusicRef}
          musicVolume={musicVolume}
        />
      )}
    </div>
  )
}
