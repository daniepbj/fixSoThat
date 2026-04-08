import { useState } from "react"
import { useMainTask } from "../context/MainTaskContext"
import MainTaskCard from "./MainTaskCard"

export default function MainTaskList() {
  const { mainTasks } = useMainTask()
  const [filter, setFilter] = useState("active")

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
    </section>
  )
}
