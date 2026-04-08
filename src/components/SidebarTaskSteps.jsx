import { useMainTask } from "../context/MainTaskContext"
import { parseStepRaw } from "../utils/stepUtils"

export default function SidebarTaskSteps() {
  const {
    mainTasks,
    activeMainTaskId,
    setActiveMainTaskId,
    toggleStepComplete,
    completeMainTask,
    incrementTries,
  } = useMainTask()

  const task = mainTasks.find((t) => t.id === activeMainTaskId)

  if (!task) return null

  const completedCount = task.steps.filter((s) => s.completed).length
  const totalCount = task.steps.length
  const allDone = totalCount > 0 && completedCount === totalCount

  return (
    <div className="sidebar-steps">
      <div className="sidebar-steps__header">
        <span
          className="sidebar-steps__title"
          title={`Fixa så att jag ${task.title}`}
        >
          ▸ {task.title || "Unnamed task"}
        </span>
        <button
          type="button"
          className="sidebar-steps__close"
          onClick={() => setActiveMainTaskId("")}
          title="Clear active task"
        >
          ×
        </button>
      </div>

      {totalCount > 0 && (
        <div className="sidebar-steps__progress">
          {completedCount}/{totalCount} steps
        </div>
      )}

      <div className="sidebar-steps__list">
        {task.steps.map((step) => {
          const parsed = parseStepRaw(step.raw)
          return (
            <label key={step.id} className="sidebar-step">
              <input
                type="checkbox"
                checked={step.completed}
                onChange={() => toggleStepComplete(task.id, step.id)}
              />
              <span
                className={`sidebar-step__text ${step.completed ? "sidebar-step__text--done" : ""}`}
              >
                {parsed.text || step.raw}
              </span>
              {parsed.minutes > 0 && (
                <span className="sidebar-step__time">{parsed.minutes}m</span>
              )}
            </label>
          )
        })}
      </div>

      {task.steps.length === 0 && (
        <p className="sidebar-steps__empty">No steps.</p>
      )}

      <div className="sidebar-steps__actions">
        <button
          type="button"
          className="sidebar-steps__try-btn"
          onClick={() => incrementTries(task.id)}
          title={`Tries: ${task.tries || 0}`}
        >
          Tries: {task.tries || 0} +
        </button>
        {allDone && (
          <button
            type="button"
            className="sidebar-steps__complete-btn"
            onClick={() => {
              if (window.confirm("Complete this entire task?")) {
                completeMainTask(task.id)
              }
            }}
          >
            ✓ Complete!
          </button>
        )}
      </div>
    </div>
  )
}
