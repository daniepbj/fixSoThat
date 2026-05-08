import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react"
import { calculateRemaining, clampTimerDuration } from "../utils/timeUtils"

export const TimerContext = createContext(null)

const defaultTimerState = {
  duration: 0,
  elapsedSeconds: 0,
  timerRunning: false,
}

let internalTimerState = defaultTimerState
let bareProviderMountCount = 0
const internalTimerListeners = new Set()

function emitInternalTimerChange() {
  internalTimerListeners.forEach((listener) => listener())
}

function subscribeToInternalTimer(listener) {
  internalTimerListeners.add(listener)
  return () => {
    internalTimerListeners.delete(listener)
  }
}

function getInternalTimerSnapshot() {
  return internalTimerState
}

function setInternalTimerState(nextState) {
  internalTimerState = nextState
  emitInternalTimerChange()
}

function updateInternalTimerState(updater) {
  setInternalTimerState(updater(internalTimerState))
}

function resetInternalTimerState() {
  setInternalTimerState(defaultTimerState)
}

export function TimerProvider({ value, children }) {
  const snapshot = useSyncExternalStore(
    subscribeToInternalTimer,
    getInternalTimerSnapshot,
    getInternalTimerSnapshot,
  )

  useEffect(() => {
    if (value) return undefined
    bareProviderMountCount += 1
    return () => {
      bareProviderMountCount -= 1
      if (bareProviderMountCount <= 0) {
        bareProviderMountCount = 0
        resetInternalTimerState()
      }
    }
  }, [value])

  const internalValue = useMemo(() => {
    function startTimer(nextDuration) {
      const clampedDuration = clampTimerDuration(nextDuration)
      setInternalTimerState({
        duration: clampedDuration,
        elapsedSeconds: 0,
        timerRunning: clampedDuration > 0,
      })
    }

    function stopTimer() {
      updateInternalTimerState((currentState) => ({
        ...currentState,
        timerRunning: false,
      }))
    }

    function pauseTimer() {
      updateInternalTimerState((currentState) => ({
        ...currentState,
        timerRunning: false,
      }))
    }

    function resetTimer() {
      resetInternalTimerState()
    }

    function setDuration(nextDuration) {
      const clampedDuration = clampTimerDuration(nextDuration)
      updateInternalTimerState((currentState) => ({
        duration: clampedDuration,
        elapsedSeconds: Math.min(currentState.elapsedSeconds, clampedDuration),
        timerRunning: clampedDuration === 0 ? false : currentState.timerRunning,
      }))
    }

    function addTime(deltaSeconds) {
      updateInternalTimerState((currentState) => {
        const baseDuration =
          currentState.duration > 0 ? currentState.duration : 60
        return {
          ...currentState,
          duration: clampTimerDuration(baseDuration + deltaSeconds, {
            allowZero: false,
          }),
        }
      })
    }

    return {
      duration: snapshot.duration,
      elapsedSeconds: snapshot.elapsedSeconds,
      remainingSeconds: calculateRemaining(
        snapshot.duration,
        snapshot.elapsedSeconds,
      ),
      timerRunning: snapshot.timerRunning,
      actions: {
        startTimer,
        stopTimer,
        pauseTimer,
        resetTimer,
        setDuration,
        addTime,
      },
    }
  }, [snapshot.duration, snapshot.elapsedSeconds, snapshot.timerRunning])

  return (
    <TimerContext.Provider value={value ?? internalValue}>
      {children}
    </TimerContext.Provider>
  )
}

export function useTimerContext() {
  const ctx = useContext(TimerContext)
  if (!ctx) {
    throw new Error("useTimerContext must be used inside TimerProvider")
  }
  return ctx
}

export function useTimer() {
  return useTimerContext()
}
