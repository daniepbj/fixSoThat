import { useState } from 'react';

export default function PresetsView({ presets, savePreset, loadPreset, deletePreset }) {
  const [newName, setNewName] = useState('');

  function handleSave(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    savePreset(newName.trim());
    setNewName('');
  }

  return (
    <section className="view-panel">
      <h2 className="view-panel__title">📋 Presets</h2>

      <form className="preset-form" onSubmit={handleSave}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Name this preset…"
          className="preset-input"
        />
        <button type="submit" className="form-btn form-btn--primary">
          💾 Save active tasks
        </button>
      </form>

      {presets.length === 0 && (
        <p className="list-empty">No saved presets yet.</p>
      )}
      {presets.map(preset => (
        <div key={preset.id} className="preset-card">
          <div className="preset-card__info">
            <span className="preset-card__name">{preset.name}</span>
            <span className="preset-card__count">{preset.tasks.length} tasks</span>
          </div>
          <div className="preset-card__actions">
            <button className="task-card__btn task-card__btn--complete" onClick={() => loadPreset(preset.id)}>
              ▶ Load
            </button>
            <button className="task-card__btn task-card__btn--delete" onClick={() => deletePreset(preset.id)}>
              ✕
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
