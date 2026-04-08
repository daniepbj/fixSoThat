import { useMainTask } from "../context/MainTaskContext"
import { parseStepRaw, sortStepsWithLinks } from "../utils/stepUtils"

export default function SidebarTaskSteps() {
  const {
    mainTasks,
    activeMainTaskId,
    setActiveMainTaskId,
    toggleStepComplete,
    completeMainTask,
    incrementTries,
    decrementTries,
    incrementStepTries,
    decrementStepTries,
  } = useMainTask()

  const task = mainTasks.find((t) => t.id === activeMainTaskId)

  if (!task) return null

  const completedCount = task.steps.filter((s) => s.completed).length
  const totalCount = task.steps.length
  const allDone = totalCount > 0 && completedCount === totalCount
  const sortedSteps = sortStepsWithLinks(task.steps, { includeCompleted: true })

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
        {sortedSteps.map((step) => {
          const parsed = parseStepRaw(step.raw)
          return (
            <div key={step.id} className="sidebar-step">
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
              <span className="sidebar-step__step-tries">
                {step.tries || 0}×
                <button
                  type="button"
                  className="sidebar-step__tries-btn"
                  onClick={() => decrementStepTries(task.id, step.id)}
                  title="Decrease step tries"
                >
                  -
                </button>
                <button
                  type="button"
                  className="sidebar-step__tries-btn"
                  onClick={() => incrementStepTries(task.id, step.id)}
                  title="Increase step tries"
                >
                  +
                </button>
              </span>
            </div>
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
          onClick={() => decrementTries(task.id)}
          title={`Tries: ${task.tries || 0}`}
        >
          Tries: {task.tries || 0} -
        </button>
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
