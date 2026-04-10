import { useState, useEffect } from "react"
import { fmtDuration, projectedEndTimeLocal, currentTimeLocal, getTimezone } from "../utils/timeUtils"

export default function TopBar({
  sessionSeconds,
  totalRemainingSeconds,
  settings,
  setSettings,
  theme,
  setTheme,
}) {
  const [clock, setClock] = useState(currentTimeLocal())
  useEffect(() => {
    const id = setInterval(() => setClock(currentTimeLocal()), 1000)
    return () => clearInterval(id)
  }, [])

  function toggleSound() {
    setSettings((s) => ({ ...s, soundEnabled: !s.soundEnabled }))
  }

  return (
    <header className="top-bar">
      <div className="top-bar__stat">
        <span className="top-bar__label">List time</span>
        <span className="top-bar__value">{fmtDuration(sessionSeconds)}</span>
      </div>
      <div className="top-bar__center" title={getTimezone()}>
        🕐 {clock} <span style={{fontSize:'0.65em',opacity:0.6}}>({getTimezone()})</span>
      </div>
      <div className="top-bar__right">
        <div className="top-bar__stat top-bar__stat--right">
          <span className="top-bar__label">End time</span>
          <span className="top-bar__value">
            {projectedEndTimeLocal(totalRemainingSeconds)}
          </span>
        </div>
        <button
          className={`top-bar__sound ${settings.soundEnabled ? "active" : ""}`}
          onClick={toggleSound}
          title={settings.soundEnabled ? "Mute soundscape" : "Play soundscape"}
        >
          {settings.soundEnabled ? "🔊" : "🔇"}
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
  )
}
