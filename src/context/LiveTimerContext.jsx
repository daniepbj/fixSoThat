/**
 * LiveTimerContext — single source of truth for the active timer queue.
 *
 * Lives at App level (above TimerApp) so every component — including
 * builders that sit outside TimerProvider — can access live timer state
 * without each maintaining their own localStorage polling interval.
 *
 * Exposes:
 *   liveTimerTask   — head of fst_active queue, or null
 *   liveTimerQueue  — full fst_active array
 *   getLiveData(sourceStepId, sourceMainTaskId?) → LiveData | null
 *
 * @typedef {{ ratio: number, remaining: number, isActive: boolean, color: string }} LiveData
 */

import { createContext, useContext, useEffect, useState } from "react"

const LiveTimerContext = createContext(null)

/**
 * Pure function — extracted so unit tests can import it directly.
 *
 * @param {string} sourceStepId
 * @param {string|null} sourceMainTaskId  — pass null to skip mainTask filter
 * @param {object[]} queue               — full fst_active array
 * @param {object|null} head             — queue[0] or null
 * @returns {LiveData|null}
 */
export function computeLiveData(sourceStepId, sourceMainTaskId, queue, head) {
  if (!sourceStepId) return null

  const entries = (queue || []).filter(
    (item) =>
      item?.sourceStepId === sourceStepId &&
      (sourceMainTaskId == null || item?.sourceMainTaskId === sourceMainTaskId),
  )

  if (!entries.length) return null

  const active = head && entries.find((item) => item.id === head.id)
  const picked = active || entries[0]

  const totalSeconds = Math.max(1, (Number(picked?.estimatedMinutes) || 1) * 60)
  const remaining = Math.max(0, Number(picked?.remainingSeconds) || 0)
  const ratio = Math.max(0, Math.min(1, remaining / totalSeconds))

  return {
    ratio,
    remaining,
    color: active ? "#34d195" : picked?.color || "#6c63ff",
    isActive: Boolean(active),
  }
}

/**
 * Build inline style for an active input/textarea field.
 * The green gradient fill shrinks from right to left as ratio drops 1→0.
 *
 * @param {LiveData} live
 * @returns {React.CSSProperties}
 */
export function activeFieldStyle(live) {
  const pct = `${Math.round((live?.ratio ?? 1) * 100)}%`
  return {
    borderColor: "rgba(173, 255, 209, 0.9)",
    background: `linear-gradient(to right, rgba(52,209,149,0.22) ${pct}, rgba(52,209,149,0.04) ${pct})`,
    boxShadow:
      "0 0 0 2px rgba(173, 255, 209, 0.42), 0 0 24px rgba(52, 209, 149, 0.28)",
  }
}

export function LiveTimerProvider({ children }) {
  const [queue, setQueue] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem("fst_active") || "[]")
    } catch {
      return []
    }
  })

  useEffect(() => {
    function read() {
      try {
        setQueue(JSON.parse(window.localStorage.getItem("fst_active") || "[]"))
      } catch {
        setQueue([])
      }
    }

    const id = setInterval(read, 1000)
    return () => clearInterval(id)
  }, [])

  const head = Array.isArray(queue) && queue.length > 0 ? queue[0] : null

  function getLiveData(sourceStepId, sourceMainTaskId = null) {
    return computeLiveData(sourceStepId, sourceMainTaskId, queue, head)
  }

  return (
    <LiveTimerContext.Provider
      value={{ liveTimerTask: head, liveTimerQueue: queue, getLiveData }}
    >
      {children}
    </LiveTimerContext.Provider>
  )
}

export function useLiveTimer() {
  const ctx = useContext(LiveTimerContext)
  if (!ctx) {
    throw new Error("useLiveTimer must be used inside LiveTimerProvider")
  }
  return ctx
}
