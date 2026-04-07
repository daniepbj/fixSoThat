export default function SettingsView({ settings, setSettings }) {
  function update(key, value) {
    setSettings(s => ({ ...s, [key]: value }));
  }

  return (
    <section className="view-panel">
      <h2 className="view-panel__title">⚙️ Settings</h2>
      <div className="settings-list">

        <label className="settings-row">
          <span>Auto-start next task on completion</span>
          <input
            type="checkbox"
            checked={settings.autoStartNextTask}
            onChange={e => update('autoStartNextTask', e.target.checked)}
          />
        </label>

        <label className="settings-row">
          <span>Sound enabled</span>
          <input
            type="checkbox"
            checked={settings.soundEnabled}
            onChange={e => update('soundEnabled', e.target.checked)}
          />
        </label>

        <label className="settings-row">
          <span>Show completed tasks by default</span>
          <input
            type="checkbox"
            checked={settings.showCompletedByDefault}
            onChange={e => update('showCompletedByDefault', e.target.checked)}
          />
        </label>

        <label className="settings-row">
          <span>Match main page style and motion</span>
          <input
            type="checkbox"
            checked={Boolean(settings.matchMainPageStyle)}
            onChange={e => update('matchMainPageStyle', e.target.checked)}
          />
        </label>

        <label className="settings-row">
          <span>Default task duration (minutes)</span>
          <input
            type="number"
            min="1"
            max="60"
            value={settings.defaultTaskDuration}
            onChange={e => update('defaultTaskDuration', Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
            className="settings-number"
          />
        </label>

      </div>
    </section>
  );
}
