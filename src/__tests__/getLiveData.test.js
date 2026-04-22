/**
 * Unit tests for the getLiveData pure logic extracted from LiveTimerContext.
 * Tests the ratio/remaining/isActive computation in isolation before the
 * context is wired up.
 */
import { describe, it, expect } from "vitest"
import { computeLiveData } from "../context/LiveTimerContext"

describe("computeLiveData", () => {
    const makeTask = (overrides = {}) => ({
        id: "task-1",
        sourceMainTaskId: "main-1",
        sourceStepId: "step-1",
        estimatedMinutes: 2,
        remainingSeconds: 60,
        color: "#6c63ff",
        ...overrides,
    })

    it("returns null when no matching entries exist", () => {
        const result = computeLiveData("step-x", "main-1", [], null)
        expect(result).toBeNull()
    })

    it("returns null when entries exist but belong to a different mainTaskId", () => {
        const queue = [makeTask({ sourceMainTaskId: "main-other" })]
        const result = computeLiveData("step-1", "main-1", queue, null)
        expect(result).toBeNull()
    })

    it("computes correct ratio at 50% remaining", () => {
        // 60s remaining out of 120s total (2 min)
        const queue = [makeTask({ remainingSeconds: 60, estimatedMinutes: 2 })]
        const result = computeLiveData("step-1", "main-1", queue, null)
        expect(result).not.toBeNull()
        expect(result.ratio).toBeCloseTo(0.5)
        expect(result.remaining).toBe(60)
    })

    it("ratio is 1.0 when fully remaining", () => {
        const queue = [makeTask({ remainingSeconds: 120, estimatedMinutes: 2 })]
        const result = computeLiveData("step-1", "main-1", queue, null)
        expect(result.ratio).toBeCloseTo(1.0)
    })

    it("ratio clamps to 0 when remainingSeconds is 0", () => {
        const queue = [makeTask({ remainingSeconds: 0, estimatedMinutes: 2 })]
        const result = computeLiveData("step-1", "main-1", queue, null)
        expect(result.ratio).toBe(0)
    })

    it("isActive is true when matching entry is the live head", () => {
        const task = makeTask()
        const result = computeLiveData("step-1", "main-1", [task], task)
        expect(result.isActive).toBe(true)
        expect(result.color).toBe("#34d195")
    })

    it("isActive is false when entry is in queue but not the head", () => {
        const task = makeTask()
        const otherHead = makeTask({ id: "task-other", sourceStepId: "step-other" })
        const result = computeLiveData("step-1", "main-1", [otherHead, task], otherHead)
        expect(result.isActive).toBe(false)
        expect(result.color).toBe("#6c63ff")
    })

    it("works with no sourceMainTaskId filter (null)", () => {
        const task = makeTask()
        const result = computeLiveData("step-1", null, [task], task)
        expect(result).not.toBeNull()
        expect(result.isActive).toBe(true)
    })

    it("uses task color when not active", () => {
        const task = makeTask({ color: "#ff6600" })
        const otherHead = makeTask({ id: "other", sourceStepId: "other-step" })
        const result = computeLiveData("step-1", "main-1", [otherHead, task], otherHead)
        expect(result.color).toBe("#ff6600")
    })
})
