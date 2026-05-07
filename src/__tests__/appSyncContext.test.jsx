import React from "react"
import { describe, it, expect, beforeEach } from "vitest"
import { render, waitFor, act } from "@testing-library/react"
import { AppSyncProvider, useAppSync } from "../context/AppSyncContext"

function CaptureAppSync({ refObj }) {
  const ctx = useAppSync()
  refObj.current = ctx
  return null
}

function renderAppSync() {
  const refObj = { current: null }
  render(
    <AppSyncProvider>
      <CaptureAppSync refObj={refObj} />
    </AppSyncProvider>,
  )
  return refObj
}

describe("AppSyncContext", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("requestCompleteTimerStep stores a complete request payload", async () => {
    const ctxRef = renderAppSync()

    act(() => {
      ctxRef.current.requestCompleteTimerStep("main-1", "step-1")
    })

    await waitFor(() => {
      expect(ctxRef.current.completeTimerStepRequest).toBeTruthy()
      expect(ctxRef.current.completeTimerStepRequest.mainTaskId).toBe("main-1")
      expect(ctxRef.current.completeTimerStepRequest.stepId).toBe("step-1")
      expect(ctxRef.current.completeTimerStepRequest.requestId).toBeTruthy()
    })
  })

  it("requestCompleteTimerStep ignores incomplete input", async () => {
    const ctxRef = renderAppSync()

    act(() => {
      ctxRef.current.requestCompleteTimerStep("", "step-1")
      ctxRef.current.requestCompleteTimerStep("main-1", "")
    })

    await waitFor(() => {
      expect(ctxRef.current.completeTimerStepRequest).toBe(null)
    })
  })

  it("requestStopAlarm increments global stop signal", async () => {
    const ctxRef = renderAppSync()

    expect(ctxRef.current.stopAlarmSignal).toBe(0)

    act(() => {
      ctxRef.current.requestStopAlarm()
      ctxRef.current.requestStopAlarm()
    })

    await waitFor(() => {
      expect(ctxRef.current.stopAlarmSignal).toBe(2)
    })
  })
})
