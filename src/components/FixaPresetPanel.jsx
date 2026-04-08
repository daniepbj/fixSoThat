import { useState } from "react"
import { useMainTask } from "../context/MainTaskContext"
import { parseStepBlock } from "../utils/stepUtils"

export default function FixaPresetPanel() {
  const { fixaPresets, saveFixaPreset, deleteFixaPreset, addMainTask } =
    useMainTask()

  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState("")
  const [title, setTitle] = useState("")
  const [stepsBlock, setStepsBlock] = useState("")
  const [proof, setProof] = useState("")
  const [priority, setPriority] = useState("")
  const [message, setMessage] = useState("")

  function flash(msg) {
    setMessage(msg)
    setTimeout(() => setMessage(""), 2000)
  }

  function handleSave(e) {
    e.preventDefault()
    if (!name.trim() && !title.trim()) {
      flash("Add a name or goal first.")
      return
    }
    saveFixaPreset({ name, title, stepsBlock, proof, priority })
    setName("")
    setTitle("")
    setStepsBlock("")
    setProof("")
    setPriority("")
    setShowCreate(false)
    flash("Preset saved.")
  }

  function handleLoad(presetId) {
    const preset = fixaPresets.find((p) => p.id === presetId)
    if (!preset) return
    const steps = parseStepBlock(preset.stepsBlock || "")
    addMainTask({
      title: preset.title,
      steps,
      proof: preset.proof,
      priority: preset.priority,
    })
    flash(`"${preset.name}" loaded into task list.`)
  }

  return (
    <section className="fixa-preset-panel" aria-label="Fixa presets">
      <div className="fixa-preset-panel__header">
        <h2 className="fixa-preset-panel__title">Presets / templates</h2>
        <button
          type="button"
          className="fixa-preset-toggle-btn"
          onClick={() => setShowCreate((v) => !v)}
        >
          {showCreate ? "Cancel" : "+ New preset"}
        </button>
      </div>

      {message && <p className="fixa-preset-msg">{message}</p>}

      {showCreate && (
        <form className="fixa-preset-form" onSubmit={handleSave}>
          <label className="fixa-preset-label">Preset name</label>
          <input
            className="fixa-preset-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. "Vardagslunch"'
          />

          <label className="fixa-preset-label">Goal (Fixa så att jag …)</label>
          <input
            className="fixa-preset-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ätit mat"
          />

          <label className="fixa-preset-label">
            Steps{" "}
            <span className="fixa-preset-hint">
              one per line, e.g. <code>Ta ut bolognese 1</code>
            </span>
          </label>
          <textarea
            className="fixa-preset-textarea"
            value={stepsBlock}
            onChange={(e) => setStepsBlock(e.target.value)}
            placeholder={
              "Ta ut bolognese ur frysen 1\nHäll upp i tallrik 1\nStarta micro 4"
            }
            rows={5}
          />

          <label className="fixa-preset-label">Proof</label>
          <input
            className="fixa-preset-input"
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            placeholder="Jag åt upp tallriken"
          />

          <label className="fixa-preset-label">Priority</label>
          <input
            className="fixa-preset-input"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            placeholder="High / Medium / Low"
          />

          <div className="fixa-preset-form-actions">
            <button type="submit" className="fixa-preset-save-btn">
              Save preset
            </button>
          </div>
        </form>
      )}

      {fixaPresets.length === 0 && !showCreate && (
        <p className="fixa-preset-empty">
          No presets saved yet. Create one above.
        </p>
      )}

      <div className="fixa-preset-list">
        {fixaPresets.map((preset) => (
          <div key={preset.id} className="fixa-preset-item">
            <div className="fixa-preset-item__info">
              <span className="fixa-preset-item__name">{preset.name}</span>
              {preset.title && (
                <span className="fixa-preset-item__goal">
                  Fixa så att jag {preset.title}
                </span>
              )}
              {preset.stepsBlock && (
                <span className="fixa-preset-item__steps-count">
                  {preset.stepsBlock.split("\n").filter((l) => l.trim()).length}{" "}
                  steps
                </span>
              )}
            </div>
            <div className="fixa-preset-item__actions">
              <button
                type="button"
                className="fixa-preset-load-btn"
                onClick={() => handleLoad(preset.id)}
              >
                Load
              </button>
              <button
                type="button"
                className="fixa-preset-del-btn"
                onClick={() => {
                  if (window.confirm(`Delete preset "${preset.name}"?`))
                    deleteFixaPreset(preset.id)
                }}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
