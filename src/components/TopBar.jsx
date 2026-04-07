function fmtDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function fmtTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function TopBar({ sessionSeconds, projectedEndTime, settings, setSettings, theme, setTheme }) {
  function toggleSound() {
    setSettings(s => ({ ...s, soundEnabled: !s.soundEnabled }));
  }

  return (
    <header className="top-bar">
      <div className="top-bar__stat">
        <span className="top-bar__label">List time</span>
        <span className="top-bar__value">{fmtDuration(sessionSeconds)}</span>
      </div>
      <div className="top-bar__center">⏱ Focus Timer</div>
      <div className="top-bar__right">
        <div className="top-bar__stat top-bar__stat--right">
          <span className="top-bar__label">End time</span>
          <span className="top-bar__value">{fmtTime(projectedEndTime)}</span>
        </div>
        <button
          className={`top-bar__sound ${settings.soundEnabled ? 'active' : ''}`}
          onClick={toggleSound}
          title={settings.soundEnabled ? 'Mute soundscape' : 'Play soundscape'}
        >
          {settings.soundEnabled ? '🔊' : '🔇'}
        </button>
        <button
          className="top-bar__sound"
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
