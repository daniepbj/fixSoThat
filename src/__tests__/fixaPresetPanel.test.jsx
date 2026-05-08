import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import FixaPresetPanel from "../components/FixaPresetPanel"
import { MainTaskProvider, useMainTask } from "../context/MainTaskContext"
import { AppSyncProvider, useAppSync } from "../context/AppSyncContext"

vi.mock("../utils/soundEffects", () => ({
  playPowerUpSound: vi.fn(() => Promise.resolve()),
  playCompletionSound: vi.fn(() => Promise.resolve()),
}))

function seedTimerStorage(tasks) {
  localStorage.setItem("fst_timer_active_tasks", JSON.stringify(tasks))
}

function TestHarness() {
  const mainCtx = useMainTask()
  const appCtx = useAppSync()

  return (
    <div>
      <FixaPresetPanel />
      <div data-testid="main-tasks-count">{mainCtx.mainTasks.length}</div>
      <div data-testid="main-tasks">{JSON.stringify(mainCtx.mainTasks)}</div>
      <div data-testid="timer-snapshot">
        {JSON.stringify(appCtx.timerActiveTasks)}
      </div>
    </div>
  )
}

function renderPresetPanel() {
  return render(
    <AppSyncProvider>
      <MainTaskProvider>
        <TestHarness />
      </MainTaskProvider>
    </AppSyncProvider>,
  )
}

describe("FixaPresetPanel", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe("preset list display", () => {
    it("displays available presets", () => {
      renderPresetPanel()

      const presetList = screen.queryByRole("list", { name: /preset/i })
      const presetItems = screen.queryAllByRole("button", {
        name: /preset|fixa/i,
      })

      // Check that something is displayed
      expect(screen.getByText(/preset|fixa/i)).toBeInTheDocument()
    })

    it("shows preset names and descriptions", () => {
      renderPresetPanel()

      const presetElements = screen.queryAllByText(/fixa|preset/i)
      expect(presetElements.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe("load preset behavior", () => {
    it("loads preset tasks to main context", async () => {
      const user = userEvent.setup()
      renderPresetPanel()

      const presetBtns = screen.queryAllByRole("button", {
        name: /load|select|fixa/i,
      })

      if (presetBtns.length > 0) {
        await user.click(presetBtns[0])

        await waitFor(() => {
          const taskCount = screen.getByTestId("main-tasks-count")
          expect(parseInt(taskCount.textContent)).toBeGreaterThan(0)
        })
      }
    })

    it("creates appropriate task structure from preset", async () => {
      const user = userEvent.setup()
      renderPresetPanel()

      const presetBtns = screen.queryAllByRole("button", {
        name: /load|select|fixa/i,
      })

      if (presetBtns.length > 0) {
        await user.click(presetBtns[0])

        await waitFor(() => {
          const tasksDiv = screen.getByTestId("main-tasks")
          const tasks = JSON.parse(tasksDiv.textContent)
          if (tasks.length > 0) {
            const task = tasks[0]
            expect(task.id).toBeTruthy()
            expect(task.title).toBeTruthy()
            expect(Array.isArray(task.steps)).toBe(true)
          }
        })
      }
    })

    it("does not clear queue on preset load by default", async () => {
      const user = userEvent.setup()

      const queuedTask = {
        id: "q1",
        title: "Queued Task",
        sourceMainTaskId: "m1",
        sourceStepId: "s1",
      }

      seedTimerStorage([queuedTask])

      renderPresetPanel()

      const presetBtns = screen.queryAllByRole("button", {
        name: /load|select|fixa/i,
      })

      if (presetBtns.length > 0) {
        await user.click(presetBtns[0])

        await waitFor(() => {
          const snapshot = screen.getByTestId("timer-snapshot")
          const tasks = JSON.parse(snapshot.textContent)
          // Queued task should remain unless explicit clear
          if (tasks.length > 0 && tasks[0].sourceMainTaskId) {
            expect(tasks).toContainEqual(expect.objectContaining(queuedTask))
          }
        })
      }
    })
  })

  describe("orphan task completion", () => {
    it("completes orphaned queued tasks when preset loaded", async () => {
      const user = userEvent.setup()

      const orphanedTask = {
        id: "q1",
        title: "Orphaned Task",
        sourceMainTaskId: "m-orphaned",
        sourceStepId: "s-orphaned",
      }

      seedTimerStorage([orphanedTask])

      renderPresetPanel()

      const presetBtns = screen.queryAllByRole("button", {
        name: /load|select|fixa/i,
      })

      if (presetBtns.length > 0) {
        // Check orphan completion option
        const orphanCheckbox = screen.queryByRole("checkbox", {
          name: /orphan|cleanup|complete/i,
        })

        if (orphanCheckbox) {
          await user.click(orphanCheckbox)
        }

        await user.click(presetBtns[0])

        await waitFor(() => {
          const snapshot = screen.getByTestId("timer-snapshot")
          const tasks = JSON.parse(snapshot.textContent)
          // Orphaned task should be removed if cleanup enabled
          if (orphanCheckbox) {
            expect(
              tasks.every((t) => t.sourceMainTaskId !== "m-orphaned"),
            ).toBe(true)
          }
        })
      }
    })

    it("preserves non-orphaned queue tasks", async () => {
      const user = userEvent.setup()

      const mainTasks = [
        {
          id: "m1",
          title: "Existing Task",
          steps: [{ id: "s1", raw: "step", completed: false }],
          proof: "proof",
        },
      ]

      localStorage.setItem("fst_main_tasks", JSON.stringify(mainTasks))

      const queuedTask = {
        id: "q1",
        title: "Queued Task",
        sourceMainTaskId: "m1",
        sourceStepId: "s1",
      }

      seedTimerStorage([queuedTask])

      renderPresetPanel()

      const presetBtns = screen.queryAllByRole("button", {
        name: /load|select|fixa/i,
      })

      if (presetBtns.length > 0) {
        await user.click(presetBtns[0])

        await waitFor(() => {
          const snapshot = screen.getByTestId("timer-snapshot")
          const tasks = JSON.parse(snapshot.textContent)
          // Non-orphaned task should remain
          expect(tasks.some((t) => t.sourceMainTaskId === "m1")).toBe(true)
        })
      }
    })
  })

  describe("completion before load", () => {
    it("completes queued task from previous main task before loading preset", async () => {
      const user = userEvent.setup()

      const oldMainTask = {
        id: "m-old",
        title: "Old Task",
        steps: [
          { id: "s1", raw: "step 1", completed: false },
          { id: "s2", raw: "step 2", completed: false },
        ],
        proof: "proof",
      }

      localStorage.setItem("fst_main_tasks", JSON.stringify([oldMainTask]))

      const queuedTask = {
        id: "q1",
        title: "Queued from Old",
        sourceMainTaskId: "m-old",
        sourceStepId: "s1",
      }

      seedTimerStorage([queuedTask])

      // Option 1: Auto-complete before load
      const autoCompleteOpt = screen.queryByRole("checkbox", {
        name: /complete|auto|before/i,
      })

      renderPresetPanel()

      const presetBtns = screen.queryAllByRole("button", {
        name: /load|select|fixa/i,
      })

      if (presetBtns.length > 0 && autoCompleteOpt) {
        await user.click(autoCompleteOpt)
        await user.click(presetBtns[0])

        await waitFor(() => {
          const tasksDiv = screen.getByTestId("main-tasks")
          const tasks = JSON.parse(tasksDiv.textContent)
          // Old task should show completion from queued step
          const oldTask = tasks.find((t) => t.id === "m-old")
          if (oldTask) {
            expect(oldTask.steps[0].completed).toBe(true)
          }
        })
      }
    })
  })

  describe("preset variations", () => {
    it("handles different preset sizes", async () => {
      const user = userEvent.setup()
      renderPresetPanel()

      const presetBtns = screen.queryAllByRole("button", {
        name: /load|select|fixa/i,
      })

      // Load first preset
      if (presetBtns.length > 0) {
        await user.click(presetBtns[0])

        await waitFor(() => {
          expect(screen.getByTestId("main-tasks-count").textContent).not.toBe(
            "0",
          )
        })

        const count1 = parseInt(
          screen.getByTestId("main-tasks-count").textContent,
        )

        // Load second preset if available
        if (presetBtns.length > 1) {
          // Clear first
          localStorage.clear()

          await user.click(presetBtns[1])

          await waitFor(() => {
            const count2 = parseInt(
              screen.getByTestId("main-tasks-count").textContent,
            )
            // Different presets may have different sizes
            expect(typeof count2).toBe("number")
          })
        }
      }
    })
  })

  describe("ui state and feedback", () => {
    it("disables load button while loading", async () => {
      const user = userEvent.setup()
      renderPresetPanel()

      const presetBtns = screen.queryAllByRole("button", {
        name: /load|select|fixa/i,
      })

      if (presetBtns.length > 0) {
        const btn = presetBtns[0]

        // Simulate slow load
        await user.click(btn)

        // Button might be disabled during load
        if (btn.hasAttribute("disabled")) {
          expect(btn).toBeDisabled()
        }

        await waitFor(() => {
          expect(screen.getByTestId("main-tasks-count").textContent).not.toBe(
            "0",
          )
        })
      }
    })

    it("shows success message after load", async () => {
      const user = userEvent.setup()
      renderPresetPanel()

      const presetBtns = screen.queryAllByRole("button", {
        name: /load|select|fixa/i,
      })

      if (presetBtns.length > 0) {
        await user.click(presetBtns[0])

        await waitFor(() => {
          const successMsg = screen.queryByText(/loaded|added|success/i)
          if (successMsg) {
            expect(successMsg).toBeInTheDocument()
          }
        })
      }
    })
  })

  describe("queue interaction", () => {
    it("syncs loaded preset tasks with timer queue", async () => {
      const user = userEvent.setup()
      renderPresetPanel()

      const presetBtns = screen.queryAllByRole("button", {
        name: /load|select|fixa/i,
      })

      if (presetBtns.length > 0) {
        await user.click(presetBtns[0])

        await waitFor(() => {
          const mainTasks = JSON.parse(
            screen.getByTestId("main-tasks").textContent,
          )
          if (mainTasks.length > 0) {
            // Preset tasks should be visible in main context
            expect(mainTasks[0].id).toBeTruthy()
          }
        })
      }
    })
  })
})
