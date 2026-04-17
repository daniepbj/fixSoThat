import { useTimerContext } from "../context/TimerContext"
import { fmtTimerDisplay, getHourRingProgress } from "../utils/timeUtils"
import WaitingTaskPanel from "./WaitingTaskPanel"

export default function TimerPanel() {
  const {
    currentTask,
    timerRunning,
    toggleTimerWithClick,
    adjustTime,
    alarmActive,
    stopAlarm,
    hasSelectedTrack,
    hasUploadedTracks,
    waitingTask,
  } = useTimerContext()
  const remaining = currentTask?.remainingSeconds ?? 0
  const progress = getHourRingProgress(remaining)

  // SVG ring
  const r = 88
  // Keep zero at top and fill left side as time increases:
  // 15m => top->left, 30m => top->left->bottom.
  const offset = 0

  function toggle() {
    if (!currentTask) return
    toggleTimerWithClick()
  }

  const showNoMusicHint = Boolean(currentTask) && !hasSelectedTrack
  const noMusicHintText = hasUploadedTracks
    ? "No track selected. Open Settings to choose one."
    : "No music uploaded yet. Open Settings to add a track."

  return (
    <section
      className={`timer-panel${timerRunning ? " timer-panel--running" : ""}${alarmActive ? " timer-panel--alarm" : ""}`}
      style={{ "--timer-glow-color": currentTask?.color ?? "#6c63ff" }}
    >
        {waitingTask && <WaitingTaskPanel />}
        <div className="timer-ring-wrapper">
        <svg
          className="timer-ring"
          viewBox="0 0 200 200"
          aria-hidden="true"
          style={{
            transform: "rotate(90deg) scaleX(-1)",
            transformOrigin: "center",
          }}
        >
          <circle className="timer-ring__track" cx="100" cy="100" r={r} />
          <circle
            className="timer-ring__progress"
            cx="100"
            cy="100"
            r={r}
            pathLength={1}
            strokeDasharray={`${progress} 1`}
            strokeDashoffset={offset}
            style={{ stroke: currentTask?.color ?? "#6c63ff" }}
          />
        </svg>
        <div className="timer-zero-marker" aria-hidden="true">
          00
        </div>
        <div className="timer-ring__center">
          <div className="timer-display">{fmtTimerDisplay(remaining)}</div>
          {currentTask && (
            <div className="timer-task-label">
              {currentTask.emoji} {currentTask.title}
            </div>
          )}
          {!currentTask && (
            <div className="timer-task-label" style={{ opacity: 0.4 }}>
              No active task
            </div>
          )}
        </div>
      </div>

      <div className="timer-controls">
        <button
          className="timer-btn timer-btn--adjust"
          onClick={() => adjustTime(-300)}
          title="−5 minutes"
          disabled={!currentTask}
        >
          −5m
        </button>
        <button
          className="timer-btn timer-btn--play"
          onClick={toggle}
          disabled={!currentTask}
          aria-label={timerRunning ? "Pause timer" : "Start timer"}
        >
          {timerRunning ? "⏸" : "▶"}
        </button>
        <button
          className="timer-btn timer-btn--adjust"
          onClick={() => adjustTime(300)}
          title="+5 minutes"
          disabled={!currentTask}
        >
          +5m
        </button>
      </div>

      {showNoMusicHint && (
        <p className="timer-music-hint" role="status">
          {noMusicHintText}
        </p>
      )}

      {alarmActive && (
        <button className="timer-btn timer-btn--dismiss" onClick={stopAlarm}>
          🔕 Dismiss alarm
        </button>
      )}
    </section>
  )
}
