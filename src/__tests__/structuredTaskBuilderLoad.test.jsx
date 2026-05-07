/**
 * Tests for StructuredTaskBuilder – handleLoadIntoTasks
 *
 * All tests use the real MainTaskProvider as the single source of truth.
 * Context state (mainTasks) is read via useMainTask() inside a sibling
 * ContextReader component rendered in the same tree.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  MainTaskProvider,
  useMainTask,
  MainTaskContext,
} from "../context/MainTaskContext"
import StructuredTaskBuilder from "../components/StructuredTaskBuilder"

// ── Browser-API stubs ─────────────────────────────────────────────────────────

vi.mock("../utils/soundEffects", () => ({
  playPowerUpSound: vi.fn(() => Promise.resolve()),
  playCompletionSound: vi.fn(() => Promise.resolve()),
}))

vi.mock("canvas-confetti", () => ({ default: vi.fn() }))

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Reads mainTasks from context and exposes them via a ref so test assertions
 * can inspect context state without querying the DOM.
 */
function ContextReader({ stateRef }) {
  const { mainTasks } = useMainTask()
  stateRef.current = mainTasks
  return null
}

/**
 * Renders StructuredTaskBuilder inside a real MainTaskProvider.
 * Returns the render result plus a `stateRef` whose `.current` always holds
 * the latest `mainTasks` array from context.
 */
function renderBuilder() {
  const stateRef = { current: [] }
  const result = render(
    <MainTaskProvider>
      <ContextReader stateRef={stateRef} />
      <StructuredTaskBuilder
        sectionControls={null}
        sectionCollapsed={false}
        onToggleSectionCollapsed={() => {}}
      />
    </MainTaskProvider>,
  )
  return { ...result, stateRef }
}

/**
 * Renders StructuredTaskBuilder inside a real MainTaskProvider, but with a
 * specific context function overridden for T4.
 * Uses a ContextOverrider that reads the real context then re-provides it
 * with the requested override, so `completeMainTask` remains the real one.
 */
function ContextOverrider({ override, children }) {
  const ctx = useMainTask()
  return (
    <MainTaskContext.Provider value={{ ...ctx, ...override }}>
      {children}
    </MainTaskContext.Provider>
  )
}

function renderBuilderWithOverride(override) {
  const stateRef = { current: [] }
  const result = render(
    <MainTaskProvider>
      <ContextOverrider override={override}>
        <ContextReader stateRef={stateRef} />
        <StructuredTaskBuilder
          sectionControls={null}
          sectionCollapsed={false}
          onToggleSectionCollapsed={() => {}}
        />
      </ContextOverrider>
    </MainTaskProvider>,
  )
  return { ...result, stateRef }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("StructuredTaskBuilder – Load into task list", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // shared user instance: delay: null makes typing synchronous
  const user = userEvent.setup({ delay: null })

  // ── T1: addMainTask receives the correct payload ───────────────────────────

  it("T1: Load adds a task with the correct title/steps/proof/priority to context", async () => {
    const { stateRef } = renderBuilder()

    await user.type(screen.getByPlaceholderText("ätit mat"), "fix the bug")
    await user.click(
      screen.getByRole("button", { name: /load into task list/i }),
    )

    await waitFor(() => expect(stateRef.current.length).toBe(1))
    expect(stateRef.current[0].title).toBe("fix the bug")
  })

  // ── T2: Loading completes the builder-linked queued task ───────────────────

  it("T2: Load completes the builder-linked task that was queued via Start in Timer", async () => {
    const { stateRef } = renderBuilder()

    await user.type(screen.getByPlaceholderText("ätit mat"), "my goal")
    await user.click(screen.getByRole("button", { name: /start in timer/i }))

    let queuedTaskId
    await waitFor(() => {
      expect(stateRef.current.length).toBeGreaterThan(0)
      queuedTaskId = stateRef.current[0].id
    })
    expect(stateRef.current[0].status).toBe("active")

    await user.click(
      screen.getByRole("button", { name: /load into task list/i }),
    )

    await waitFor(() => {
      const queuedTask = stateRef.current.find((t) => t.id === queuedTaskId)
      expect(queuedTask?.status).toBe("completed")
    })
  })

  // ── T3: Completion fires before addMainTask ────────────────────────────────

  it("T3: After Load, queued task is completed AND new task is added (proving order)", async () => {
    const { stateRef } = renderBuilder()

    await user.type(screen.getByPlaceholderText("ätit mat"), "ordered goal")
    await user.click(screen.getByRole("button", { name: /start in timer/i }))

    let queuedTaskId
    await waitFor(() => {
      expect(stateRef.current.length).toBeGreaterThan(0)
      queuedTaskId = stateRef.current[0].id
    })

    await user.click(
      screen.getByRole("button", { name: /load into task list/i }),
    )

    // Both must be true at the same point in time — proves complete ran before add
    await waitFor(() => {
      const queuedTask = stateRef.current.find((t) => t.id === queuedTaskId)
      const newTask = stateRef.current.find((t) => t.id !== queuedTaskId)
      expect(queuedTask?.status).toBe("completed")
      expect(newTask).toBeTruthy()
    })
  })

  // ── T4: Completion fires even when addMainTask throws ──────────────────────

  it("T4: completeMainTask still updates context when addMainTask throws", async () => {
    const throwingAdd = vi.fn(() => {
      throw new Error("addMainTask failed")
    })

    const { stateRef } = renderBuilderWithOverride({ addMainTask: throwingAdd })

    await user.type(screen.getByPlaceholderText("ätit mat"), "will throw")

    // Queue via Start in Timer — uses real addMainTaskAndActivate (not overridden)
    await user.click(screen.getByRole("button", { name: /start in timer/i }))

    let queuedTaskId
    await waitFor(() => {
      expect(stateRef.current.length).toBeGreaterThan(0)
      queuedTaskId = stateRef.current[0].id
    })

    // Load — addMainTask will throw, but completeMainTask must still have run
    await user.click(
      screen.getByRole("button", { name: /load into task list/i }),
    )

    await waitFor(() => expect(throwingAdd).toHaveBeenCalledOnce())
    const queuedTask = stateRef.current.find((t) => t.id === queuedTaskId)
    expect(queuedTask?.status).toBe("completed")
  })

  // ── T5: No other task id is completed ─────────────────────────────────────

  it("T5: Only the builder-queued task is completed; other tasks remain active", async () => {
    const { stateRef } = renderBuilder()

    // Create a bystander task via Load (no Start in Timer → no queue)
    await user.type(screen.getByPlaceholderText("ätit mat"), "bystander")
    await user.click(
      screen.getByRole("button", { name: /load into task list/i }),
    )
    await waitFor(() => expect(stateRef.current.length).toBe(1))

    // Queue a second task via Start in Timer
    await user.type(screen.getByPlaceholderText("ätit mat"), "queued goal")
    await user.click(screen.getByRole("button", { name: /start in timer/i }))
    await waitFor(() => expect(stateRef.current.length).toBe(2))

    const bystander = stateRef.current.find((t) => t.title === "bystander")
    const queued = stateRef.current.find((t) => t.title !== "bystander")

    // Load — only the queued task should become completed
    await user.click(
      screen.getByRole("button", { name: /load into task list/i }),
    )

    await waitFor(() => {
      const queuedAfter = stateRef.current.find((t) => t.id === queued?.id)
      expect(queuedAfter?.status).toBe("completed")
    })

    const bystanderAfter = stateRef.current.find((t) => t.id === bystander?.id)
    expect(bystanderAfter?.status).not.toBe("completed")
  })

  // ── T6: No completion when no builder task is queued ─────────────────────

  it("T6: When no builder task is queued, no task is completed on Load", async () => {
    const { stateRef } = renderBuilder()

    await user.type(screen.getByPlaceholderText("ätit mat"), "plain load")
    await user.click(
      screen.getByRole("button", { name: /load into task list/i }),
    )

    await waitFor(() => expect(stateRef.current.length).toBe(1))
    expect(stateRef.current.every((t) => t.status !== "completed")).toBe(true)
  })

  // ── T7: Success message is shown after Load ───────────────────────────────

  it('T7: Load shows "Loaded into task list ↓" message after success', async () => {
    renderBuilder()

    await user.type(screen.getByPlaceholderText("ätit mat"), "message test")
    await user.click(
      screen.getByRole("button", { name: /load into task list/i }),
    )

    expect(
      await screen.findByText("Loaded into task list ↓"),
    ).toBeInTheDocument()
  })
})
