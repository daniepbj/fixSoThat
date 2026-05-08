import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { TimerProvider, useTimer } from "../context/TimerContext"

describe("TimerContext", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("initialization and defaults", () => {
    it("initializes with zero duration", () => {
      const wrapper = ({ children }) => (
        <TimerProvider>{children}</TimerProvider>
      )
      const { result } = renderHook(() => useTimer(), { wrapper })

      expect(result.current.duration).toBe(0)
    })

    it("initializes with timer not running", () => {
      const wrapper = ({ children }) => (
        <TimerProvider>{children}</TimerProvider>
      )
      const { result } = renderHook(() => useTimer(), { wrapper })

      expect(result.current.timerRunning).toBe(false)
    })

    it("initializes with zero elapsed time", () => {
      const wrapper = ({ children }) => (
        <TimerProvider>{children}</TimerProvider>
      )
      const { result } = renderHook(() => useTimer(), { wrapper })

      expect(result.current.elapsedSeconds).toBe(0)
    })
  })

  describe("start timer action", () => {
    it("starts timer with duration", () => {
      const wrapper = ({ children }) => (
        <TimerProvider>{children}</TimerProvider>
      )
      const { result } = renderHook(() => useTimer(), { wrapper })

      act(() => {
        result.current.actions.startTimer(300)
      })

      expect(result.current.duration).toBe(300)
      expect(result.current.timerRunning).toBe(true)
    })

    it("clamps duration to max 3600 seconds", () => {
      const wrapper = ({ children }) => (
        <TimerProvider>{children}</TimerProvider>
      )
      const { result } = renderHook(() => useTimer(), { wrapper })

      act(() => {
        result.current.actions.startTimer(5000)
      })

      expect(result.current.duration).toBeLessThanOrEqual(3600)
    })

    it("clamps duration to min 60 seconds", () => {
      const wrapper = ({ children }) => (
        <TimerProvider>{children}</TimerProvider>
      )
      const { result } = renderHook(() => useTimer(), { wrapper })

      act(() => {
        result.current.actions.startTimer(30)
      })

      expect(result.current.duration).toBeGreaterThanOrEqual(60)
    })
  })

  describe("stop timer action", () => {
    it("stops timer", () => {
      const wrapper = ({ children }) => (
        <TimerProvider>{children}</TimerProvider>
      )
      const { result } = renderHook(() => useTimer(), { wrapper })

      act(() => {
        result.current.actions.startTimer(300)
      })

      expect(result.current.timerRunning).toBe(true)

      act(() => {
        result.current.actions.stopTimer()
      })

      expect(result.current.timerRunning).toBe(false)
    })

    it("stops timer without affecting elapsed time", () => {
      const wrapper = ({ children }) => (
        <TimerProvider>{children}</TimerProvider>
      )
      const { result } = renderHook(() => useTimer(), { wrapper })

      act(() => {
        result.current.actions.startTimer(300)
      })

      const elapsedBefore = result.current.elapsedSeconds

      act(() => {
        result.current.actions.stopTimer()
      })

      const elapsedAfter = result.current.elapsedSeconds
      expect(elapsedAfter).toBe(elapsedBefore)
    })
  })

  describe("pause timer action", () => {
    it("pauses timer keeping elapsed time intact", () => {
      const wrapper = ({ children }) => (
        <TimerProvider>{children}</TimerProvider>
      )
      const { result } = renderHook(() => useTimer(), { wrapper })

      act(() => {
        result.current.actions.startTimer(300)
      })

      expect(result.current.timerRunning).toBe(true)

      act(() => {
        result.current.actions.pauseTimer()
      })

      expect(result.current.timerRunning).toBe(false)
    })

    it("can resume timer after pause", () => {
      const wrapper = ({ children }) => (
        <TimerProvider>{children}</TimerProvider>
      )
      const { result } = renderHook(() => useTimer(), { wrapper })

      act(() => {
        result.current.actions.startTimer(300)
      })

      act(() => {
        result.current.actions.pauseTimer()
      })

      expect(result.current.timerRunning).toBe(false)

      act(() => {
        result.current.actions.startTimer(300)
      })

      expect(result.current.timerRunning).toBe(true)
    })
  })

  describe("reset timer action", () => {
    it("resets timer to zero elapsed and stopped", () => {
      const wrapper = ({ children }) => (
        <TimerProvider>{children}</TimerProvider>
      )
      const { result } = renderHook(() => useTimer(), { wrapper })

      act(() => {
        result.current.actions.startTimer(300)
      })

      act(() => {
        result.current.actions.resetTimer()
      })

      expect(result.current.timerRunning).toBe(false)
      expect(result.current.duration).toBe(0)
    })

    it("resets elapsed time", () => {
      const wrapper = ({ children }) => (
        <TimerProvider>{children}</TimerProvider>
      )
      const { result } = renderHook(() => useTimer(), { wrapper })

      act(() => {
        result.current.actions.startTimer(300)
      })

      act(() => {
        result.current.actions.resetTimer()
      })

      expect(result.current.elapsedSeconds).toBe(0)
    })
  })

  describe("remaining time calculation", () => {
    it("calculates remaining time correctly", () => {
      const wrapper = ({ children }) => (
        <TimerProvider>{children}</TimerProvider>
      )
      const { result } = renderHook(() => useTimer(), { wrapper })

      act(() => {
        result.current.actions.startTimer(300)
      })

      const elapsed = result.current.elapsedSeconds
      const remaining = result.current.remainingSeconds
      const total = result.current.duration

      expect(remaining + elapsed).toBe(total)
    })

    it("never returns negative remaining time", () => {
      const wrapper = ({ children }) => (
        <TimerProvider>{children}</TimerProvider>
      )
      const { result } = renderHook(() => useTimer(), { wrapper })

      act(() => {
        result.current.actions.startTimer(300)
      })

      expect(result.current.remainingSeconds).toBeGreaterThanOrEqual(0)
    })
  })

  describe("time set action", () => {
    it("sets duration directly", () => {
      const wrapper = ({ children }) => (
        <TimerProvider>{children}</TimerProvider>
      )
      const { result } = renderHook(() => useTimer(), { wrapper })

      act(() => {
        result.current.actions.setDuration(500)
      })

      expect(result.current.duration).toBe(500)
    })

    it("respects duration bounds when setting", () => {
      const wrapper = ({ children }) => (
        <TimerProvider>{children}</TimerProvider>
      )
      const { result } = renderHook(() => useTimer(), { wrapper })

      act(() => {
        result.current.actions.setDuration(5000)
      })

      expect(result.current.duration).toBeLessThanOrEqual(3600)
    })

    it("can add time to existing duration", () => {
      const wrapper = ({ children }) => (
        <TimerProvider>{children}</TimerProvider>
      )
      const { result } = renderHook(() => useTimer(), { wrapper })

      act(() => {
        result.current.actions.startTimer(300)
      })

      const initial = result.current.duration

      act(() => {
        result.current.actions.addTime(120)
      })

      expect(result.current.duration).toBe(initial + 120)
    })
  })

  describe("multiple hooks same provider", () => {
    it("multiple hooks share same timer state", () => {
      const wrapper = ({ children }) => (
        <TimerProvider>{children}</TimerProvider>
      )
      const { result: result1 } = renderHook(() => useTimer(), { wrapper })
      const { result: result2 } = renderHook(() => useTimer(), { wrapper })

      act(() => {
        result1.current.actions.startTimer(300)
      })

      expect(result2.current.duration).toBe(300)
      expect(result2.current.timerRunning).toBe(true)
    })

    it("state changes propagate across hooks", () => {
      const wrapper = ({ children }) => (
        <TimerProvider>{children}</TimerProvider>
      )
      const { result: result1 } = renderHook(() => useTimer(), { wrapper })
      const { result: result2 } = renderHook(() => useTimer(), { wrapper })

      act(() => {
        result1.current.actions.startTimer(300)
        result2.current.actions.addTime(100)
      })

      expect(result1.current.duration).toBe(400)
      expect(result2.current.duration).toBe(400)
    })
  })
})
