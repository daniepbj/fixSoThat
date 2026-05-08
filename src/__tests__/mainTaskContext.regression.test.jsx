import React from "react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, waitFor, act } from "@testing-library/react"
import { MainTaskProvider, useMainTask } from "../context/MainTaskContext"
import { AppSyncProvider, useAppSync } from "../context/AppSyncContext"

vi.mock("../utils/soundEffects", () => ({
  playPowerUpSound: vi.fn(() => Promise.resolve()),
  playCompletionSound: vi.fn(() => Promise.resolve()),
}))

vi.mock("canvas-confetti", () => ({ default: vi.fn() }))

function CaptureContext({ refObj }) {
  const ctx = useMainTask()
  refObj.current = ctx
  return null
}

function CaptureAppSyncContext({ refObj }) {
  const ctx = useAppSync()
  refObj.current = ctx
  return null
}

function renderMainTaskContext() {
  const refObj = { current: null }
  const appSyncRef = { current: null }
  render(
    <AppSyncProvider>
      <MainTaskProvider>
        <CaptureContext refObj={refObj} />
        <CaptureAppSyncContext refObj={appSyncRef} />
      </MainTaskProvider>
    </AppSyncProvider>,
  )
  return { refObj, appSyncRef }
}

describe("MainTaskContext regression coverage", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("completeMainTask matches Done behavior (completed status + all steps completed)", async () => {
    const { refObj: ctxRef } = renderMainTaskContext()

    act(() => {
      ctxRef.current.addMainTask({
        title: "Task",
        steps: [
          { raw: "step 1", completed: false },
          { raw: "step 2", completed: false },
        ],
      })
    })

    let taskId
    await waitFor(() => {
      expect(ctxRef.current.mainTasks.length).toBe(1)
      taskId = ctxRef.current.mainTasks[0].id
    })

    act(() => {
      ctxRef.current.completeMainTask(taskId)
    })

    await waitFor(() => {
      const task = ctxRef.current.mainTasks[0]
      expect(task.status).toBe("completed")
      expect(task.steps.every((s) => s.completed)).toBe(true)
    })
  })

  it("toggleStepComplete emits linked timer completion signal when checking a step", async () => {
    const { refObj: ctxRef, appSyncRef } = renderMainTaskContext()

    act(() => {
      ctxRef.current.addMainTask({
        title: "Task",
        steps: [{ raw: "step 1", completed: false }],
      })
    })

    let taskId
    let stepId
    await waitFor(() => {
      expect(ctxRef.current.mainTasks.length).toBe(1)
      taskId = ctxRef.current.mainTasks[0].id
      stepId = ctxRef.current.mainTasks[0].steps[0].id
    })

    act(() => {
      ctxRef.current.toggleStepComplete(taskId, stepId)
    })

    await waitFor(() => {
      expect(appSyncRef.current.completeTimerStepRequest).toBeTruthy()
      expect(appSyncRef.current.completeTimerStepRequest.mainTaskId).toBe(
        taskId,
      )
      expect(appSyncRef.current.completeTimerStepRequest.stepId).toBe(stepId)
    })
  })

  it("toggleStepComplete does not emit timer completion signal when unchecking", async () => {
    const { refObj: ctxRef, appSyncRef } = renderMainTaskContext()

    act(() => {
      ctxRef.current.addMainTask({
        title: "Task",
        steps: [{ raw: "step 1", completed: true }],
      })
    })

    let taskId
    let stepId
    await waitFor(() => {
      expect(ctxRef.current.mainTasks.length).toBe(1)
      taskId = ctxRef.current.mainTasks[0].id
      stepId = ctxRef.current.mainTasks[0].steps[0].id
    })

    act(() => {
      ctxRef.current.toggleStepComplete(taskId, stepId)
    })

    await waitFor(() => {
      expect(appSyncRef.current.completeTimerStepRequest).toBeNull()
    })
  })

  it("last-step check auto-completes the task status", async () => {
    const { refObj: ctxRef } = renderMainTaskContext()

    act(() => {
      ctxRef.current.addMainTask({
        title: "Task",
        steps: [{ raw: "step 1", completed: false }],
      })
    })

    let taskId
    let stepId
    await waitFor(() => {
      expect(ctxRef.current.mainTasks.length).toBe(1)
      taskId = ctxRef.current.mainTasks[0].id
      stepId = ctxRef.current.mainTasks[0].steps[0].id
    })

    act(() => {
      ctxRef.current.toggleStepComplete(taskId, stepId)
    })

    await waitFor(() => {
      expect(ctxRef.current.mainTasks[0].status).toBe("completed")
      expect(ctxRef.current.mainTasks[0].steps[0].completed).toBe(true)
    })
  })
})
