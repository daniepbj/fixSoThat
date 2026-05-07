import { createContext, useContext, useMemo, useState } from "react"

const AppSyncContext = createContext(null)

export function AppSyncProvider({ children }) {
  const [completeTimerStepRequest, setCompleteTimerStepRequest] = useState(null)
  const [stopAlarmSignal, setStopAlarmSignal] = useState(0)

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

  const value = useMemo(
    () => ({
      completeTimerStepRequest,
      requestCompleteTimerStep,
      stopAlarmSignal,
      requestStopAlarm,
    }),
    [completeTimerStepRequest, stopAlarmSignal],
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
