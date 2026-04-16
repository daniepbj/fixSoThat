import { useEffect, useState } from "react"
import { useMainTask } from "../context/MainTaskContext"
import { fmtLocalDateTime } from "../utils/timeUtils"
import MainTaskCard from "./MainTaskCard"

export default function MainTaskList() {
  const {
    deletedMainTasks,
    mainTasks,
    activeMainTaskId,
    undoDeleteMainTask,
    clearDeletedMainTasks,
  } = useMainTask()
  const [filter, setFilter] = useState("active")
  const [showDeleted, setShowDeleted] = useState(false)

  useEffect(() => {
    if (activeMainTaskId && filter === "completed") {
      setFilter("active")
    }
  }, [activeMainTaskId, filter])

  const filtered = mainTasks.filter((t) => {
    if (filter === "active") return t.status === "active"
    if (filter === "completed") return t.status === "completed"
    return true
  })

  const activeCount = mainTasks.filter((t) => t.status === "active").length
  const completedCount = mainTasks.filter(
    (t) => t.status === "completed",
  ).length

  return (
    <section className="mtask-list-section" aria-label="Internal task list">
      <div className="mtask-list-header">
        <h2 className="mtask-list-title">Task list</h2>
        <div className="mtask-filter-row">
          <button
            type="button"
            className={`mtask-filter-btn ${filter === "active" ? "mtask-filter-btn--on" : ""}`}
            onClick={() => setFilter("active")}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            className={`mtask-filter-btn ${filter === "completed" ? "mtask-filter-btn--on" : ""}`}
            onClick={() => setFilter("completed")}
          >
            Done ({completedCount})
          </button>
          <button
            type="button"
            className={`mtask-filter-btn ${filter === "all" ? "mtask-filter-btn--on" : ""}`}
            onClick={() => setFilter("all")}
          >
            All ({mainTasks.length})
          </button>
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="mtask-empty-state">
          {filter === "active"
            ? "No active tasks. Load a Fixa output above to add one."
            : "Nothing here yet."}
        </p>
      )}

      <div className="mtask-list-cards">
        {filtered.map((task) => (
          <MainTaskCard key={task.id} task={task} />
        ))}
      </div>

      <div className="mtask-deleted-section">
        <div className="mtask-deleted-section__header">
          <button
            type="button"
            className="mtask-filter-btn"
            onClick={() => setShowDeleted((open) => !open)}
          >
            {showDeleted ? "▲" : "▼"} Deleted ({deletedMainTasks.length})
          </button>
          {deletedMainTasks.length > 0 && (
            <button
              type="button"
              className="mtask-action-btn mtask-action-btn--danger"
              onClick={clearDeletedMainTasks}
            >
              Clear all
            </button>
          )}
        </div>
        {showDeleted && (
          <div className="mtask-deleted-list">
            {deletedMainTasks.length === 0 && (
              <p className="mtask-empty-state">No deleted main tasks.</p>
            )}
            {[...deletedMainTasks].reverse().map((task) => (
              <div key={task.id} className="mtask-deleted-item">
                <span className="mtask-deleted-item__title">{task.title}</span>
                <span className="mtask-deleted-item__meta">
                  {fmtLocalDateTime(task.deletedAt)}
                </span>
                <button
                  type="button"
                  className="mtask-action-btn"
                  onClick={() => undoDeleteMainTask(task.id)}
                >
                  Undo
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
