/**
 * Unit tests for timer tick logic using Temporal.
 * Tests that secondsSince correctly computes elapsed time
 * and that the tick math produces the right remainingSeconds.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { secondsSince, nowISO } from "../utils/timeUtils"

describe("timer tick Temporal anchoring", () => {
    it("elapsed is ~0 for a just-stamped startedAtISO", () => {
        const startedAt = nowISO()
        const elapsed = secondsSince(startedAt)
        // Should be 0 or 1 at most (depends on millisecond timing in CI)
        expect(elapsed).toBeLessThanOrEqual(1)
    })

    it("remaining = startingRemaining - elapsed stays non-negative", () => {
        const startingRemaining = 120
        const startedAt = nowISO()
        const elapsed = secondsSince(startedAt)
        const remaining = Math.max(0, startingRemaining - elapsed)
        expect(remaining).toBeGreaterThanOrEqual(0)
        expect(remaining).toBeLessThanOrEqual(startingRemaining)
    })

    it("two successive nowISO calls produce parseable instants in order", () => {
        const { Temporal: T } = require("@js-temporal/polyfill")
        const a = T.Instant.from(nowISO())
        const b = T.Instant.from(nowISO())
        // b must be >= a
        expect(T.Instant.compare(a, b)).toBeLessThanOrEqual(0)
    })
})
