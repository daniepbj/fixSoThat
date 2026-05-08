import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, waitFor, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import TimerApp from "../components/TimerApp"
import { MainTaskProvider, useMainTask } from "../context/MainTaskContext"
import { AppSyncProvider, useAppSync } from "../context/AppSyncContext"

vi.mock("canvas-confetti", () => ({ default: vi.fn() }))
vi.mock("../utils/soundEffects", () => ({
  playCompletionSound: vi.fn(),
  playClickSound: vi.fn(),
  playPowerUpSound: vi.fn(() => Promise.resolve()),
}))
vi.mock("../utils/alarm", () => ({ playAlarmOnce: vi.fn() }))
vi.mock("../utils/musicStore", () => ({
  addTrackFromFile: vi.fn(async () => {}),
  deleteTrack: vi.fn(async () => {}),
  getTrack: vi.fn(async () => null),
  listTracks: vi.fn(async () => []),
}))

function createTask(overrides = {}) {
  return {
    id: overrides.id || "task-1",
    title: overrides.title || "Test Task",
    emoji: "🎯",
    color: "#6c63ff",
    estimatedMinutes: 2,
    remainingSeconds: 120,
    spentSeconds: 0,
    adhdFlags: {
      needsSteps: false,
      needsTime: false,
      needsProof: false,
      priority: false,
    },
    ...overrides,
  }
}

function seedTimerStorage({ active = [], completed = [], deleted = [] } = {}) {
  localStorage.setItem("fst_v1_init", "1")
  localStorage.setItem("fst_active", JSON.stringify(active))
  localStorage.setItem("fst_completed", JSON.stringify(completed))
  localStorage.setItem("fst_deleted_active", JSON.stringify(deleted))
  localStorage.setItem("fst_deferred", JSON.stringify([]))
  localStorage.setItem("fst_presets", JSON.stringify([]))
  localStorage.setItem(
    "fst_settings",
    JSON.stringify({
      soundEnabled: false,
      autoStartNextTask: true,
      autoScrollOnAlarm: true,
      defaultTaskDuration: 2,
      showCompletedByDefault: false,
      matchMainPageStyle: true,
      alarmMode: "nag",
      idlePromptSeconds: 30,
      pomodoroEnabled: true,
      pomodoroWorkMinutes: 20,
      pomodoroBreakMinutes: 5,
    }),
  )
  localStorage.setItem("fst_running", JSON.stringify(false))
  localStorage.setItem("fst_session", JSON.stringify(0))
  localStorage.setItem("fst_view", JSON.stringify("timer"))
  localStorage.setItem("fst_theme", JSON.stringify("dark"))
  localStorage.setItem("fst_music_volume", JSON.stringify(1))
  localStorage.setItem("fst_music_loop", JSON.stringify(true))
  localStorage.setItem("fst_music_muted", JSON.stringify(false))
  localStorage.setItem("fst_music_selected_track", JSON.stringify(""))
}

function AppSyncTestBridge({ onAppSync }) {
  const appSync = useAppSync()
  React.useEffect(() => {
    onAppSync(appSync)
  }, [appSync, onAppSync])
  return null
}

function renderTimerAppWithAppSync() {
  const appSyncRef = { current: null }
  const result = render(
    <AppSyncProvider>
      <MainTaskProvider>
        <AppSyncTestBridge onAppSync={(ctx) => (appSyncRef.current = ctx)} />
        <TimerApp />
      </MainTaskProvider>
    </AppSyncProvider>,
  )
  return { ...result, appSyncRef }
}

describe("TimerApp – AppSync integration", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()

    globalThis.Audio = class {
      constructor() {
        this.paused = true
        this.loop = false
        this.muted = false
        this.volume = 1
      }
      load() {}
      play() {
        this.paused = false
        return Promise.resolve()
      }
      pause() {
        this.paused = true
      }
      removeAttribute() {}
    }
  })

  describe("autostart via AppSync.requestAutoStartMainTask", () => {
    it("starts timer when autostart intent matches active main task", async () => {
      seedTimerStorage({
        active: [
          createTask({
            id: "t1",
            title: "AutoStart Task",
            sourceMainTaskId: "main-1",
            sourceStepId: "step-1",
          }),
        ],
      })

      const { appSyncRef } = renderTimerAppWithAppSync()

      act(() => {
        appSyncRef.current.requestAutoStartMainTask("main-1")
      })

      await waitFor(() => {
        expect(localStorage.getItem("fst_running")).toBe("true")
      })
    })

    it("does not start timer if head task has no remaining seconds", async () => {
      seedTimerStorage({
        active: [
          createTask({
            id: "t1",
            title: "Zero Task",
            sourceMainTaskId: "main-1",
            sourceStepId: "step-1",
            remainingSeconds: 0,
          }),
        ],
      })

      const { appSyncRef } = renderTimerAppWithAppSync()

      act(() => {
        appSyncRef.current.requestAutoStartMainTask("main-1")
      })

      await waitFor(() => {
        const running = JSON.parse(
          localStorage.getItem("fst_running") || "false",
        )
        expect(running).toBe(false)
      })
    })

    it("ignores autostart if main task id does not match active", async () => {
      seedTimerStorage({
        active: [
          createTask({
            id: "t1",
            title: "Task A",
            sourceMainTaskId: "main-1",
            sourceStepId: "step-1",
          }),
        ],
      })

      const { appSyncRef } = renderTimerAppWithAppSync()

      act(() => {
        appSyncRef.current.requestAutoStartMainTask("main-2")
      })

      await waitFor(() => {
        const running = JSON.parse(
          localStorage.getItem("fst_running") || "false",
        )
        expect(running).toBe(false)
      })
    })
  })

  describe("focus via AppSync.requestFocusMainTask", () => {
    it("focuses and plays exact step task when queue is synced", async () => {
      seedTimerStorage({
        active: [
          createTask({
            id: "t1",
            title: "Step Task",
            sourceMainTaskId: "main-1",
            sourceStepId: "step-1",
          }),
          createTask({
            id: "t2",
            title: "Other Step",
            sourceMainTaskId: "main-1",
            sourceStepId: "step-2",
          }),
        ],
      })

      const { appSyncRef, container } = renderTimerAppWithAppSync()

      act(() => {
        appSyncRef.current.requestFocusMainTask("main-1", "step-1")
      })

      await waitFor(() => {
        const playingTaskId = JSON.parse(
          localStorage.getItem("fst_session") || "0",
        )
        expect(playingTaskId).toBe("t1")
      })
    })

    it("focuses main task (no step) when no exact step task found", async () => {
      seedTimerStorage({
        active: [
          createTask({
            id: "t1",
            title: "Main Task",
            sourceMainTaskId: "main-1",
            sourceStepId: "step-1",
          }),
          createTask({
            id: "t2",
            title: "Other Task",
            sourceMainTaskId: "main-2",
            sourceStepId: "step-2",
          }),
        ],
      })

      const { appSyncRef } = renderTimerAppWithAppSync()

      act(() => {
        appSyncRef.current.requestFocusMainTask("main-1", null)
      })

      await waitFor(() => {
        const session = JSON.parse(localStorage.getItem("fst_session") || "0")
        expect(session).toBe("t1")
      })
    })

    it("arms autostart as fallback when focus queue task not yet synced", async () => {
      seedTimerStorage({
        active: [],
      })

      const { appSyncRef } = renderTimerAppWithAppSync()

      act(() => {
        appSyncRef.current.requestFocusMainTask("main-1", null)
      })

      await waitFor(() => {
        expect(appSyncRef.current.autoStartMainTaskRequest?.mainTaskId).toBe(
          "main-1",
        )
      })
    })

    it("does not re-arm autostart on repeated focus with same request id", async () => {
      seedTimerStorage({
        active: [],
      })

      const { appSyncRef } = renderTimerAppWithAppSync()

      const initialRequestId =
        appSyncRef.current.autoStartMainTaskRequest?.requestId

      act(() => {
        appSyncRef.current.requestFocusMainTask("main-1", null)
      })

      await waitFor(() => {
        expect(appSyncRef.current.autoStartMainTaskRequest).toBeTruthy()
      })

      const firstArmedId =
        appSyncRef.current.autoStartMainTaskRequest?.requestId

      // Trigger again (same focus request id should have no effect on re-arming)
      act(() => {
        appSyncRef.current.requestFocusMainTask("main-1", null)
      })

      const secondArmedId =
        appSyncRef.current.autoStartMainTaskRequest?.requestId
      expect(secondArmedId).toBe(firstArmedId)
    })
  })

  describe("stop-alarm via AppSync.requestStopAlarm", () => {
    it("stops active alarm when signal is sent", async () => {
      seedTimerStorage({
        active: [
          createTask({
            id: "t1",
            title: "Alarm Task",
            remainingSeconds: 0,
          }),
        ],
      })

      const { appSyncRef, container } = renderTimerAppWithAppSync()

      // Manually trigger alarm active state by setting fst_alarm_active
      localStorage.setItem("fst_alarm_active", "1")

      await waitFor(() => {
        expect(localStorage.getItem("fst_alarm_active")).toBe("1")
      })

      act(() => {
        appSyncRef.current.requestStopAlarm()
      })

      await waitFor(() => {
        const alarmActive = localStorage.getItem("fst_alarm_active")
        expect(alarmActive).not.toBe("1")
      })
    })

    it("stops alarm after multiple signal calls", async () => {
      seedTimerStorage({
        active: [createTask({ id: "t1", remainingSeconds: 0 })],
      })

      const { appSyncRef } = renderTimerAppWithAppSync()

      act(() => {
        appSyncRef.current.requestStopAlarm()
        appSyncRef.current.requestStopAlarm()
        appSyncRef.current.requestStopAlarm()
      })

      await waitFor(() => {
        expect(appSyncRef.current.stopAlarmSignal).toBeGreaterThan(0)
      })
    })
  })

  describe("complete-timer-step via AppSync.requestCompleteTimerStep", () => {
    it("completes linked timer task when main-task step is checked", async () => {
      seedTimerStorage({
        active: [
          createTask({
            id: "t1",
            title: "Linked Task",
            sourceMainTaskId: "main-1",
            sourceStepId: "step-1",
          }),
        ],
      })

      const { appSyncRef } = renderTimerAppWithAppSync()

      act(() => {
        appSyncRef.current.requestCompleteTimerStep("main-1", "step-1")
      })

      await waitFor(() => {
        const active = JSON.parse(localStorage.getItem("fst_active") || "[]")
        const completed = JSON.parse(
          localStorage.getItem("fst_completed") || "[]",
        )
        expect(active).toHaveLength(0)
        expect(completed).toHaveLength(1)
        expect(completed[0].id).toBe("t1")
      })
    })

    it("does not complete unrelated tasks", async () => {
      seedTimerStorage({
        active: [
          createTask({
            id: "t1",
            title: "Task 1",
            sourceMainTaskId: "main-1",
            sourceStepId: "step-1",
          }),
          createTask({
            id: "t2",
            title: "Task 2",
            sourceMainTaskId: "main-2",
            sourceStepId: "step-2",
          }),
        ],
      })

      const { appSyncRef } = renderTimerAppWithAppSync()

      act(() => {
        appSyncRef.current.requestCompleteTimerStep("main-1", "step-1")
      })

      await waitFor(() => {
        const active = JSON.parse(localStorage.getItem("fst_active") || "[]")
        expect(active).toHaveLength(1)
        expect(active[0].id).toBe("t2")
      })
    })

    it("ignores duplicate completion requests with same request id", async () => {
      seedTimerStorage({
        active: [
          createTask({
            id: "t1",
            sourceMainTaskId: "main-1",
            sourceStepId: "step-1",
          }),
          createTask({
            id: "t2",
            sourceMainTaskId: "main-2",
            sourceStepId: "step-2",
          }),
        ],
      })

      const { appSyncRef } = renderTimerAppWithAppSync()

      const req = appSyncRef.current.completeTimerStepRequest

      act(() => {
        appSyncRef.current.requestCompleteTimerStep("main-1", "step-1")
      })

      await waitFor(() => {
        const active = JSON.parse(localStorage.getItem("fst_active") || "[]")
        expect(active).toHaveLength(1)
      })

      const firstRequestId =
        appSyncRef.current.completeTimerStepRequest?.requestId

      // Trigger same request again — should be ignored
      act(() => {
        appSyncRef.current.requestCompleteTimerStep("main-1", "step-1")
      })

      const secondRequestId =
        appSyncRef.current.completeTimerStepRequest?.requestId
      expect(secondRequestId).toBe(firstRequestId)

      // Verify no additional task was completed
      await waitFor(() => {
        const active = JSON.parse(localStorage.getItem("fst_active") || "[]")
        expect(active).toHaveLength(1)
      })
    })
  })

  describe("timer snapshot publishing via AppSync.publishTimerSnapshot", () => {
    it("captures current active tasks and running state", async () => {
      seedTimerStorage({
        active: [
          createTask({
            id: "t1",
            title: "Task 1",
          }),
          createTask({
            id: "t2",
            title: "Task 2",
          }),
        ],
      })

      const { appSyncRef } = renderTimerAppWithAppSync()

      await waitFor(() => {
        expect(appSyncRef.current.timerActiveTasks.length).toBeGreaterThan(0)
      })

      expect(appSyncRef.current.timerActiveTasks[0].title).toBe("Task 1")
      expect(typeof appSyncRef.current.timerRunning).toBe("boolean")
    })

    it("updates snapshot when tasks change", async () => {
      seedTimerStorage({
        active: [createTask({ id: "t1", title: "Task 1" })],
      })

      const { appSyncRef, container } = renderTimerAppWithAppSync()

      await waitFor(() => {
        expect(appSyncRef.current.timerActiveTasks).toHaveLength(1)
      })

      const doneBtn = container.querySelector(".task-card__btn--complete")
      await userEvent.click(doneBtn)

      await waitFor(() => {
        expect(appSyncRef.current.timerActiveTasks).toHaveLength(0)
      })
    })
  })
})
