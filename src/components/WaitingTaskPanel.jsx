import { useEffect, useState } from "react"
import { useTimerContext } from "../context/TimerContext"

export default function WaitingTaskPanel() {
  const {
    waitingTask,
    cancelWait,
    waitExpiring,
    activeTasks,
    setWaitMode,
    setWaitDependencyTask,
    setWaitBlocksQueue,
    setWaitFollowUpTask,
    waitCompatibleQueuedTasks,
    waitCompatibleSuggestions,
    queueCompatibleMainTask,
    setMainTaskWaitCompatible,
  } = useTimerContext()
  const [countdown, setCountdown] = useState(0)
  const [progress, setProgress] = useState(1)

  useEffect(() => {
    if (!waitingTask) return
    const waitMode = waitingTask.waitMode || "time"
    if (waitMode !== "time") {
      setCountdown(0)
      setProgress(1)
      return
    }
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
  const waitMode = waitingTask.waitMode || "time"
  const dependencyId = waitingTask.waitDependencyTaskId || ""
  const dependencyTask = activeTasks.find((task) => task.id === dependencyId)
  const waitBlocksQueue = waitingTask.waitBlocksQueue !== false
  const hasCompatibleQueuedTasks = waitCompatibleQueuedTasks.length > 0

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
        <div className="waiting-task-panel__countdown">
          {waitMode === "time"
            ? display
            : dependencyTask
              ? `Waiting for ${dependencyTask.title}`
              : "Waiting for task completion"}
        </div>
      </div>
      <div className="waiting-task-panel__followup">
        <label htmlFor="wait-mode-select" className="waiting-task-panel__followup-label">
          Wait condition:
        </label>
        <select
          id="wait-mode-select"
          className="waiting-task-panel__followup-select"
          value={waitMode}
          onChange={(e) => setWaitMode(e.target.value)}
        >
          <option value="time">Timer duration</option>
          <option value="task">Task completion</option>
        </select>
      </div>
      <div className="waiting-task-panel__followup">
        <label className="waiting-task-panel__followup-label waiting-task-panel__queue-toggle">
          <input
            type="checkbox"
            checked={waitBlocksQueue}
            onChange={(e) => setWaitBlocksQueue(e.target.checked)}
          />
          Pause queue while waiting
        </label>
      </div>
      {waitMode === "task" && (
        <div className="waiting-task-panel__followup">
          <label
            htmlFor="wait-dependency-select"
            className="waiting-task-panel__followup-label"
          >
            Wait for task:
          </label>
          <select
            id="wait-dependency-select"
            className="waiting-task-panel__followup-select"
            value={dependencyId}
            onChange={(e) => setWaitDependencyTask(e.target.value)}
          >
            <option value="">Choose dependency task</option>
            {activeTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.emoji} {task.title}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="waiting-task-panel__followup">
        <label htmlFor="wait-follow-up-select" className="waiting-task-panel__followup-label">
          After wait condition, queue next:
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
      <div className="waiting-task-panel__compatible">
        <div className="waiting-task-panel__followup-label">
          Compatible while waiting:
        </div>
        {hasCompatibleQueuedTasks ? (
          <div className="waiting-task-panel__quick-picks">
            {waitCompatibleQueuedTasks.slice(0, 5).map((task) => (
              <button
                key={task.id}
                type="button"
                className="waiting-task-panel__quick-pick"
                onClick={() => setWaitFollowUpTask(task.id)}
                title="Queue this compatible task next"
              >
                {task.emoji} {task.title}
              </button>
            ))}
          </div>
        ) : (
          <div className="waiting-task-panel__suggestions">
            <p className="waiting-task-panel__suggestions-empty">
              No compatible queued tasks right now. Pick one below to queue now.
            </p>
            {waitCompatibleSuggestions.length === 0 && (
              <p className="waiting-task-panel__suggestions-empty">
                No active suggestions yet. Mark tasks as compatible in Task list.
              </p>
            )}
            {waitCompatibleSuggestions.map((task) => (
              <div key={task.id} className="waiting-task-panel__suggestion-row">
                <button
                  type="button"
                  className="waiting-task-panel__suggestion-pick"
                  onClick={() => queueCompatibleMainTask(task.id)}
                  title="Add this compatible task into queue"
                >
                  + Queue {task.title}
                </button>
                <span className="waiting-task-panel__suggestion-reason">
                  {task.suggestionReason}
                </span>
                <label className="waiting-task-panel__suggestion-mark">
                  <input
                    type="checkbox"
                    checked={Boolean(task.waitCompatible)}
                    onChange={(e) =>
                      setMainTaskWaitCompatible(task.id, e.target.checked)
                    }
                  />
                  keep
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="waiting-task-panel__bar-track">
        <div
          className={`waiting-task-panel__bar-fill${waitMode === "task" ? " waiting-task-panel__bar-fill--dependency" : ""}`}
          style={{ width: `${Math.min(100, (waitMode === "time" ? progress : 1) * 100)}%` }}
        />
      </div>
    </div>
  )
}
