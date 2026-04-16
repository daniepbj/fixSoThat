import { useState, useEffect } from "react"
import {
  fmtDuration,
  fmtTimerDisplay,
  projectedEndTimeLocal,
  currentTimeLocal,
  getTimezone,
  secondsSince,
} from "../utils/timeUtils"

export default function TopBar({
  sessionSeconds,
  totalRemainingSeconds,
  settings,
  setSettings,
  theme,
  setTheme,
  pomoEnabled,
  pomoWorkStart,
  pomoWorkDuration,
  onBreak,
  musicMuted,
  setMusicMuted,
}) {
  const [clock, setClock] = useState(currentTimeLocal())
  const [pomoElapsed, setPomoElapsed] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setClock(currentTimeLocal()), 10_000)
    return () => clearInterval(id)
  }, [])

  // Live pomodoro countdown
  useEffect(() => {
    if (!pomoEnabled || !pomoWorkStart || onBreak) {
      setPomoElapsed(0)
      return
    }
    function tick() {
      setPomoElapsed(secondsSince(pomoWorkStart))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [pomoEnabled, pomoWorkStart, onBreak])

  const pomoRemaining = Math.max(0, pomoWorkDuration - pomoElapsed)
  const pomoProgress =
    pomoWorkDuration > 0 ? Math.min(1, pomoElapsed / pomoWorkDuration) : 0

  function toggleSound() {
    setMusicMuted((prev) => !prev)
  }

  return (
    <>
      <header className="top-bar">
        <div className="top-bar__stat">
          <span className="top-bar__label">List time</span>
          <span className="top-bar__value">{fmtDuration(sessionSeconds)}</span>
        </div>
        <div className="top-bar__center" title={getTimezone()}>
          🕐 {clock}{" "}
          <span style={{ fontSize: "0.65em", opacity: 0.6 }}>
            ({getTimezone()})
          </span>
        </div>
        <div className="top-bar__right">
          <div className="top-bar__stat top-bar__stat--right">
            <span className="top-bar__label">End time</span>
            <span className="top-bar__value">
              {projectedEndTimeLocal(totalRemainingSeconds)}
            </span>
          </div>
          <button
            className={`top-bar__sound ${musicMuted ? "" : "active"}`}
            onClick={toggleSound}
            title={musicMuted ? "Unmute music" : "Mute music"}
          >
            {musicMuted ? "🔇" : "🔊"}
          </button>
          <button
            className="top-bar__sound"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>
      {pomoEnabled && pomoWorkStart && !onBreak && (
        <div className="pomo-strip">
          <span className="pomo-strip__icon">🍅</span>
          <div className="pomo-strip__track">
            <div
              className="pomo-strip__fill"
              style={{ width: `${pomoProgress * 100}%` }}
            />
          </div>
          <span className="pomo-strip__time">
            {fmtTimerDisplay(pomoRemaining)}
          </span>
          <span className="pomo-strip__label">until break</span>
        </div>
      )}
    </>
  )
}
