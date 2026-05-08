import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import useLocalStorage from "../hooks/useLocalStorage"

describe("useLocalStorage", () => {
    beforeEach(() => {
        localStorage.clear()
        vi.clearAllMocks()
    })

    describe("basic get/set", () => {
        it("returns initial value when key not in localStorage", () => {
            const { result } = renderHook(() =>
                useLocalStorage("test-key", "default-value"),
            )

            expect(result.current[0]).toBe("default-value")
        })

        it("returns value from localStorage if it exists", () => {
            localStorage.setItem("existing-key", JSON.stringify("stored-value"))

            const { result } = renderHook(() =>
                useLocalStorage("existing-key", "default"),
            )

            expect(result.current[0]).toBe("stored-value")
        })

        it("sets value to localStorage", () => {
            const { result } = renderHook(() =>
                useLocalStorage("new-key", "initial"),
            )

            act(() => {
                result.current[1]("updated")
            })

            expect(localStorage.getItem("new-key")).toBe(JSON.stringify("updated"))
        })

        it("updates hook value after set", () => {
            const { result } = renderHook(() =>
                useLocalStorage("test", "initial"),
            )

            act(() => {
                result.current[1]("new-value")
            })

            expect(result.current[0]).toBe("new-value")
        })
    })

    describe("object serialization", () => {
        it("serializes objects to JSON", () => {
            const obj = { name: "test", value: 42 }
            const { result } = renderHook(() =>
                useLocalStorage("obj-key", { name: "", value: 0 }),
            )

            act(() => {
                result.current[1](obj)
            })

            const stored = JSON.parse(localStorage.getItem("obj-key"))
            expect(stored).toEqual(obj)
        })

        it("deserializes objects from JSON", () => {
            const obj = { name: "stored", value: 100 }
            localStorage.setItem("obj-key", JSON.stringify(obj))

            const { result } = renderHook(() =>
                useLocalStorage("obj-key", { name: "", value: 0 }),
            )

            expect(result.current[0]).toEqual(obj)
        })

        it("handles arrays correctly", () => {
            const arr = [1, 2, 3, 4, 5]
            const { result } = renderHook(() =>
                useLocalStorage("arr-key", []),
            )

            act(() => {
                result.current[1](arr)
            })

            const stored = JSON.parse(localStorage.getItem("arr-key"))
            expect(stored).toEqual(arr)
        })

        it("handles nested objects", () => {
            const nested = {
                user: { name: "John", age: 30 },
                settings: { theme: "dark", notifications: true },
            }
            const { result } = renderHook(() =>
                useLocalStorage("nested-key", nested),
            )

            act(() => {
                result.current[1](nested)
            })

            const stored = JSON.parse(localStorage.getItem("nested-key"))
            expect(stored).toEqual(nested)
        })
    })

    describe("malformed data recovery", () => {
        it("uses default when localStorage value is invalid JSON", () => {
            localStorage.setItem("bad-json", "not valid json {]}")

            const { result } = renderHook(() =>
                useLocalStorage("bad-json", "default-fallback"),
            )

            expect(result.current[0]).toBe("default-fallback")
        })

        it("uses default when stored value is null", () => {
            localStorage.setItem("null-key", null)

            const { result } = renderHook(() =>
                useLocalStorage("null-key", "default"),
            )

            expect(result.current[0]).toBe("default")
        })

        it("recovers from undefined stored value", () => {
            // localStorage doesn't store undefined, but test for robustness
            const { result } = renderHook(() =>
                useLocalStorage("undefined-key", { fallback: true }),
            )

            expect(result.current[0]).toEqual({ fallback: true })
        })
    })

    describe("type preservation", () => {
        it("preserves string type", () => {
            const { result } = renderHook(() =>
                useLocalStorage("string-key", "initial"),
            )

            act(() => {
                result.current[1]("new-string")
            })

            expect(typeof result.current[0]).toBe("string")
            expect(result.current[0]).toBe("new-string")
        })

        it("preserves number type", () => {
            const { result } = renderHook(() =>
                useLocalStorage("number-key", 42),
            )

            act(() => {
                result.current[1](100)
            })

            expect(typeof result.current[0]).toBe("number")
            expect(result.current[0]).toBe(100)
        })

        it("preserves boolean type", () => {
            const { result } = renderHook(() =>
                useLocalStorage("bool-key", true),
            )

            act(() => {
                result.current[1](false)
            })

            expect(typeof result.current[0]).toBe("boolean")
            expect(result.current[0]).toBe(false)
        })

        it("preserves array type", () => {
            const { result } = renderHook(() =>
                useLocalStorage("arr-key", [1, 2, 3]),
            )

            act(() => {
                result.current[1]([4, 5, 6])
            })

            expect(Array.isArray(result.current[0])).toBe(true)
            expect(result.current[0]).toEqual([4, 5, 6])
        })

        it("preserves object type", () => {
            const { result } = renderHook(() =>
                useLocalStorage("obj-key", { key: "value" }),
            )

            act(() => {
                result.current[1]({ key: "new-value" })
            })

            expect(typeof result.current[0]).toBe("object")
            expect(result.current[0].key).toBe("new-value")
        })
    })

    describe("synchronization across tabs/windows", () => {
        it("responds to storage events", () => {
            const { result, rerender } = renderHook(() =>
                useLocalStorage("shared-key", "initial"),
            )

            // Simulate another tab updating localStorage
            const event = new StorageEvent("storage", {
                key: "shared-key",
                newValue: JSON.stringify("updated-from-other-tab"),
            })

            act(() => {
                window.dispatchEvent(event)
            })

            // Value should update
            expect(result.current[0]).toBe("updated-from-other-tab")
        })

        it("ignores storage events for other keys", () => {
            const { result } = renderHook(() =>
                useLocalStorage("watched-key", "initial"),
            )

            const event = new StorageEvent("storage", {
                key: "other-key",
                newValue: JSON.stringify("other-value"),
            })

            act(() => {
                window.dispatchEvent(event)
            })

            expect(result.current[0]).toBe("initial")
        })

        it("handles storage clear event", () => {
            localStorage.setItem("test-key", JSON.stringify("value"))

            const { result } = renderHook(() =>
                useLocalStorage("test-key", "default"),
            )

            const event = new StorageEvent("storage", { key: null })

            act(() => {
                window.dispatchEvent(event)
            })

            // After clear, should fall back to default
            expect(result.current[0]).toBe("default")
        })
    })

    describe("multiple hooks same key", () => {
        it("multiple hooks on same key share state", () => {
            const { result: result1 } = renderHook(() =>
                useLocalStorage("shared-key", "initial"),
            )
            const { result: result2 } = renderHook(() =>
                useLocalStorage("shared-key", "initial"),
            )

            act(() => {
                result1.current[1]("updated")
            })

            // Simulate storage event for tab sync
            const event = new StorageEvent("storage", {
                key: "shared-key",
                newValue: JSON.stringify("updated"),
            })

            act(() => {
                window.dispatchEvent(event)
            })

            expect(result2.current[0]).toBe("updated")
        })
    })

    describe("edge cases", () => {
        it("handles empty string", () => {
            const { result } = renderHook(() =>
                useLocalStorage("empty-key", ""),
            )

            act(() => {
                result.current[1]("")
            })

            expect(result.current[0]).toBe("")
        })

        it("handles zero", () => {
            const { result } = renderHook(() =>
                useLocalStorage("zero-key", 0),
            )

            act(() => {
                result.current[1](0)
            })

            expect(result.current[0]).toBe(0)
        })

        it("handles false", () => {
            const { result } = renderHook(() =>
                useLocalStorage("false-key", false),
            )

            act(() => {
                result.current[1](false)
            })

            expect(result.current[0]).toBe(false)
        })

        it("handles empty array", () => {
            const { result } = renderHook(() =>
                useLocalStorage("empty-arr", []),
            )

            act(() => {
                result.current[1]([])
            })

            expect(result.current[0]).toEqual([])
        })

        it("handles empty object", () => {
            const { result } = renderHook(() =>
                useLocalStorage("empty-obj", {}),
            )

            act(() => {
                result.current[1]({})
            })

            expect(result.current[0]).toEqual({})
        })
    })

    describe("cleanup", () => {
        it("removes event listener on unmount", () => {
            const removeEventListenerSpy = vi.spyOn(
                window,
                "removeEventListener",
            )

            const { unmount } = renderHook(() =>
                useLocalStorage("cleanup-key", "value"),
            )

            unmount()

            expect(removeEventListenerSpy).toHaveBeenCalled()
            removeEventListenerSpy.mockRestore()
        })
    })
})
