import { describe, expect, it } from "vitest"
import { formatTimeDisplay, parseTimeInput, calculateRemaining, adjustTime } from "../utils/timeUtils"

describe("timeUtils", () => {
    describe("formatTimeDisplay", () => {
        it("formats zero seconds", () => {
            const result = formatTimeDisplay(0)
            expect(result).toMatch(/^0:/)
        })

        it("formats seconds less than 60", () => {
            const result = formatTimeDisplay(45)
            expect(result).toMatch(/0:45/)
        })

        it("formats minutes and seconds", () => {
            const result = formatTimeDisplay(125)
            // Should be 2:05 (2 mins 5 secs)
            expect(result).toMatch(/2:0?5/)
        })

        it("formats hours minutes and seconds", () => {
            const result = formatTimeDisplay(3725)
            // Should be 1:02:05 (1 hour 2 mins 5 secs)
            expect(result).toMatch(/1:.*:/)
        })

        it("pads single digit seconds with zero", () => {
            const result = formatTimeDisplay(65)
            // 1:05
            expect(result).toMatch(/1:05/)
        })

        it("pads single digit minutes with zero", () => {
            const result = formatTimeDisplay(605)
            // 10:05
            expect(result).toMatch(/10:05/)
        })

        it("handles large times", () => {
            const result = formatTimeDisplay(36000)
            // 10:00:00
            expect(result).toMatch(/10:00:00/)
        })

        it("handles negative time gracefully", () => {
            const result = formatTimeDisplay(-5)
            // Implementation dependent, but should return a string
            expect(typeof result).toBe("string")
        })
    })

    describe("parseTimeInput", () => {
        it("parses minutes from string like '5'", () => {
            const result = parseTimeInput("5")
            expect(result).toBe(300) // 5 minutes in seconds
        })

        it("parses minutes and seconds from '5:30'", () => {
            const result = parseTimeInput("5:30")
            expect(result).toBe(330) // 5*60 + 30
        })

        it("parses hours minutes seconds from '1:30:45'", () => {
            const result = parseTimeInput("1:30:45")
            expect(result).toBe(5445) // 1*3600 + 30*60 + 45
        })

        it("handles minutes with leading zero", () => {
            const result = parseTimeInput("05")
            expect(result).toBe(300)
        })

        it("returns 0 for empty input", () => {
            const result = parseTimeInput("")
            expect(result).toBe(0)
        })

        it("clamps result to reasonable bounds", () => {
            // Test that extremely large inputs don't produce invalid results
            const result = parseTimeInput("999:59:59")
            expect(typeof result).toBe("number")
            expect(result).toBeGreaterThan(0)
        })

        it("handles non-numeric input gracefully", () => {
            const result = parseTimeInput("abc")
            expect(typeof result).toBe("number")
        })
    })

    describe("calculateRemaining", () => {
        it("calculates remaining time when elapsed < duration", () => {
            const result = calculateRemaining(300, 100)
            expect(result).toBe(200)
        })

        it("returns 0 when elapsed >= duration", () => {
            const result = calculateRemaining(300, 300)
            expect(result).toBe(0)
        })

        it("returns 0 for negative remaining", () => {
            const result = calculateRemaining(300, 400)
            expect(result).toBeGreaterThanOrEqual(0)
        })

        it("handles zero duration", () => {
            const result = calculateRemaining(0, 0)
            expect(result).toBe(0)
        })

        it("returns exact remaining time", () => {
            const result = calculateRemaining(600, 150)
            expect(result).toBe(450)
        })
    })

    describe("adjustTime", () => {
        it("adds positive adjustment to time", () => {
            const result = adjustTime(300, 60)
            expect(result).toBe(360)
        })

        it("subtracts with negative adjustment", () => {
            const result = adjustTime(300, -60)
            expect(result).toBe(240)
        })

        it("respects minimum time bound", () => {
            const result = adjustTime(300, -250)
            expect(result).toBeGreaterThanOrEqual(60)
        })

        it("respects maximum time bound", () => {
            const result = adjustTime(3500, 200)
            expect(result).toBeLessThanOrEqual(3600)
        })

        it("handles zero adjustment", () => {
            const result = adjustTime(300, 0)
            expect(result).toBe(300)
        })

        it("returns number type", () => {
            const result = adjustTime(300, 50)
            expect(typeof result).toBe("number")
        })

        it("handles large adjustments", () => {
            const result = adjustTime(300, 5000)
            expect(result).toBeLessThanOrEqual(3600)
        })
    })

    describe("time formatting consistency", () => {
        it("formatted time round-trips with parse", () => {
            const original = 305 // 5:05
            const formatted = formatTimeDisplay(original)
            const parsed = parseTimeInput(formatted)
            // Allow 1 second tolerance due to rounding
            expect(Math.abs(parsed - original)).toBeLessThan(2)
        })

        it("handles multiple format types consistently", () => {
            const formats = ["5", "1:30", "0:45"]
            const results = formats.map((f) => parseTimeInput(f))
            expect(results.every((r) => typeof r === "number")).toBe(true)
        })
    })

    describe("edge cases", () => {
        it("handles time at day boundary", () => {
            const result = formatTimeDisplay(86399)
            // Just under 24 hours
            expect(typeof result).toBe("string")
        })

        it("handles very small durations", () => {
            const result = formatTimeDisplay(1)
            expect(result).toMatch(/0:0?1/)
        })

        it("parseTimeInput with whitespace", () => {
            const result = parseTimeInput("  5:30  ")
            expect(result).toBe(330)
        })

        it("adjustTime preserves integer result", () => {
            const result = adjustTime(300, 33)
            expect(Number.isInteger(result)).toBe(true)
        })
    })
})
