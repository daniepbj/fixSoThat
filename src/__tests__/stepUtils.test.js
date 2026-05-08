import { describe, expect, it } from "vitest"
import { parseRawStep, formatStepsForPreview, orderSteps } from "../utils/stepUtils"

describe("stepUtils", () => {
    describe("parseRawStep", () => {
        it("parses simple step text", () => {
            const result = parseRawStep("wash dishes")
            expect(result.text).toBe("wash dishes")
        })

        it("extracts time estimate from step text", () => {
            const result = parseRawStep("wash dishes 5")
            expect(result.text).toBe("wash dishes")
            expect(result.minutes).toBe(5)
        })

        it("extracts numeric suffix as minutes", () => {
            const result = parseRawStep("run meeting 30")
            expect(result.minutes).toBe(30)
        })

        it("handles steps without time estimate", () => {
            const result = parseRawStep("simple task")
            expect(result.minutes).toBeUndefined()
        })

        it("strips trailing whitespace", () => {
            const result = parseRawStep("task text   ")
            expect(result.text).toBe("task text")
        })

        it("returns step object with id", () => {
            const result = parseRawStep("test step")
            expect(result.id).toBeTruthy()
            expect(typeof result.id).toBe("string")
        })

        it("marks step as not completed on parse", () => {
            const result = parseRawStep("test step")
            expect(result.completed).toBe(false)
        })
    })

    describe("formatStepsForPreview", () => {
        it("formats empty step array", () => {
            const result = formatStepsForPreview([])
            expect(result).toBe("")
        })

        it("formats single step", () => {
            const steps = [{ id: "1", text: "step 1", minutes: 5, completed: false }]
            const result = formatStepsForPreview(steps)
            expect(result).toContain("step 1")
        })

        it("formats multiple steps with line breaks", () => {
            const steps = [
                { id: "1", text: "step 1", completed: false },
                { id: "2", text: "step 2", completed: false },
            ]
            const result = formatStepsForPreview(steps)
            expect(result).toContain("step 1")
            expect(result).toContain("step 2")
        })

        it("includes time estimates in formatted output", () => {
            const steps = [{ id: "1", text: "task", minutes: 10, completed: false }]
            const result = formatStepsForPreview(steps)
            expect(result.toLowerCase()).toContain("10")
        })

        it("marks completed steps visually", () => {
            const steps = [
                { id: "1", text: "done step", completed: true },
                { id: "2", text: "pending step", completed: false },
            ]
            const result = formatStepsForPreview(steps)
            expect(result).toContain("done step")
            expect(result).toContain("pending step")
        })

        it("handles mixed completed/uncompleted steps", () => {
            const steps = [
                { id: "1", text: "step 1", completed: true },
                { id: "2", text: "step 2", completed: false },
                { id: "3", text: "step 3", completed: true },
            ]
            const result = formatStepsForPreview(steps)
            expect(result.split("\n").length).toBeGreaterThanOrEqual(3)
        })
    })

    describe("orderSteps", () => {
        it("returns empty array for empty input", () => {
            const result = orderSteps([])
            expect(result).toEqual([])
        })

        it("preserves step order when order array matches", () => {
            const steps = [
                { id: "a", text: "first" },
                { id: "b", text: "second" },
                { id: "c", text: "third" },
            ]
            const order = ["a", "b", "c"]
            const result = orderSteps(steps, order)
            expect(result.map((s) => s.id)).toEqual(["a", "b", "c"])
        })

        it("reorders steps according to order array", () => {
            const steps = [
                { id: "a", text: "first" },
                { id: "b", text: "second" },
                { id: "c", text: "third" },
            ]
            const order = ["c", "a", "b"]
            const result = orderSteps(steps, order)
            expect(result.map((s) => s.id)).toEqual(["c", "a", "b"])
        })

        it("handles steps not in order array", () => {
            const steps = [
                { id: "a", text: "first" },
                { id: "b", text: "second" },
                { id: "c", text: "third" },
            ]
            const order = ["a", "b"]
            const result = orderSteps(steps, order)
            expect(result.length).toBe(3)
            expect(result.map((s) => s.id)).toContain("c")
        })

        it("handles order array with extra ids not in steps", () => {
            const steps = [
                { id: "a", text: "first" },
                { id: "b", text: "second" },
            ]
            const order = ["a", "b", "c", "d"]
            const result = orderSteps(steps, order)
            expect(result.length).toBe(2)
            expect(result.map((s) => s.id)).toEqual(["a", "b"])
        })

        it("maintains step data integrity after reordering", () => {
            const steps = [
                { id: "a", text: "step a", minutes: 5, completed: true },
                { id: "b", text: "step b", minutes: 10, completed: false },
            ]
            const order = ["b", "a"]
            const result = orderSteps(steps, order)
            expect(result[0].id).toBe("b")
            expect(result[0].minutes).toBe(10)
            expect(result[0].completed).toBe(false)
            expect(result[1].id).toBe("a")
            expect(result[1].minutes).toBe(5)
            expect(result[1].completed).toBe(true)
        })
    })
})
