function fmtDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function ReportView({
  activeTasks,
  completedTasks,
  deferredTasks,
  sessionSeconds,
}) {
  const today = new Date().toDateString()
  const todayCompleted = completedTasks.filter(
    (t) => new Date(t.completedAt).toDateString() === today,
  )
  const totalFocusSeconds = completedTasks.reduce(
    (sum, t) => sum + t.spentSeconds,
    0,
  )

  const stats = [
    { value: completedTasks.length, label: "Total completed" },
    { value: fmtDuration(totalFocusSeconds), label: "Total focus time" },
    { value: todayCompleted.length, label: "Completed today" },
    { value: fmtDuration(sessionSeconds), label: "Session time" },
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
    </section>
  )
}
