export default function DeferredTasksPanel({ deferredTasks, restoreDeferred, deleteDeferred }) {
  return (
    <section className="view-panel">
      <h2 className="view-panel__title">⏭ Not Now</h2>
      {deferredTasks.length === 0 && (
        <p className="list-empty">No deferred tasks. Use "Not now" on a task to park it here.</p>
      )}
      {deferredTasks.map(task => (
        <div key={task.id} className="task-card" style={{ borderLeftColor: task.color }}>
          <div className="task-card__header">
            <span className="task-card__emoji">{task.emoji}</span>
            <div className="task-card__info">
              <span className="task-card__title">{task.title}</span>
              <span className="task-card__times">{task.estimatedMinutes}m estimated</span>
            </div>
          </div>
          <div className="task-card__actions">
            <button className="task-card__btn task-card__btn--complete" onClick={() => restoreDeferred(task.id)}>
              ↩ Restore to active
            </button>
            <button className="task-card__btn task-card__btn--delete" onClick={() => deleteDeferred(task.id)}>
              ✕ Delete
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
