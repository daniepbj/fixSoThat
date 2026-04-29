/**
 * Tests for:
 *  1. Global focusFlash in MainTaskContext — pressed ▶ no longer highlighted
 *     the active step because flash was local to MainTaskCard. Fix: flash state
 *     lives in MainTaskContext so TimerApp can trigger it.
 *  2. queuedSteps derivation — MainTaskCard was polling fst_active localStorage
 *     (dead key) causing a blank page. Fix: live step data comes directly from
 *     queuedSteps in context (no polling, no prop drilling).
 */
import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import React from "react"
import { MainTaskProvider, useMainTask } from "../context/MainTaskContext"

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../utils/soundEffects", () => ({
  playPowerUpSound: vi.fn(() => Promise.resolve()),
  playCompletionSound: vi.fn(),
  playClickSound: vi.fn(),
}))

vi.mock("canvas-confetti", () => ({ default: vi.fn() }))

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrapper({ children }) {
  return React.createElement(MainTaskProvider, null, children)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MainTaskContext – focusFlash", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("triggerFocusFlash sets activeFocusFlash with taskId and stepId", () => {
    const { result } = renderHook(() => useMainTask(), { wrapper })

    act(() => {
      result.current.triggerFocusFlash("task-1", "step-abc")
    })

    expect(result.current.activeFocusFlash).toEqual({
      taskId: "task-1",
      stepId: "step-abc",
    })
  })

  it("triggerFocusFlash with no stepId sets stepId to null (task-level flash)", () => {
    const { result } = renderHook(() => useMainTask(), { wrapper })

    act(() => {
      result.current.triggerFocusFlash("task-1")
    })

    expect(result.current.activeFocusFlash).toEqual({
      taskId: "task-1",
      stepId: null,
    })
  })

  it("activeFocusFlash auto-clears after 1100 ms", () => {
    const { result } = renderHook(() => useMainTask(), { wrapper })

    act(() => {
      result.current.triggerFocusFlash("task-1", "step-abc")
    })

    expect(result.current.activeFocusFlash).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(1200)
    })

    expect(result.current.activeFocusFlash).toBeNull()
  })

  it("activeFocusFlash is still set just before 1100 ms", () => {
    const { result } = renderHook(() => useMainTask(), { wrapper })

    act(() => {
      result.current.triggerFocusFlash("task-1", "step-abc")
    })

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.activeFocusFlash).not.toBeNull()
  })

  it("clearFocusFlash immediately clears activeFocusFlash", () => {
    const { result } = renderHook(() => useMainTask(), { wrapper })

    act(() => {
      result.current.triggerFocusFlash("task-1", "step-abc")
    })

    expect(result.current.activeFocusFlash).not.toBeNull()

    act(() => {
      result.current.clearFocusFlash()
    })

    expect(result.current.activeFocusFlash).toBeNull()
  })

  it("re-triggering flash resets the auto-clear timer", () => {
    const { result } = renderHook(() => useMainTask(), { wrapper })

    act(() => {
      result.current.triggerFocusFlash("task-1", "step-1")
    })

    // 800 ms in — not cleared yet
    act(() => {
      vi.advanceTimersByTime(800)
    })

    // Re-trigger with a different step — timer resets
    act(() => {
      result.current.triggerFocusFlash("task-1", "step-2")
    })

    expect(result.current.activeFocusFlash?.stepId).toBe("step-2")

    // 800 ms after second trigger — still within 1100 ms window
    act(() => {
      vi.advanceTimersByTime(800)
    })

    expect(result.current.activeFocusFlash).not.toBeNull()

    // Cross the 1100 ms mark from the second trigger
    act(() => {
      vi.advanceTimersByTime(400)
    })

    expect(result.current.activeFocusFlash).toBeNull()
  })

  it("flash is scoped per task — another task's flash does not affect unrelated task", () => {
    const { result } = renderHook(() => useMainTask(), { wrapper })

    act(() => {
      result.current.triggerFocusFlash("task-A", "step-x")
    })

    // task-B sees no flash
    const flashForB =
      result.current.activeFocusFlash?.taskId === "task-B"
        ? result.current.activeFocusFlash.stepId
        : null

    expect(flashForB).toBeNull()
    // task-A sees the flash
    expect(result.current.activeFocusFlash?.taskId).toBe("task-A")
  })
})

// ── queuedSteps live data derivation (replaces fst_active localStorage poll) ─

describe("MainTaskContext – queuedSteps live data for MainTaskCard", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("queuedSteps is empty when there are no main tasks", () => {
    const { result } = renderHook(() => useMainTask(), { wrapper })
    expect(result.current.queuedSteps).toEqual([])
  })

  it("queuedSteps reflects steps of active main tasks", async () => {
    const { result } = renderHook(() => useMainTask(), { wrapper })

    let task
    act(() => {
      task = result.current.addMainTaskAndActivate({
        title: "Fix bug",
        steps: [{ raw: "Write test 3" }, { raw: "Fix code 2" }],
      })
    })

    const entries = result.current.queuedSteps.filter(
      (e) => e.mainTask.id === task.id,
    )
    expect(entries.length).toBe(2)
    expect(entries[0].step.raw).toBe("Write test 3")
    expect(entries[1].step.raw).toBe("Fix code 2")
  })

  it("queuedSteps entry has remainingSeconds derived from step minutes", async () => {
    const { result } = renderHook(() => useMainTask(), { wrapper })

    let task
    act(() => {
      task = result.current.addMainTaskAndActivate({
        title: "Ship it",
        steps: [{ raw: "Deploy 5" }],
      })
    })

    const entry = result.current.queuedSteps.find(
      (e) => e.mainTask.id === task.id,
    )
    // "Deploy 5" → 5 minutes → 300 seconds
    expect(entry?.remainingSeconds).toBe(300)
  })

  it("completed steps are excluded from queuedSteps", () => {
    const { result } = renderHook(() => useMainTask(), { wrapper })

    let task
    act(() => {
      task = result.current.addMainTaskAndActivate({
        title: "Two steps",
        steps: [{ raw: "Step one 2" }, { raw: "Step two 3" }],
      })
    })

    const stepId = result.current.queuedSteps.find(
      (e) => e.mainTask.id === task.id,
    )?.step.id

    act(() => {
      result.current.setStepCompleted(task.id, stepId, true)
    })

    const remaining = result.current.queuedSteps.filter(
      (e) => e.mainTask.id === task.id,
    )
    expect(remaining.length).toBe(1)
    expect(remaining[0].step.raw).toBe("Step two 3")
  })

  it("updateStepTimer is reflected in queuedSteps.remainingSeconds", () => {
    const { result } = renderHook(() => useMainTask(), { wrapper })

    let task
    act(() => {
      task = result.current.addMainTaskAndActivate({
        title: "Time me",
        steps: [{ raw: "Run tests 4" }],
      })
    })

    const stepId = result.current.queuedSteps.find(
      (e) => e.mainTask.id === task.id,
    )?.step.id

    act(() => {
      result.current.updateStepTimer(stepId, {
        remainingSeconds: 42,
        spentSeconds: 198,
      })
    })

    const entry = result.current.queuedSteps.find((e) => e.step.id === stepId)
    expect(entry?.remainingSeconds).toBe(42)
    expect(entry?.spentSeconds).toBe(198)
  })
})
