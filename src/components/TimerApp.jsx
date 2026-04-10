import { useState, useEffect, useRef } from "react"
import { useLocalStorage } from "../hooks/useLocalStorage"
import { createTask, initStorageIfNew, EMOJIS, COLORS } from "../data/seedData"
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
import { TimerProvider } from "../context/TimerContext"
import { useMainTask } from "../context/MainTaskContext"
import "../timer.css"
import { playAlarmOnce } from "../utils/alarm"
import {
  parseStepRaw,
  formatStepRaw,
  sortStepsWithLinks,
  getChildren,
} from "../utils/stepUtils"
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

function clampMinutes(value, fallback = 25) {
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

function flattenActionableSteps(steps) {
  // Flat model: steps is a flat array with parentId + order.
  // DFS through hierarchy, collecting leaf steps.
  const flattened = []
  const visit = (parentId) => {
    const children = getChildren(steps, parentId)
    for (const step of children) {
      const grandchildren = getChildren(steps, step.id)
      if (grandchildren.length === 0) {
        flattened.push(step)
      } else {
        visit(step.id)
      }
    }
  }
  visit(null)
  return flattened
}

export default function TimerApp({ sidebarMode = false }) {
  const {
    mainTasks,
    activeMainTaskId,
    addMainTaskAndActivate,
    setStepCompleted,
    incrementTries,
    incrementStepTries,
  } = useMainTask()

  const mountedRef = useRef(false)

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
    alarmMode: "nag",
  })
  const [timerRunning, setTimerRunning] = useLocalStorage("fst_running", false)
  const [sessionSeconds, setSessionSeconds] = useLocalStorage("fst_session", 0)
  const [currentView, setCurrentView] = useLocalStorage("fst_view", "timer")
  const [theme, setTheme] = useLocalStorage("fst_theme", "dark")
  const [musicVolume, setMusicVolume] = useLocalStorage(
    "fst_music_volume",
    0.55,
  )
  const [musicLoop, setMusicLoop] = useLocalStorage("fst_music_loop", true)
  const [musicMuted, setMusicMuted] = useLocalStorage("fst_music_muted", false)
  const [selectedTrackId, setSelectedTrackId] = useLocalStorage(
    "fst_music_selected_track",
    "",
  )

  const [showAddForm, setShowAddForm] = useState(false)
  const [alarmActive, setAlarmActive] = useState(false)
  const [uploadedTracks, setUploadedTracks] = useState([])
  const [musicUiMessage, setMusicUiMessage] = useState("")
  const [audioBlockedMessage, setAudioBlockedMessage] = useState("")
  const [previewTrackId, setPreviewTrackId] = useState("")
  const alarmIntervalRef = useRef(null)
  const taskMusicRef = useRef(null)
  const taskMusicUrlRef = useRef("")
  const previewAudioRef = useRef(null)
  const previewUrlRef = useRef("")
  const confettiTimerRef = useRef(null)
  const lastConfettiAtRef = useRef(0)
  const lastTryIncrementKeyRef = useRef("")

  // First task is always the "current" active task tied to the timer
  const currentTask = activeTasks[0] ?? null
  const activeMainTask =
    mainTasks.find((t) => t.id === activeMainTaskId) || null
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
    setActiveTasks((prev) => prev.map(normalizeTask))
    setDeferredTasks((prev) => prev.map(normalizeTask))
    setSettings((prev) => ({
      ...prev,
      defaultTaskDuration: clampMinutes(prev.defaultTaskDuration, 25),
      matchMainPageStyle: Boolean(prev.matchMainPageStyle),
      alarmMode: prev.alarmMode ?? (prev.soundEnabled ? "nag" : "silent"),
    }))
  }, [setActiveTasks, setDeferredTasks, setSettings, setTimerRunning])

  // Keep timer tasks synced with the currently active main task.
  useEffect(() => {
    if (!activeMainTask) return

    setActiveTasks((prev) => {
      const prevByStepId = new Map(
        prev
          .filter(
            (t) => t.sourceMainTaskId === activeMainTask.id && t.sourceStepId,
          )
          .map((t) => [t.sourceStepId, t]),
      )

      // Keep tasks that don't belong to this main task (manually added or from other sources)
      const unrelated = prev.filter(
        (t) => t.sourceMainTaskId !== activeMainTask.id,
      )

      const synced = flattenActionableSteps(activeMainTask.steps)
        .filter((step) => !step.completed)
        .map((step) => {
          const parsed = parseStepRaw(step.raw)
          const safeMinutes = clampMinutes(
            parsed.minutes,
            settings.defaultTaskDuration,
          )
          const existing = prevByStepId.get(step.id)

          if (existing) {
            return {
              ...existing,
              title: parsed.text || step.raw || "Step",
              estimatedMinutes: safeMinutes,
              sourceMainTaskId: activeMainTask.id,
              sourceStepId: step.id,
            }
          }

          return createTask({
            title: parsed.text || step.raw || "Step",
            estimatedMinutes: safeMinutes,
            sourceMainTaskId: activeMainTask.id,
            sourceStepId: step.id,
            emoji: "✅",
            color: "#10b981",
          })
        })

      return [...synced, ...unrelated]
    })
    // Note: do NOT setCurrentView here — user may be on settings or another view
  }, [
    activeMainTask,
    activeMainTaskId,
    settings.defaultTaskDuration,
    setActiveTasks,
  ])

  // ── Timer tick ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerRunning) return
    const id = setInterval(() => {
      let ticked = false
      setActiveTasks((prev) => {
        if (!prev.length) return prev
        const [head, ...tail] = prev
        if (head.remainingSeconds <= 0) return prev
        ticked = true
        return [
          {
            ...head,
            remainingSeconds: head.remainingSeconds - 1,
            spentSeconds: head.spentSeconds + 1,
          },
          ...tail,
        ]
      })
      // Only count session time when a task actually ticked
      if (ticked) setSessionSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [timerRunning])

  // ── Stop timer when there are no active tasks ────────────────────────────
  useEffect(() => {
    if (timerRunning && activeTasks.length === 0) {
      setTimerRunning(false)
    }
  }, [activeTasks.length, timerRunning, setTimerRunning])

  // ── Alarm ────────────────────────────────────────────────────────────────
  function triggerAlarm() {
    const mode = settingsRef.current.alarmMode ?? "silent"
    setAlarmActive(true)
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

    playClickSound(musicVolume)
    setTimerRunning((running) => !running)
  }

  // ── Task actions ─────────────────────────────────────────────────────────

  function completeTask(id) {
    stopAlarm()
    const task = activeTasks.find((t) => t.id === id)
    if (!task) return

    if (task.sourceMainTaskId && task.sourceStepId) {
      setStepCompleted(task.sourceMainTaskId, task.sourceStepId, true)
    }

    playCompletionSound(musicVolume)
    triggerCelebration()
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
    const task = activeTasks.find((t) => t.id === id)
    if (task?.sourceMainTaskId) {
      incrementTries(task.sourceMainTaskId)
      if (task.sourceStepId) {
        incrementStepTries(task.sourceMainTaskId, task.sourceStepId)
      }
    }

    setActiveTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              estimatedMinutes: clampMinutes(t.estimatedMinutes, 25),
              remainingSeconds: clampSeconds(
                clampMinutes(t.estimatedMinutes, 25) * 60,
              ),
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
    // Tasks already linked to a main task — add directly
    setActiveTasks((prev) => [
      ...prev,
      ...toAdd.map((data) => {
        const safeMinutes = clampMinutes(
          data.estimatedMinutes,
          settings.defaultTaskDuration,
        )
        return createTask({ ...data, estimatedMinutes: safeMinutes })
      }),
    ])
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

  function reorderTask(dragId, targetId) {
    if (!dragId || !targetId || dragId === targetId) return
    setActiveTasks((prev) => {
      const from = prev.findIndex((t) => t.id === dragId)
      const to = prev.findIndex((t) => t.id === targetId)
      if (from < 0 || to < 0 || from === to) return prev
      const copy = [...prev]
      const [item] = copy.splice(from, 1)
      copy.splice(to, 0, item)
      return copy
    })
  }

  function playTask(id) {
    playClickSound(musicVolume)
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
        remainingSeconds: clampSeconds(
          clampMinutes(t.estimatedMinutes, 25) * 60,
        ),
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

  const timerContextValue = {
    currentTask,
    timerRunning,
    setTimerRunning,
    toggleTimerWithClick,
    adjustTime,
    alarmActive,
    stopAlarm,
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
      />
      <TimerProvider value={timerContextValue}>
        <div className="timer-main">
          {currentView === "timer" && (
            <>
              <TimerPanel />
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
            <SettingsView
              settings={settings}
              setSettings={setSettings}
              music={musicProps}
            />
          )}
        </div>
      </TimerProvider>

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
