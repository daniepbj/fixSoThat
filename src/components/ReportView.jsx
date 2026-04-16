import { useMainTask } from "../context/MainTaskContext"
import { fmtDurationHuman, fmtLocalDateTime, isToday } from "../utils/timeUtils"

export default function ReportView({
  activeTasks,
  completedTasks,
  deletedTasks,
  deferredTasks,
  sessionSeconds,
  undoDeleteTask,
}) {
  const { deletedMainTasks, undoDeleteMainTask } = useMainTask()
  const todayCompleted = completedTasks.filter((t) => isToday(t.completedAt))
  const totalFocusSeconds = completedTasks.reduce(
    (sum, t) => sum + t.spentSeconds,
    0,
  )

  const stats = [
    { value: completedTasks.length, label: "Total completed" },
    { value: fmtDurationHuman(totalFocusSeconds), label: "Total focus time" },
    { value: todayCompleted.length, label: "Completed today" },
    { value: fmtDurationHuman(sessionSeconds), label: "Session time" },
    { value: activeTasks.length, label: "Active tasks" },
    { value: deferredTasks.length, label: "Deferred tasks" },
  ]

  return (
    <section className="view-panel">
      <h2 className="view-panel__title">📊 Report</h2>
      <div className="report-grid">
        {stats.map((s) => (
          <div key={s.label} className="report-stat">
            <span className="report-stat__value">{s.value}</span>
            <span className="report-stat__label">{s.label}</span>
          </div>
        ))}
      </div>

      {todayCompleted.length > 0 && (
        <>
          <h3 className="report-section-title">Completed today</h3>
          {todayCompleted.map((task) => (
            <div key={task.id} className="completed-task">
              <span>{task.emoji}</span>
              <span className="completed-task__title">{task.title}</span>
              <span className="completed-task__meta">
                {task.estimatedMinutes}m est ·{" "}
                {Math.round(task.spentSeconds / 60)}m actual
              </span>
            </div>
          ))}
        </>
      )}

      <h3 className="report-section-title">Deleted Tasks</h3>
      <div className="deleted-report-group">
        <h4 className="report-subsection-title">Timer list</h4>
        {deletedTasks.length === 0 && (
          <p className="list-empty">No deleted timer tasks.</p>
        )}
        {[...deletedTasks].reverse().map((task) => (
          <div key={task.id} className="deleted-task">
            <span>{task.emoji}</span>
            <span className="deleted-task__title">{task.title}</span>
            <span className="deleted-task__meta">
              {fmtLocalDateTime(task.deletedAt)}
            </span>
            <button
              type="button"
              className="deleted-task__undo"
              onClick={() => undoDeleteTask(task.id)}
            >
              Undo
            </button>
          </div>
        ))}
      </div>

      <div className="deleted-report-group">
        <h4 className="report-subsection-title">Main list</h4>
        {deletedMainTasks.length === 0 && (
          <p className="list-empty">No deleted main tasks.</p>
        )}
        {[...deletedMainTasks].reverse().map((task) => (
          <div key={task.id} className="deleted-task">
            <span>•</span>
            <span className="deleted-task__title">{task.title}</span>
            <span className="deleted-task__meta">
              {fmtLocalDateTime(task.deletedAt)}
            </span>
            <button
              type="button"
              className="deleted-task__undo"
              onClick={() => undoDeleteMainTask(task.id)}
            >
              Undo
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
