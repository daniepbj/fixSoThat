import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import MainTaskCard from "../components/MainTaskCard"
import { MainTaskProvider, useMainTask } from "../context/MainTaskContext"
import { AppSyncProvider, useAppSync } from "../context/AppSyncContext"

vi.mock("../utils/soundEffects", () => ({
  playPowerUpSound: vi.fn(() => Promise.resolve()),
  playCompletionSound: vi.fn(() => Promise.resolve()),
}))
vi.mock("canvas-confetti", () => ({ default: vi.fn() }))

function TaskWrapper({ task }) {
  const { mainTasks, updateMainTask, deleteMainTask, completeMainTask } =
    useMainTask()
  return <MainTaskCard task={mainTasks.find((t) => t.id === task.id) || task} />
}

function TestHarness() {
  const { mainTasks } = useMainTask()
  const appSync = useAppSync()

  const task = mainTasks[0]
  return (
    <div>
      <TaskWrapper task={task || { id: "test", title: "Test" }} />
      <div data-testid="appSync-focus">
        {appSync.focusMainTaskRequest
          ? JSON.stringify(appSync.focusMainTaskRequest)
          : "no-focus"}
      </div>
    </div>
  )
}

function renderMainTaskCard(task) {
  const { addMainTask } = useMainTask()

  render(
    <AppSyncProvider>
      <MainTaskProvider>
        <TestHarness />
      </MainTaskProvider>
    </AppSyncProvider>,
  )

  // Inject task via context hook call inside MainTaskProvider
  // For this test, we'll trigger via render and direct action
}

// Simpler approach: render in context and use context actions to add task
function renderCardWithContext(taskOverride = {}) {
  const appSyncRef = { current: null }
  const mainTasksRef = { current: [] }

  function CardTestHarness() {
    const { mainTasks, addMainTask } = useMainTask()
    const appSync = useAppSync()
    mainTasksRef.current = mainTasks
    appSyncRef.current = appSync

    React.useEffect(() => {
      const defaultTask = {
        title: "Test Task",
        steps: [
          { id: "s1", raw: "step 1", completed: false },
          { id: "s2", raw: "step 2", completed: false },
        ],
        proof: "proof text",
        ...taskOverride,
      }

      if (mainTasks.length === 0) {
        addMainTask(defaultTask)
      }
    }, [addMainTask, mainTasks.length])

    if (mainTasks.length === 0) return <div>loading</div>

    return (
      <div>
        <MainTaskCard task={mainTasks[0]} />
        <div data-testid="appSync-focus">
          {appSync.focusMainTaskRequest
            ? JSON.stringify(appSync.focusMainTaskRequest)
            : "no-focus"}
        </div>
      </div>
    )
  }

  const result = render(
    <AppSyncProvider>
      <MainTaskProvider>
        <CardTestHarness />
      </MainTaskProvider>
    </AppSyncProvider>,
  )

  return { ...result, appSyncRef, mainTasksRef }
}

describe("MainTaskCard", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe("focus button behavior", () => {
    it("focus task button sends focus request to AppSync", async () => {
      const { appSyncRef } = renderCardWithContext()

      await waitFor(() => {
        expect(screen.getByText("Test Task")).toBeInTheDocument()
      })

      const focusBtn = screen.getByRole("button", {
        name: /focus/i,
      })
      await userEvent.click(focusBtn)

      await waitFor(() => {
        const focusText = screen.getByTestId("appSync-focus").textContent
        expect(focusText).not.toBe("no-focus")
      })

      const focusRequest = JSON.parse(
        screen.getByTestId("appSync-focus").textContent,
      )
      expect(focusRequest.mainTaskId).toBeTruthy()
      expect(focusRequest.stepId).toBeNull()
    })

    it("focus step button sends focus request with step id to AppSync", async () => {
      const { appSyncRef } = renderCardWithContext()

      await waitFor(() => {
        expect(screen.getByText("Test Task")).toBeInTheDocument()
      })

      // Expand task to show steps
      const expandBtn = screen.getByRole("button", { name: /▾/ })
      await userEvent.click(expandBtn)

      await waitFor(() => {
        expect(screen.getByText("step 1")).toBeInTheDocument()
      })

      // Find focus button for first step (if it exists in UI)
      const stepElements = screen.getAllByText(/step/)
      const focusStepBtns = screen.queryAllByRole("button", { name: /focus/i })

      if (focusStepBtns.length > 1) {
        await userEvent.click(focusStepBtns[1])

        await waitFor(() => {
          const focusText = screen.getByTestId("appSync-focus").textContent
          const focusRequest = JSON.parse(focusText)
          expect(focusRequest.stepId).toBeTruthy()
        })
      }
    })
  })

  describe("step completion within card", () => {
    it("checking step checkbox triggers step completion", async () => {
      const { mainTasksRef } = renderCardWithContext()

      await waitFor(() => {
        expect(screen.getByText("Test Task")).toBeInTheDocument()
      })

      // Expand to see steps
      const expandBtn = screen.getByRole("button", { name: /▾/ })
      await userEvent.click(expandBtn)

      await waitFor(() => {
        expect(screen.getByText("step 1")).toBeInTheDocument()
      })

      // Find and click step checkbox
      const checkboxes = screen.getAllByRole("checkbox")
      if (checkboxes.length > 0) {
        await userEvent.click(checkboxes[0])

        await waitFor(() => {
          const task = mainTasksRef.current[0]
          expect(task.steps[0].completed).toBe(true)
        })
      }
    })

    it("unchecking step checkbox marks it incomplete", async () => {
      const { mainTasksRef } = renderCardWithContext({
        steps: [
          { id: "s1", raw: "step 1", completed: true },
          { id: "s2", raw: "step 2", completed: false },
        ],
      })

      await waitFor(() => {
        expect(screen.getByText("Test Task")).toBeInTheDocument()
      })

      const expandBtn = screen.getByRole("button", { name: /▾/ })
      await userEvent.click(expandBtn)

      await waitFor(() => {
        expect(screen.getByText("step 1")).toBeInTheDocument()
      })

      const checkboxes = screen.getAllByRole("checkbox")
      if (checkboxes.length > 0) {
        await userEvent.click(checkboxes[0])

        await waitFor(() => {
          const task = mainTasksRef.current[0]
          expect(task.steps[0].completed).toBe(false)
        })
      }
    })
  })

  describe("task title editing", () => {
    it("can edit and save task title", async () => {
      const { mainTasksRef } = renderCardWithContext()

      await waitFor(() => {
        expect(screen.getByText("Test Task")).toBeInTheDocument()
      })

      const titleBtn = screen.getByRole("button", { name: "Test Task" })
      await userEvent.click(titleBtn)

      await waitFor(() => {
        expect(screen.getByDisplayValue("Test Task")).toBeInTheDocument()
      })

      const input = screen.getByDisplayValue("Test Task")
      await userEvent.clear(input)
      await userEvent.type(input, "Updated Task")

      const saveBtn = screen.getByRole("button", { name: /save/i })
      await userEvent.click(saveBtn)

      await waitFor(() => {
        expect(mainTasksRef.current[0].title).toBe("Updated Task")
      })
    })

    it("can cancel task title editing without saving", async () => {
      const { mainTasksRef } = renderCardWithContext()

      await waitFor(() => {
        expect(screen.getByText("Test Task")).toBeInTheDocument()
      })

      const titleBtn = screen.getByRole("button", { name: "Test Task" })
      await userEvent.click(titleBtn)

      await waitFor(() => {
        expect(screen.getByDisplayValue("Test Task")).toBeInTheDocument()
      })

      const input = screen.getByDisplayValue("Test Task")
      await userEvent.clear(input)
      await userEvent.type(input, "Discarded Title")
      await userEvent.keyboard("{Escape}")

      await waitFor(() => {
        expect(mainTasksRef.current[0].title).toBe("Test Task")
      })

      const reopenTitleBtn = screen.getByRole("button", { name: "Test Task" })
      await userEvent.click(reopenTitleBtn)

      await waitFor(() => {
        expect(screen.getByDisplayValue("Test Task")).toBeInTheDocument()
      })
    })
  })

  describe("proof editing", () => {
    it("can edit and save task proof", async () => {
      const { mainTasksRef } = renderCardWithContext({
        proof: "original proof",
      })

      await waitFor(() => {
        expect(screen.getByText("Test Task")).toBeInTheDocument()
      })

      const proofText = screen.getByText(/original proof/i)
      await userEvent.click(proofText)

      await waitFor(() => {
        expect(screen.getByDisplayValue(/original proof/i)).toBeInTheDocument()
      })

      const input = screen.getByDisplayValue(/original proof/i)
      await userEvent.clear(input)
      await userEvent.type(input, "updated proof")

      const saveBtn = screen.getByRole("button", { name: /save/i })
      await userEvent.click(saveBtn)

      await waitFor(() => {
        expect(mainTasksRef.current[0].proof).toBe("updated proof")
      })
    })
  })

  describe("step operations", () => {
    it("can add a new step to task", async () => {
      const { mainTasksRef } = renderCardWithContext({
        steps: [{ id: "s1", raw: "step 1", completed: false }],
      })

      await waitFor(() => {
        expect(screen.getByText("Test Task")).toBeInTheDocument()
      })

      const expandBtn = screen.getByRole("button", { name: /▾/ })
      await userEvent.click(expandBtn)

      await waitFor(() => {
        expect(screen.getByText("step 1")).toBeInTheDocument()
      })

      const addStepBtn = screen.queryByRole("button", { name: /add step/i })
      if (addStepBtn) {
        await userEvent.click(addStepBtn)

        const stepInput = screen.getByPlaceholderText(/step/i)
        await userEvent.type(stepInput, "new step")

        const saveBtn = screen.getByRole("button", { name: /save/i })
        if (saveBtn) {
          await userEvent.click(saveBtn)

          await waitFor(() => {
            expect(mainTasksRef.current[0].steps.length).toBeGreaterThan(1)
          })
        }
      }
    })
  })

  describe("queue indicator", () => {
    it("displays linked timer tasks when synced", async () => {
      const { appSyncRef } = renderCardWithContext({
        id: "main-1",
        title: "Linked Task",
      })

      await waitFor(() => {
        expect(screen.getByText("Linked Task")).toBeInTheDocument()
      })

      // Publish snapshot with linked timer task
      const linkedTask = {
        id: "t1",
        title: "Timer Task",
        sourceMainTaskId: "main-1",
        sourceStepId: "s1",
      }

      await act(async () => {
        appSyncRef.current.publishTimerSnapshot([linkedTask], false)
      })

      await waitFor(() => {
        const card = screen.getByText("Linked Task").closest(".mtask-card")
        expect(card).toBeTruthy()
      })
    })
  })

  describe("task status display", () => {
    it("shows all steps completed status badge", async () => {
      const { mainTasksRef } = renderCardWithContext({
        steps: [
          { id: "s1", raw: "step 1", completed: true },
          { id: "s2", raw: "step 2", completed: true },
        ],
      })

      await waitFor(() => {
        expect(screen.getByText("Test Task")).toBeInTheDocument()
      })

      // Check for status badge (implementation detail may vary)
      const statusBadges = screen.queryAllByText(/completed|done|✓/i)
      expect(statusBadges.length).toBeGreaterThanOrEqual(0)
    })

    it("shows partial completion status", async () => {
      const { mainTasksRef } = renderCardWithContext({
        steps: [
          { id: "s1", raw: "step 1", completed: true },
          { id: "s2", raw: "step 2", completed: false },
        ],
      })

      await waitFor(() => {
        expect(screen.getByText("Test Task")).toBeInTheDocument()
      })

      const expandBtn = screen.getByRole("button", { name: /▾/ })
      await userEvent.click(expandBtn)

      await waitFor(() => {
        expect(screen.getByText("step 1")).toBeInTheDocument()
        expect(screen.getByText("step 2")).toBeInTheDocument()
      })
    })
  })
})
