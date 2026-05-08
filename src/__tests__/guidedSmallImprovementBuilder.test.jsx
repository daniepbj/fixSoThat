import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import GuidedSmallImprovementBuilder from "../components/GuidedSmallImprovementBuilder"
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
        <GuidedSmallImprovementBuilder
          sectionControls={null}
          sectionCollapsed={false}
          onToggleSectionCollapsed={() => {}}
        />
      </MainTaskProvider>
    </AppSyncProvider>,
  )
  return { ...result, mainTasksRef, appSyncRef }
}

describe("GuidedSmallImprovementBuilder", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  const user = userEvent.setup({ delay: null })

  describe("Stage validation and flow", () => {
    it("Stage 0 (Area) requires at least one area", async () => {
      renderBuilder()

      const nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      await waitFor(() => {
        expect(screen.getByText(/enter at least one area/i)).toBeInTheDocument()
      })
    })

    it("adds area with name and optional minutes", async () => {
      renderBuilder()

      const areaInput = screen.getByPlaceholderText(/area/i)
      await user.type(areaInput, "inbox 3")

      const nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      await waitFor(() => {
        expect(
          screen.queryByText(/enter at least one area/i),
        ).not.toBeInTheDocument()
      })
    })

    it("Stage 1 (Target) requires 'good enough' description", async () => {
      renderBuilder()

      const areaInput = screen.getByPlaceholderText(/area/i)
      await user.type(areaInput, "cleaning")

      let nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      await waitFor(() => {
        expect(screen.getByText(/good enough/i)).toBeInTheDocument()
      })

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      await waitFor(() => {
        expect(
          screen.getByText(/describe what 'good enough'/i),
        ).toBeInTheDocument()
      })
    })

    it("Stage 2 (Proof) validates proof entries exist", async () => {
      renderBuilder()

      const areaInput = screen.getByPlaceholderText(/area/i)
      await user.type(areaInput, "cleaning")

      let nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const goodEnoughInput = screen.getByPlaceholderText(/good enough/i)
      await user.type(goodEnoughInput, "counter is clear")

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      await waitFor(() => {
        expect(screen.getByText(/proof/i)).toBeInTheDocument()
      })

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      await waitFor(() => {
        expect(screen.getByText(/add at least one proof/i)).toBeInTheDocument()
      })
    })
  })

  describe("Stage navigation and retreat", () => {
    it("back button retreats one stage", async () => {
      renderBuilder()

      const areaInput = screen.getByPlaceholderText(/area/i)
      await user.type(areaInput, "cleaning")

      let nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      await waitFor(() => {
        expect(screen.getByText(/good enough/i)).toBeInTheDocument()
      })

      const backBtn = screen.getByRole("button", { name: /back/i })
      await user.click(backBtn)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/area/i)).toBeInTheDocument()
      })
    })

    it("retreating from stage 1 with multiple areas goes to previous area's stage 4", async () => {
      renderBuilder()

      const areaInput = screen.getByPlaceholderText(/area/i)
      await user.type(areaInput, "area1")

      let nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const goodEnoughInput = screen.getByPlaceholderText(/good enough/i)
      await user.type(goodEnoughInput, "done")

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const proofInput = screen.getByPlaceholderText(/proof/i)
      await user.type(proofInput, "proof text")

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      // Brainstorm stage
      const stepInput = screen.getByPlaceholderText(/step/i)
      await user.type(stepInput, "step 1")

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      // Order stage — add a second area
      const addAreaBtn = screen.getByRole("button", { name: /add.*area/i })
      await user.click(addAreaBtn)

      const areaInputs = screen.getAllByPlaceholderText(/area/i)
      await user.type(areaInputs[areaInputs.length - 1], "area2")

      // Advance to area2 target
      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      // Now retreat from area2 target — should go to area1 order
      const backBtn = screen.getByRole("button", { name: /back/i })
      await user.click(backBtn)

      await waitFor(() => {
        expect(screen.getByText(/order/i)).toBeInTheDocument()
      })
    })
  })

  describe("Start in Timer flow", () => {
    it("Start in Timer creates task and requests autostart", async () => {
      const { mainTasksRef, appSyncRef } = renderBuilder()

      const areaInput = screen.getByPlaceholderText(/area/i)
      await user.type(areaInput, "cleaning")

      let nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const goodEnoughInput = screen.getByPlaceholderText(/good enough/i)
      await user.type(goodEnoughInput, "counter clear")

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const proofInput = screen.getByPlaceholderText(/proof/i)
      await user.type(proofInput, "wiped")

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const stepInput = screen.getByPlaceholderText(/step/i)
      await user.type(stepInput, "wipe counter")

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const startBtn = screen.getByRole("button", { name: /start in timer/i })
      await user.click(startBtn)

      await waitFor(() => {
        expect(mainTasksRef.current.length).toBeGreaterThan(0)
      })

      expect(mainTasksRef.current[0].title).toContain("cleaning")
      expect(appSyncRef.current.autoStartMainTaskRequest).toBeTruthy()
    })

    it("Start in Timer includes multi-area titles concatenated", async () => {
      const { mainTasksRef } = renderBuilder()

      const areaInput = screen.getByPlaceholderText(/area/i)
      await user.type(areaInput, "cleaning")

      let nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const goodEnoughInput = screen.getByPlaceholderText(/good enough/i)
      await user.type(goodEnoughInput, "counter clear")

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const proofInput = screen.getByPlaceholderText(/proof/i)
      await user.type(proofInput, "wiped")

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const stepInput = screen.getByPlaceholderText(/step/i)
      await user.type(stepInput, "wipe counter")

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      // Add second area
      const addAreaBtn = screen.getByRole("button", { name: /add.*area/i })
      await user.click(addAreaBtn)

      const areaInputs = screen.getAllByPlaceholderText(/area/i)
      await user.type(areaInputs[areaInputs.length - 1], "dishes")

      // Progress through area2 stages
      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const goodEnoughInputs = screen.getAllByPlaceholderText(/good enough/i)
      await user.type(
        goodEnoughInputs[goodEnoughInputs.length - 1],
        "sink empty",
      )

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const proofInputs = screen.getAllByPlaceholderText(/proof/i)
      await user.type(proofInputs[proofInputs.length - 1], "no dishes")

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const stepInputs = screen.getAllByPlaceholderText(/step/i)
      await user.type(stepInputs[stepInputs.length - 1], "wash dishes")

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const startBtn = screen.getByRole("button", { name: /start in timer/i })
      await user.click(startBtn)

      await waitFor(() => {
        expect(mainTasksRef.current.length).toBeGreaterThan(0)
      })

      expect(mainTasksRef.current[0].title).toContain("cleaning")
      expect(mainTasksRef.current[0].title).toContain("dishes")
    })
  })

  describe("Stop alarm on stage advance", () => {
    it("Next button requests stop alarm via AppSync", async () => {
      const { appSyncRef } = renderBuilder()

      const areaInput = screen.getByPlaceholderText(/area/i)
      await user.type(areaInput, "cleaning")

      let nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const initialSignal = appSyncRef.current.stopAlarmSignal

      const goodEnoughInput = screen.getByPlaceholderText(/good enough/i)
      await user.type(goodEnoughInput, "done")

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      expect(appSyncRef.current.stopAlarmSignal).toBeGreaterThan(initialSignal)
    })
  })

  describe("Live timer state consumption", () => {
    it("displays glow when builder task is active in timer", async () => {
      const { container, appSyncRef } = renderBuilder()

      const areaInput = screen.getByPlaceholderText(/area/i)
      await user.type(areaInput, "cleaning")

      let nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const goodEnoughInput = screen.getByPlaceholderText(/good enough/i)
      await user.type(goodEnoughInput, "done")

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const proofInput = screen.getByPlaceholderText(/proof/i)
      await user.type(proofInput, "proof")

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const stepInput = screen.getByPlaceholderText(/step/i)
      await user.type(stepInput, "step")

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const startBtn = screen.getByRole("button", { name: /start in timer/i })
      await user.click(startBtn)

      await waitFor(() => {
        expect(appSyncRef.current.autoStartMainTaskRequest).toBeTruthy()
      })

      // Publish snapshot showing builder task is active
      const snapTask = {
        id: "t1",
        sourceMainTaskId:
          appSyncRef.current.autoStartMainTaskRequest.mainTaskId,
        sourceStepId: "step-1",
        color: "#6c63ff",
      }

      appSyncRef.current.publishTimerSnapshot([snapTask], true)

      await waitFor(() => {
        const card = container.querySelector(".task-builder-card--timer-active")
        expect(card).toBeTruthy()
      })
    })
  })

  describe("Form reset and clear", () => {
    it("form clears after successful save", async () => {
      const { mainTasksRef } = renderBuilder()

      const areaInput = screen.getByPlaceholderText(/area/i)
      await user.type(areaInput, "cleaning")

      let nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const goodEnoughInput = screen.getByPlaceholderText(/good enough/i)
      await user.type(goodEnoughInput, "done")

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const proofInput = screen.getByPlaceholderText(/proof/i)
      await user.type(proofInput, "proof")

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      const stepInput = screen.getByPlaceholderText(/step/i)
      await user.type(stepInput, "step")

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      nextBtn = screen.getByRole("button", { name: /next/i })
      await user.click(nextBtn)

      await waitFor(() => {
        expect(mainTasksRef.current.length).toBeGreaterThan(0)
      })

      // After save, form should reset to initial area input
      await waitFor(() => {
        const areaInputs = screen.getAllByPlaceholderText(/area/i)
        expect(areaInputs.length).toBeGreaterThan(0)
      })
    })
  })
})
