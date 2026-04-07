function fmtSeconds(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function TaskCard({
  task, isFirst, index, totalTasks,
  completeTask, deleteTask, resetTask, deferTask, moveUp, moveDown, moveToTop, moveToBottom,
}) {
  const projectedEnd = new Date(Date.now() + task.remainingSeconds * 1000);

  // Mini pie chart for the current task
  const PIE_R = 15;
  const PIE_C = 2 * Math.PI * PIE_R;
  const totalSec = task.estimatedMinutes * 60;
  const remainingRatio = totalSec > 0 ? Math.max(0, task.remainingSeconds / totalSec) : 0;

  return (
    <div
      className={`task-card ${isFirst ? 'task-card--current' : ''}`}
      style={{
        borderLeftColor: task.color,
        background: `linear-gradient(135deg, ${task.color}30 0%, var(--ta-card) 55%)`,
      }}
    >
      <div className="task-card__header">
        {isFirst ? (
          <div className="task-pie-wrap">
            <svg
              className="task-pie"
              viewBox="0 0 36 36"
              style={{ transform: 'rotate(-90deg) scaleX(-1)', transformOrigin: 'center' }}
              aria-hidden="true"
            >
              <circle cx="18" cy="18" r={PIE_R} fill="none" stroke="rgba(128,128,128,0.22)" strokeWidth="4" />
              <circle
                cx="18" cy="18" r={PIE_R}
                fill="none"
                stroke={task.color}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${remainingRatio * PIE_C} ${PIE_C}`}
              />
            </svg>
            <span className="task-pie__emoji">{task.emoji}</span>
          </div>
        ) : (
          <span className="task-card__emoji">{task.emoji}</span>
        )}
        <div className="task-card__info">
          <span className="task-card__title">{task.title}</span>
          <span className="task-card__times">
            {fmtSeconds(task.remainingSeconds)} left
            &nbsp;·&nbsp;{fmtSeconds(task.spentSeconds)} spent
            &nbsp;·&nbsp;→ {fmtTime(projectedEnd.toISOString())}
          </span>
        </div>
        <div className="task-card__order">
          <button
            className="task-card__icon-btn"
            onClick={() => moveToTop(task.id)}
            disabled={index === 0}
            title="Move to top"
          >⤒</button>
          <button
            className="task-card__icon-btn"
            onClick={() => moveUp(task.id)}
            disabled={index === 0}
            title="Move up"
          >↑</button>
          <button
            className="task-card__icon-btn"
            onClick={() => moveDown(task.id)}
            disabled={index === totalTasks - 1}
            title="Move down"
          >↓</button>
          <button
            className="task-card__icon-btn"
            onClick={() => moveToBottom(task.id)}
            disabled={index === totalTasks - 1}
            title="Move to bottom"
          >⤓</button>
        </div>
      </div>

      <div className="task-card__actions">
        <button className="task-card__btn task-card__btn--complete" onClick={() => completeTask(task.id)}>✓ Done</button>
        <button className="task-card__btn task-card__btn--reset" onClick={() => resetTask(task.id)}>↺ Reset</button>
        <button className="task-card__btn task-card__btn--defer" onClick={() => deferTask(task.id)}>⏭ Not now</button>
        <button className="task-card__btn task-card__btn--delete" onClick={() => deleteTask(task.id)}>✕</button>
      </div>

      <div className="task-progress" aria-hidden="true">
        <div
          className="task-progress__fill"
          style={{ width: `${Math.max(0, Math.min(100, remainingRatio * 100))}%`, background: task.color }}
        />
      </div>
    </div>
  );
}
