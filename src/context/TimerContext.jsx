import { createContext, useContext } from "react"

const TimerContext = createContext(null)

export function TimerProvider({ value, children }) {
  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}

export function useTimerContext() {
  const ctx = useContext(TimerContext)
  if (!ctx) {
    throw new Error("useTimerContext must be used inside TimerProvider")
  }
  return ctx
}
