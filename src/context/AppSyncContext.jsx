import { createContext, useContext, useMemo, useState } from "react"

const AppSyncContext = createContext(null)

export function AppSyncProvider({ children }) {
  const [completeTimerStepRequest, setCompleteTimerStepRequest] = useState(null)
  const [stopAlarmSignal, setStopAlarmSignal] = useState(0)
  const [focusMainTaskRequest, setFocusMainTaskRequest] = useState(null)
  const [autoStartMainTaskRequest, setAutoStartMainTaskRequest] = useState(null)
  const [timerActiveTasks, setTimerActiveTasks] = useState([])
  const [timerRunning, setTimerRunning] = useState(false)

  function requestCompleteTimerStep(mainTaskId, stepId) {
    if (!mainTaskId || !stepId) return
    setCompleteTimerStepRequest({
      mainTaskId,
      stepId,
      requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    })
  }

  function requestStopAlarm() {
    setStopAlarmSignal((prev) => prev + 1)
  }

  function requestFocusMainTask(mainTaskId, stepId = null) {
    if (!mainTaskId) return
    setFocusMainTaskRequest({
      mainTaskId,
      stepId: stepId || null,
      requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    })
  }

  function requestAutoStartMainTask(mainTaskId) {
    if (!mainTaskId) return
    setAutoStartMainTaskRequest({
      mainTaskId,
      requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    })
  }

  function publishTimerSnapshot(activeTasks, running) {
    setTimerActiveTasks(Array.isArray(activeTasks) ? activeTasks : [])
    setTimerRunning(Boolean(running))
  }

  const value = useMemo(
    () => ({
      completeTimerStepRequest,
      requestCompleteTimerStep,
      stopAlarmSignal,
      requestStopAlarm,
      focusMainTaskRequest,
      requestFocusMainTask,
      autoStartMainTaskRequest,
      requestAutoStartMainTask,
      timerActiveTasks,
      timerRunning,
      publishTimerSnapshot,
    }),
    [
      completeTimerStepRequest,
      stopAlarmSignal,
      focusMainTaskRequest,
      autoStartMainTaskRequest,
      timerActiveTasks,
      timerRunning,
    ],
  )

  return (
    <AppSyncContext.Provider value={value}>{children}</AppSyncContext.Provider>
  )
}

export function useAppSync() {
  const ctx = useContext(AppSyncContext)
  if (!ctx) {
    throw new Error("useAppSync must be used inside AppSyncProvider")
  }
  return ctx
}
