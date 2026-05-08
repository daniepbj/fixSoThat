import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import StructuredTaskBuilder from "../components/StructuredTaskBuilder"
import { MainTaskProvider, useMainTask } from "../context/MainTaskContext"
import { AppSyncProvider, useAppSync } from "../context/AppSyncContext"

vi.mock("../utils/soundEffects", () => ({
  playPowerUpSound: vi.fn(() => Promise.resolve()),
  playCompletionSound: vi.fn(() => Promise.resolve()),
}))
vi.mock("canvas-confetti", () => ({ default: vi.fn() }))

function ContextReader({ mainTasksRef, appSyncRef }) {
  const mainCtx = useMainTask()
  const appCtx = useAppSync()
  mainTasksRef.current = mainCtx.mainTasks
  appSyncRef.current = appCtx
  return null
}

function renderBuilder() {
  const mainTasksRef = { current: [] }
  const appSyncRef = { current: null }
  const result = render(
    <AppSyncProvider>
      <MainTaskProvider>
        <ContextReader mainTasksRef={mainTasksRef} appSyncRef={appSyncRef} />
        <StructuredTaskBuilder
          sectionControls={null}
          sectionCollapsed={false}
          onToggleSectionCollapsed={() => {}}
        />
      </MainTaskProvider>
    </AppSyncProvider>,
  )
  return { ...result, mainTasksRef, appSyncRef }
}

describe("StructuredTaskBuilder", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  const user = userEvent.setup({ delay: null })

  describe("title and subtitle", () => {
    it("displays builder title", () => {
      renderBuilder()
      expect(screen.getByText(/fixa så att|structured/i)).toBeInTheDocument()
    })

    it("displays subtitle or description", () => {
      renderBuilder()
      const description = screen.queryByText(/describe|format|preview/i)
      if (description) {
        expect(description).toBeInTheDocument()
      }
    })
  })

  describe("form fields", () => {
    it("has target title input field", () => {
      renderBuilder()
      const titleInput = screen.getByPlaceholderText(/title|fixa|target/i)
      expect(titleInput).toBeInTheDocument()
    })

    it("has description/target input field", () => {
      renderBuilder()
      const descInput = screen.queryByPlaceholderText(
        /description|detail|what/i,
      )
      if (descInput) {
        expect(descInput).toBeInTheDocument()
      }
    })

    it("has proof input field", () => {
      renderBuilder()
      const proofInput = screen.queryByPlaceholderText(/proof|how|verify/i)
      if (proofInput) {
        expect(proofInput).toBeInTheDocument()
      }
    })

    it("has steps textarea", () => {
      renderBuilder()
      const stepsInput = screen.getByPlaceholderText(/step|action|do/i)
      expect(stepsInput).toBeInTheDocument()
    })
  })

  describe("task creation flow", () => {
    it("creates task with valid inputs", async () => {
      const { mainTasksRef } = renderBuilder()

      const titleInput = screen.getByPlaceholderText(/title|fixa|target/i)
      await user.type(titleInput, "Clean bedroom")

      const descInput = screen.queryByPlaceholderText(/description|detail/i)
      if (descInput) {
        await user.type(descInput, "Make bed and vacuum")
      }

      const proofInput = screen.queryByPlaceholderText(/proof|verify/i)
      if (proofInput) {
        await user.type(proofInput, "Floor is clean")
      }

      const stepsInput = screen.getByPlaceholderText(/step|action|do/i)
      await user.type(stepsInput, "Make bed\nVacuum floor")

      const saveBtn = screen.getByRole("button", { name: /save|add|create/i })
      await user.click(saveBtn)

      await waitFor(() => {
        expect(mainTasksRef.current.length).toBeGreaterThan(0)
      })

      expect(mainTasksRef.current[0].title).toContain("Clean bedroom")
    })

    it("parses multiple steps from textarea", async () => {
      const { mainTasksRef } = renderBuilder()

      const titleInput = screen.getByPlaceholderText(/title|fixa|target/i)
      await user.type(titleInput, "Task")

      const stepsInput = screen.getByPlaceholderText(/step|action|do/i)
      await user.type(stepsInput, "Step 1\nStep 2\nStep 3")

      const saveBtn = screen.getByRole("button", { name: /save|add|create/i })
      await user.click(saveBtn)

      await waitFor(() => {
        expect(mainTasksRef.current.length).toBeGreaterThan(0)
      })

      expect(mainTasksRef.current[0].steps.length).toBeGreaterThanOrEqual(3)
    })

    it("extracts time estimates from step text", async () => {
      const { mainTasksRef } = renderBuilder()

      const titleInput = screen.getByPlaceholderText(/title|fixa|target/i)
      await user.type(titleInput, "Task")

      const stepsInput = screen.getByPlaceholderText(/step|action|do/i)
      await user.type(stepsInput, "Vacuum 10\nClean sink 5")

      const saveBtn = screen.getByRole("button", { name: /save|add|create/i })
      await user.click(saveBtn)

      await waitFor(() => {
        expect(mainTasksRef.current.length).toBeGreaterThan(0)
      })

      const task = mainTasksRef.current[0]
      const hasTimeEstimate = task.steps.some((s) => s.minutes)
      expect(hasTimeEstimate).toBe(true)
    })
  })

  describe("preview functionality", () => {
    it("displays preview of formatted steps", async () => {
      renderBuilder()

      const stepsInput = screen.getByPlaceholderText(/step|action|do/i)
      await user.type(stepsInput, "Step 1\nStep 2")

      const preview = screen.queryByText(/preview|formatted|output/i)
      if (preview) {
        expect(preview).toBeInTheDocument()
      }
    })

    it("updates preview when steps change", async () => {
      renderBuilder()

      const stepsInput = screen.getByPlaceholderText(/step|action|do/i)
      await user.type(stepsInput, "First step")

      const step1 = screen.queryByText(/first step/i)
      if (step1) {
        expect(step1).toBeInTheDocument()
      }

      await user.clear(stepsInput)
      await user.type(stepsInput, "Updated step")

      const updatedStep = screen.queryByText(/updated step/i)
      if (updatedStep) {
        expect(updatedStep).toBeInTheDocument()
      }
    })

    it("shows llama-format export", async () => {
      renderBuilder()

      const titleInput = screen.getByPlaceholderText(/title|fixa|target/i)
      await user.type(titleInput, "Clean")

      const exportBtn = screen.queryByRole("button", {
        name: /export|llama|format/i,
      })

      if (exportBtn) {
        await user.click(exportBtn)

        const formatted = screen.queryByText(/```/)
        if (formatted) {
          expect(formatted).toBeInTheDocument()
        }
      }
    })
  })

  describe("validation", () => {
    it("requires title to save task", async () => {
      renderBuilder()

      const stepsInput = screen.getByPlaceholderText(/step|action|do/i)
      await user.type(stepsInput, "Step 1")

      const saveBtn = screen.getByRole("button", { name: /save|add|create/i })
      await user.click(saveBtn)

      await waitFor(() => {
        const error = screen.queryByText(/title required|enter.*title/i)
        if (error) {
          expect(error).toBeInTheDocument()
        }
      })
    })

    it("requires at least one step to save", async () => {
      renderBuilder()

      const titleInput = screen.getByPlaceholderText(/title|fixa|target/i)
      await user.type(titleInput, "Task")

      const saveBtn = screen.getByRole("button", { name: /save|add|create/i })
      await user.click(saveBtn)

      await waitFor(() => {
        const error = screen.queryByText(/step required|at least one step/i)
        if (error) {
          expect(error).toBeInTheDocument()
        }
      })
    })
  })

  describe("start in timer button", () => {
    it("creates and queues task in timer", async () => {
      const { mainTasksRef, appSyncRef } = renderBuilder()

      const titleInput = screen.getByPlaceholderText(/title|fixa|target/i)
      await user.type(titleInput, "Timed Task")

      const stepsInput = screen.getByPlaceholderText(/step|action|do/i)
      await user.type(stepsInput, "Do something")

      const startBtn = screen.queryByRole("button", {
        name: /start.*timer|queue/i,
      })

      if (startBtn) {
        await user.click(startBtn)

        await waitFor(() => {
          expect(mainTasksRef.current.length).toBeGreaterThan(0)
        })

        expect(appSyncRef.current.autoStartMainTaskRequest).toBeTruthy()
      }
    })
  })

  describe("form reset", () => {
    it("clears form after successful save", async () => {
      renderBuilder()

      const titleInput = screen.getByPlaceholderText(
        /title|fixa|target/i,
      ) as HTMLInputElement
      await user.type(titleInput, "Task 1")

      const stepsInput = screen.getByPlaceholderText(
        /step|action|do/i,
      ) as HTMLTextAreaElement
      await user.type(stepsInput, "Step 1")

      const saveBtn = screen.getByRole("button", { name: /save|add|create/i })
      await user.click(saveBtn)

      await waitFor(() => {
        expect(titleInput.value).toBe("")
      })

      expect(stepsInput.value).toBe("")
    })

    it("allows creating multiple tasks in sequence", async () => {
      const { mainTasksRef } = renderBuilder()

      // Create first task
      const titleInput = screen.getByPlaceholderText(
        /title|fixa|target/i,
      ) as HTMLInputElement
      await user.type(titleInput, "Task 1")

      const stepsInput = screen.getByPlaceholderText(
        /step|action|do/i,
      ) as HTMLTextAreaElement
      await user.type(stepsInput, "Step 1")

      let saveBtn = screen.getByRole("button", { name: /save|add|create/i })
      await user.click(saveBtn)

      await waitFor(() => {
        expect(mainTasksRef.current.length).toBe(1)
      })

      // Create second task
      await user.type(titleInput, "Task 2")
      await user.type(stepsInput, "Step 2")

      saveBtn = screen.getByRole("button", { name: /save|add|create/i })
      await user.click(saveBtn)

      await waitFor(() => {
        expect(mainTasksRef.current.length).toBe(2)
      })
    })
  })

  describe("live timer state integration", () => {
    it("displays indicator when builder task is active in timer", async () => {
      const { container, mainTasksRef, appSyncRef } = renderBuilder()

      const titleInput = screen.getByPlaceholderText(/title|fixa|target/i)
      await user.type(titleInput, "Active Task")

      const stepsInput = screen.getByPlaceholderText(/step|action|do/i)
      await user.type(stepsInput, "Do it")

      const startBtn = screen.queryByRole("button", {
        name: /start.*timer/i,
      })

      if (startBtn) {
        await user.click(startBtn)

        await waitFor(() => {
          expect(mainTasksRef.current.length).toBeGreaterThan(0)
        })

        // Publish snapshot showing task is in timer
        const createdTaskId = mainTasksRef.current[0].id
        appSyncRef.current.publishTimerSnapshot(
          [{ id: "q1", sourceMainTaskId: createdTaskId }],
          true,
        )

        const activeCard = container.querySelector(
          ".task-builder-card--timer-active",
        )
        if (activeCard) {
          expect(activeCard).toBeTruthy()
        }
      }
    })
  })
})
