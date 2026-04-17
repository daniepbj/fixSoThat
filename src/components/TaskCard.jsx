import { useState } from "react"
import { useTimerContext } from "../context/TimerContext"
import { useMainTask } from "../context/MainTaskContext"
import {
  fmtDuration,
  getHourRingProgress,
  projectedEndTimeLocal,
} from "../utils/timeUtils"

export default function TaskCard({
  task,
  isFirst,
  index,
  totalTasks,
  completeTask,
  deleteTask,
  resetTask,
  deferTask,
  moveUp,
  moveDown,
  moveToTop,
  moveToBottom,
  playTask,
  toggleTaskFlag,
}) {
  const {
    currentTask,
    timerRunning,
    waitingTask,
    waitTask,
    defaultTaskDuration,
  } = useTimerContext()
  const [waitMinutes, setWaitMinutes] = useState("")
  const { addSubstep } = useMainTask()
  const [showSubstepInput, setShowSubstepInput] = useState(false)
  const [substepRaw, setSubstepRaw] = useState("")
  const flags = {
    needsSteps: false,
    needsTime: false,
    needsProof: false,
    priority: false,
    ...(task.adhdFlags || {}),
  }
  const isFocusedTask = currentTask?.id === task.id
  const canBreakDownSourceStep = Boolean(
    task.sourceMainTaskId && task.sourceStepId,
  )

  // Mini pie chart for the current task
  const PIE_R = 15
  const ringProgress = getHourRingProgress(task.remainingSeconds)
  const totalSec = task.estimatedMinutes * 60
  const taskProgressRatio =
    totalSec > 0 ? Math.max(0, task.remainingSeconds / totalSec) : 0

  function handleStepsAction() {
    if (!task.sourceMainTaskId || !task.sourceStepId) {
      toggleTaskFlag(task.id, "needsSteps")
      return
    }
    setShowSubstepInput((v) => !v)
    setSubstepRaw("")
  }

  function handleAddSubstep() {
    if (!substepRaw.trim() || !task.sourceMainTaskId || !task.sourceStepId)
      return
    addSubstep(task.sourceMainTaskId, task.sourceStepId, substepRaw.trim())
    setSubstepRaw("")
  }

  return (
    <div
      data-task-id={task.id}
      className={`task-card ${isFirst ? "task-card--current" : ""}`}
      style={{
        borderLeftColor: task.color,
        "--task-focus-color": task.color,
        background: `linear-gradient(135deg, ${`color-mix(in srgb, ${task.color} 12%, var(--ta-card))`} 0%, var(--ta-card) 55%)`,
      }}
    >
      <div className="task-card__header">
        {isFirst ? (
          <div className="task-pie-wrap">
            <svg
              className="task-pie"
              viewBox="0 0 36 36"
              style={{
                transform: "rotate(90deg) scaleX(-1)",
                transformOrigin: "center",
              }}
              aria-hidden="true"
            >
              <circle
                cx="18"
                cy="18"
                r={PIE_R}
                fill="none"
                stroke="rgba(128,128,128,0.22)"
                strokeWidth="4"
              />
              <circle
                cx="18"
                cy="18"
                r={PIE_R}
                fill="none"
                stroke={task.color}
                strokeWidth="4"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={`${ringProgress} 1`}
              />
            </svg>
            <span className="task-pie__emoji">{task.emoji}</span>
          </div>
        ) : (
          <span className="task-card__emoji">{task.emoji}</span>
        )}
        <div className="task-card__info">
          {task.sourceMainTaskTitle && (
            <span className="task-card__main-title">
              * Fixa sa att jag {task.sourceMainTaskTitle}
            </span>
          )}
          <span className="task-card__title">
            {task.stepDepth > 0 ? `${"\u21b3 ".repeat(task.stepDepth)}` : ""}
            {task.title}
          </span>
          <span className="task-card__times">
            {fmtDuration(task.remainingSeconds)} left &nbsp;·&nbsp;
            {fmtDuration(task.spentSeconds)} spent &nbsp;·&nbsp;→{" "}
            {projectedEndTimeLocal(task.remainingSeconds)}
          </span>
        </div>
        <div
          className="task-card__adhd"
          aria-label="Task accessibility helpers"
        >
          <button
            className={`task-card__tag ${flags.needsSteps ? "active" : ""}`}
            onClick={handleStepsAction}
            aria-pressed={canBreakDownSourceStep ? undefined : flags.needsSteps}
            title={
              canBreakDownSourceStep
                ? "Break this step into substeps"
                : "Needs steps"
            }
          >
            Steps
          </button>
          <button
            className={`task-card__tag ${flags.needsTime ? "active" : ""}`}
            onClick={() => toggleTaskFlag(task.id, "needsTime")}
            aria-pressed={flags.needsTime}
            title="Needs time"
          >
            Time
          </button>
          <button
            className={`task-card__tag ${flags.needsProof ? "active" : ""}`}
            onClick={() => toggleTaskFlag(task.id, "needsProof")}
            aria-pressed={flags.needsProof}
            title="Needs proof"
          >
            Proof
          </button>
          <button
            className={`task-card__tag ${flags.priority ? "active" : ""}`}
            onClick={() => toggleTaskFlag(task.id, "priority")}
            aria-pressed={flags.priority}
            title="Priority"
          >
            Priority
          </button>
        </div>
        <div className="task-card__order">
          <button
            type="button"
            className="task-card__header-delete"
            onClick={() => deleteTask(task.id)}
            title="Delete task"
            aria-label={`Delete ${task.title}`}
          >
            Delete
          </button>
          <button
            className="task-card__icon-btn"
            onClick={() => moveToTop(task.id)}
            disabled={index === 0}
            title="Move to top"
          >
            ⤒
          </button>
          <button
            className="task-card__icon-btn"
            onClick={() => moveUp(task.id)}
            disabled={index === 0}
            title="Move up"
          >
            ↑
          </button>
          <button
            className="task-card__icon-btn"
            onClick={() => moveDown(task.id)}
            disabled={index === totalTasks - 1}
            title="Move down"
          >
            ↓
          </button>
          <button
            className="task-card__icon-btn"
            onClick={() => moveToBottom(task.id)}
            disabled={index === totalTasks - 1}
            title="Move to bottom"
          >
            ⤓
          </button>
        </div>
      </div>

      <div className="task-card__actions">
        <button
          className="task-card__btn task-card__btn--playtask"
          onClick={() => playTask(task.id)}
          title="Focus and play this task"
        >
          {isFocusedTask && timerRunning ? "▶ Focused" : "▶ Focus"}
        </button>
        <button
          className="task-card__btn task-card__btn--complete"
          onClick={() => completeTask(task.id)}
        >
          ✓ Done
        </button>
        <button
          className="task-card__btn task-card__btn--reset"
          onClick={() => resetTask(task.id)}
        >
          ↺ Reset
        </button>
        <button
          className="task-card__btn task-card__btn--defer"
          onClick={() => deferTask(task.id)}
        >
          ⏭ Not now
        </button>
        <input
          type="number"
          className="wait-minutes-input"
          min="1"
          max="120"
          value={waitMinutes}
          onChange={(e) => setWaitMinutes(e.target.value)}
          placeholder={defaultTaskDuration ?? 2}
          title="Wait duration in minutes"
          aria-label="Wait minutes"
          disabled={Boolean(waitingTask)}
        />
        <button
          className="task-card__btn task-card__btn--wait"
          onClick={() =>
            waitTask(
              task.id,
              waitMinutes !== ""
                ? Number(waitMinutes)
                : (defaultTaskDuration ?? 2),
            )
          }
          disabled={Boolean(waitingTask)}
          title={
            waitingTask
              ? "Another task is already waiting"
              : "Move task aside and set a wait timer"
          }
        >
          ⏸ Wait
        </button>
      </div>

      <div className="task-progress" aria-hidden="true">
        <div
          className="task-progress__fill"
          style={{
            width: `${Math.max(0, Math.min(100, taskProgressRatio * 100))}%`,
            background: task.color,
          }}
        />
      </div>

      {showSubstepInput && task.sourceMainTaskId && task.sourceStepId && (
        <div className="task-card__substep-input">
          <input
            className="task-card__substep-field"
            value={substepRaw}
            onChange={(e) => setSubstepRaw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAddSubstep()
              }
              if (e.key === "Escape") setShowSubstepInput(false)
            }}
            placeholder="Add substep (e.g. Diska 5)"
            autoFocus
          />
          <button
            type="button"
            className="task-card__btn"
            onClick={handleAddSubstep}
          >
            +
          </button>
          <button
            type="button"
            className="task-card__btn"
            onClick={() => setShowSubstepInput(false)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
