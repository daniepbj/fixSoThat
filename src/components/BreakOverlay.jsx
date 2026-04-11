import { useEffect, useRef } from "react"
import { fmtTimerDisplay } from "../utils/timeUtils"
import { startBeachLoop, stopBeachLoop } from "../utils/alarm"

const BEACH_EMOJIS = [
  "🏖️",
  "🌊",
  "🐚",
  "🦀",
  "🌴",
  "☀️",
  "🍹",
  "🐠",
  "🌺",
  "🦩",
  "⛱️",
  "🧴",
  "🥥",
  "🦞",
  "🐬",
  "🎶",
]

const TIPS = [
  "Stretch your arms overhead 🙆",
  "Look away from your screen 👀",
  "Take three deep breaths 🌬️",
  "Roll your shoulders slowly 🔄",
  "Wiggle your toes in the sand 🦶",
  "Close your eyes for 10 seconds 😌",
  "Drink some water 💧",
  "Smile — you've earned this 😊",
]

export default function BreakOverlay({
  secondsLeft,
  totalSeconds,
  onSkip,
  taskMusicRef,
  musicVolume,
}) {
  const progress =
    totalSeconds > 0 ? Math.max(0, 1 - secondsLeft / totalSeconds) : 1
  const tipIndex =
    Math.floor((1 - secondsLeft / Math.max(1, totalSeconds)) * TIPS.length) %
    TIPS.length
  const fadeRef = useRef(null)

  // Play beach.mp3 loop via Web Audio API (same context as alarm — no autoplay issues)
  useEffect(() => {
    startBeachLoop(0.5)
    return () => stopBeachLoop()
  }, [])

  // Fade music out on mount, restore on unmount
  useEffect(() => {
    const audio = taskMusicRef?.current
    if (!audio) return
    const savedVolume = audio.volume
    let vol = savedVolume
    // Fade out over 1.5s
    fadeRef.current = setInterval(() => {
      vol = Math.max(0, vol - 0.05)
      audio.volume = vol
      if (vol <= 0) {
        clearInterval(fadeRef.current)
        audio.pause()
      }
    }, 75)

    return () => {
      clearInterval(fadeRef.current)
      // Restore volume and resume
      const restoreVol = Math.max(
        0,
        Math.min(1, Number(musicVolume) || savedVolume),
      )
      audio.volume = restoreVol
      if (audio.src && audio.paused) {
        audio.play().catch(() => {})
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="break-overlay" role="dialog" aria-label="Break time">
      {/* Sky gradient is the overlay background itself */}
      <div className="break-overlay__sun" />
      <div className="break-overlay__clouds">
        <div className="break-cloud break-cloud--1" />
        <div className="break-cloud break-cloud--2" />
        <div className="break-cloud break-cloud--3" />
      </div>

      <div className="break-overlay__emojis">
        {BEACH_EMOJIS.map((e, i) => (
          <span
            key={i}
            className="break-overlay__emoji"
            style={{
              animationDelay: `${i * 0.4}s`,
              left: `${3 + ((i * 7.5) % 88)}%`,
              top: `${15 + ((i * 13) % 45)}%`,
              fontSize: `${1.4 + (i % 3) * 0.4}rem`,
            }}
          >
            {e}
          </span>
        ))}
      </div>

      <div className="break-overlay__ocean">
        <div className="break-wave break-wave--1" />
        <div className="break-wave break-wave--2" />
        <div className="break-wave break-wave--3" />
      </div>

      {/* Sand */}
      <div className="break-overlay__sand" />

      <div className="break-overlay__content">
        <h1 className="break-overlay__title">🏖️ Beach Break!</h1>
        <p className="break-overlay__subtitle">
          Tasks are paused. Take a moment for yourself.
        </p>

        <div className="break-overlay__timer">
          <svg className="break-ring" viewBox="0 0 140 140" aria-hidden="true">
            <circle className="break-ring__track" cx="70" cy="70" r="60" />
            <circle
              className="break-ring__fill"
              cx="70"
              cy="70"
              r="60"
              pathLength={1}
              strokeDasharray={`${progress} 1`}
              style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
            />
          </svg>
          <span className="break-overlay__countdown">
            {fmtTimerDisplay(secondsLeft)}
          </span>
        </div>

        <p className="break-overlay__tip">{TIPS[tipIndex]}</p>

        <button className="break-overlay__skip" onClick={onSkip}>
          Back to work →
        </button>
      </div>
    </div>
  )
}
