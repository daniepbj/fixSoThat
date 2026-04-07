function fmtDisplay(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TimerPanel({ currentTask, timerRunning, setTimerRunning, adjustTime }) {
  const remaining = currentTask?.remainingSeconds ?? 0;
  const total = 60 * 60;
  const progress = Math.max(0, Math.min(1, remaining / total));

  // SVG ring
  const r = 88;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);

  function toggle() {
    if (!currentTask) return;
    setTimerRunning(r => !r);
  }

  return (
    <section className="timer-panel">
      <div className="timer-ring-wrapper">
        <svg className="timer-ring" viewBox="0 0 200 200" aria-hidden="true"
          style={{ transform: 'rotate(-90deg) scaleX(-1)', transformOrigin: 'center' }}
        >
          <circle className="timer-ring__track" cx="100" cy="100" r={r} />
          <circle
            className="timer-ring__progress"
            cx="100" cy="100" r={r}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ stroke: currentTask?.color ?? '#6c63ff' }}
          />
        </svg>
        <div className="timer-ring__center">
          <div className="timer-display">{fmtDisplay(remaining)}</div>
          {currentTask && (
            <div className="timer-task-label">{currentTask.emoji} {currentTask.title}</div>
          )}
          {!currentTask && (
            <div className="timer-task-label" style={{ opacity: 0.4 }}>No active task</div>
          )}
        </div>
      </div>

      <div className="timer-controls">
        <button
          className="timer-btn timer-btn--adjust"
          onClick={() => adjustTime(-300)}
          title="−5 minutes"
          disabled={!currentTask}
        >
          −5m
        </button>
        <button
          className="timer-btn timer-btn--play"
          onClick={toggle}
          disabled={!currentTask}
          aria-label={timerRunning ? 'Pause timer' : 'Start timer'}
        >
          {timerRunning ? '⏸' : '▶'}
        </button>
        <button
          className="timer-btn timer-btn--adjust"
          onClick={() => adjustTime(300)}
          title="+5 minutes"
          disabled={!currentTask}
        >
          +5m
        </button>
      </div>
    </section>
  );
}
