import { useEffect, useState } from "react"
import { useTimerContext } from "../context/TimerContext"

export default function WaitingTaskPanel() {
  const {
    waitingTask,
    cancelWait,
    waitExpiring,
    activeTasks,
    setWaitFollowUpTask,
  } = useTimerContext()
  const [countdown, setCountdown] = useState(0)
  const [progress, setProgress] = useState(1)

  useEffect(() => {
    if (!waitingTask) return
    const totalMs = Math.max(1000, (Number(waitingTask.waitDurationSeconds) || 1) * 1000)
    function tick() {
      const msLeft = new Date(waitingTask.waitUntil).getTime() - Date.now()
      const secsLeft = Math.max(0, Math.ceil(msLeft / 1000))
      const ratio = Math.max(0, msLeft / totalMs)
      setCountdown(secsLeft)
      setProgress(ratio)
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [waitingTask])

  if (!waitingTask) return null

  const mins = Math.floor(countdown / 60)
  const secs = countdown % 60
  const display = `${mins}:${String(secs).padStart(2, "0")}`
  const accentColor = waitingTask.color ?? "#f59e0b"

  return (
    <div
      className={`waiting-task-panel${waitExpiring ? " waiting-task-panel--exiting" : ""}`}
      style={{ "--wtp-accent": accentColor }}
      role="status"
      aria-live="polite"
      aria-label={`Waiting: ${waitingTask.title}, ${display} remaining`}
    >
      <div className="waiting-task-panel__header">
        <span className="waiting-task-panel__label">⏳ Waiting</span>
        <button
          className="waiting-task-panel__cancel"
          onClick={cancelWait}
          title="Cancel wait — move task back to queue"
          aria-label="Cancel wait"
        >
          ✕
        </button>
      </div>
      <div className="waiting-task-panel__body">
        <div className="waiting-task-panel__task">
          <span className="waiting-task-panel__emoji">{waitingTask.emoji}</span>
          <span className="waiting-task-panel__title">{waitingTask.title}</span>
        </div>
        <div className="waiting-task-panel__countdown">{display}</div>
      </div>
      <div className="waiting-task-panel__followup">
        <label htmlFor="wait-follow-up-select" className="waiting-task-panel__followup-label">
          After wait, queue next:
        </label>
        <select
          id="wait-follow-up-select"
          className="waiting-task-panel__followup-select"
          value={waitingTask.followUpTaskId || ""}
          onChange={(e) => setWaitFollowUpTask(e.target.value)}
        >
          <option value="">Automatic continuation</option>
          {activeTasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.emoji} {task.title}
            </option>
          ))}
        </select>
      </div>
      <div className="waiting-task-panel__bar-track">
        <div
          className="waiting-task-panel__bar-fill"
          style={{ width: `${Math.min(100, progress * 100)}%` }}
        />
      </div>
    </div>
  )
}
