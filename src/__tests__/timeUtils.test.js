/**
 * Unit tests for src/utils/timeUtils.js
 * These run against the real Temporal polyfill.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
    nowISO,
    secondsSince,
    fmtTimerDisplay,
    fmtDuration,
    projectedEndTimeLocal,
    getTimezone,
} from "../utils/timeUtils"

describe("nowISO", () => {
    it("returns a valid ISO instant string", () => {
        const iso = nowISO()
        expect(typeof iso).toBe("string")
        // Must parse back without throwing
        expect(() => {
            const { Temporal: T } = require("@js-temporal/polyfill")
            T.Instant.from(iso)
        }).not.toThrow()
    })

    it("is monotonically non-decreasing across two calls", () => {
        const a = nowISO()
        const b = nowISO()
        expect(b >= a).toBe(true)
    })
})

describe("secondsSince", () => {
    it("returns 0 for a null/undefined input", () => {
        expect(secondsSince(null)).toBe(0)
        expect(secondsSince(undefined)).toBe(0)
        expect(secondsSince("")).toBe(0)
    })

    it("returns 0 for a future instant", () => {
        // 1 hour in the future
        const { Temporal: T } = require("@js-temporal/polyfill")
        const future = T.Now.instant().add({ seconds: 3600 }).toString()
        expect(secondsSince(future)).toBe(0)
    })

    it("returns a positive number for a past instant", () => {
        const { Temporal: T } = require("@js-temporal/polyfill")
        const past = T.Now.instant().subtract({ seconds: 5 }).toString()
        const result = secondsSince(past)
        expect(result).toBeGreaterThanOrEqual(4)
        expect(result).toBeLessThanOrEqual(10)
    })

    it("returns 0 for an invalid string", () => {
        expect(secondsSince("not-a-date")).toBe(0)
    })
})

describe("fmtTimerDisplay", () => {
    it("formats 0 as 00:00", () => {
        expect(fmtTimerDisplay(0)).toBe("00:00")
    })

    it("formats 90 seconds as 01:30", () => {
        expect(fmtTimerDisplay(90)).toBe("01:30")
    })

    it("formats 3600 seconds as 60:00", () => {
        expect(fmtTimerDisplay(3600)).toBe("60:00")
    })

    it("zero-pads seconds", () => {
        expect(fmtTimerDisplay(65)).toBe("01:05")
    })
})

describe("fmtDuration", () => {
    it("formats 0 as 0:00", () => {
        expect(fmtDuration(0)).toBe("0:00")
    })

    it("formats 125 as 2:05", () => {
        expect(fmtDuration(125)).toBe("2:05")
    })

    it("formats 3661 with hours", () => {
        expect(fmtDuration(3661)).toBe("1:01:01")
    })
})

describe("projectedEndTimeLocal", () => {
    it("returns — for negative input", () => {
        expect(projectedEndTimeLocal(-1)).toBe("—")
    })

    it("returns a HH:mm string for valid input", () => {
        const result = projectedEndTimeLocal(600)
        expect(result).toMatch(/^\d{2}:\d{2}$/)
    })
})

describe("getTimezone", () => {
    it("returns a non-empty string", () => {
        const tz = getTimezone()
        expect(typeof tz).toBe("string")
        expect(tz.length).toBeGreaterThan(0)
    })
})
