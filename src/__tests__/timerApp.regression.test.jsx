import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import TimerApp from "../components/TimerApp"
import { MainTaskProvider } from "../context/MainTaskContext"
import { AppSyncProvider } from "../context/AppSyncContext"
import { addTrackFromFile, deleteTrack, listTracks } from "../utils/musicStore"

vi.mock("canvas-confetti", () => ({ default: vi.fn() }))

vi.mock("../utils/soundEffects", () => ({
  playCompletionSound: vi.fn(),
  playClickSound: vi.fn(),
  playPowerUpSound: vi.fn(() => Promise.resolve()),
}))

vi.mock("../utils/alarm", () => ({
  playAlarmOnce: vi.fn(),
}))

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

function renderTimerApp() {
  return render(
    <AppSyncProvider>
      <MainTaskProvider>
        <TimerApp />
      </MainTaskProvider>
    </AppSyncProvider>,
  )
}

function clickBottomNav(label) {
  const labelNode = screen.getByText(label)
  const button = labelNode.closest("button")
  if (!button) throw new Error(`Bottom nav button not found for ${label}`)
  return userEvent.click(button)
}

describe("TimerApp regression coverage", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()

    // Lightweight audio stub for jsdom
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

    listTracks.mockResolvedValue([])
  })

  it("complete task moves it from active to completed", async () => {
    seedTimerStorage({ active: [createTask({ id: "a1", title: "Alpha" })] })
    const { container } = renderTimerApp()

    const doneBtn = container.querySelector(".task-card__btn--complete")
    expect(doneBtn).toBeTruthy()
    await userEvent.click(doneBtn)

    await waitFor(() => {
      const active = JSON.parse(localStorage.getItem("fst_active") || "[]")
      const completed = JSON.parse(
        localStorage.getItem("fst_completed") || "[]",
      )
      expect(active).toHaveLength(0)
      expect(completed).toHaveLength(1)
      expect(completed[0].title).toBe("Alpha")
    })
  })

  it("reset task restores remaining time and clears spent time", async () => {
    seedTimerStorage({
      active: [
        createTask({
          id: "a1",
          title: "Needs reset",
          estimatedMinutes: 2,
          remainingSeconds: 11,
          spentSeconds: 77,
        }),
      ],
    })
    const { container } = renderTimerApp()

    const resetBtn = container.querySelector(".task-card__btn--reset")
    expect(resetBtn).toBeTruthy()
    await userEvent.click(resetBtn)

    await waitFor(() => {
      const active = JSON.parse(localStorage.getItem("fst_active") || "[]")
      expect(active[0].remainingSeconds).toBe(120)
      expect(active[0].spentSeconds).toBe(0)
    })
  })

  it("defer moves task to not-now and restore brings it back", async () => {
    seedTimerStorage({ active: [createTask({ id: "a1", title: "Defer me" })] })
    const { container } = renderTimerApp()

    const deferBtn = container.querySelector(".task-card__btn--defer")
    expect(deferBtn).toBeTruthy()
    await userEvent.click(deferBtn)

    await waitFor(() => {
      const active = JSON.parse(localStorage.getItem("fst_active") || "[]")
      const deferred = JSON.parse(localStorage.getItem("fst_deferred") || "[]")
      expect(active).toHaveLength(0)
      expect(deferred).toHaveLength(1)
    })

    await clickBottomNav("Not-Now")
    await userEvent.click(
      screen.getByRole("button", { name: /restore to active/i }),
    )

    await waitFor(() => {
      const active = JSON.parse(localStorage.getItem("fst_active") || "[]")
      const deferred = JSON.parse(localStorage.getItem("fst_deferred") || "[]")
      expect(active).toHaveLength(1)
      expect(deferred).toHaveLength(0)
    })
  })

  it("delete moves task to deleted and undo restores it", async () => {
    seedTimerStorage({ active: [createTask({ id: "a1", title: "Delete me" })] })
    const { container } = renderTimerApp()

    const deleteBtn = container.querySelector(".task-card__header-delete")
    expect(deleteBtn).toBeTruthy()
    await userEvent.click(deleteBtn)

    await waitFor(() => {
      const active = JSON.parse(localStorage.getItem("fst_active") || "[]")
      const deleted = JSON.parse(
        localStorage.getItem("fst_deleted_active") || "[]",
      )
      expect(active).toHaveLength(0)
      expect(deleted).toHaveLength(1)
    })

    await userEvent.click(
      screen.getByRole("button", { name: /deleted \(1\)/i }),
    )
    await userEvent.click(screen.getByRole("button", { name: /undo/i }))

    await waitFor(() => {
      const active = JSON.parse(localStorage.getItem("fst_active") || "[]")
      const deleted = JSON.parse(
        localStorage.getItem("fst_deleted_active") || "[]",
      )
      expect(active).toHaveLength(1)
      expect(deleted).toHaveLength(0)
    })
  })

  it("music upload from settings calls addTrackFromFile for selected files", async () => {
    seedTimerStorage({ active: [createTask({ id: "a1" })] })
    const { container } = renderTimerApp()

    await clickBottomNav("Settings")

    const input = container.querySelector("#music-upload-input")
    expect(input).toBeTruthy()

    const fileA = new File(["aaa"], "track-a.mp3", { type: "audio/mpeg" })
    const fileB = new File(["bbb"], "track-b.wav", { type: "audio/wav" })

    fireEvent.change(input, { target: { files: [fileA, fileB] } })

    await waitFor(() => {
      expect(addTrackFromFile).toHaveBeenCalledTimes(2)
    })
  })

  it("music track delete in settings calls deleteTrack", async () => {
    seedTimerStorage({ active: [createTask({ id: "a1" })] })
    listTracks.mockResolvedValue([{ id: "trk-1", name: "Track 1", size: 1024 }])

    renderTimerApp()

    await clickBottomNav("Settings")

    await waitFor(() => {
      expect(screen.getByText("Track 1")).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" })
    await userEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(deleteTrack).toHaveBeenCalledWith("trk-1")
    })
  })
})
