import { useState } from "react"
import { EMOJIS, COLORS } from "../data/seedData"

/** Parse a single line: "Task title 30" → { title, estimatedMinutes: 30 } */
function parseLine(raw, defaultMinutes) {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(.*\S)\s+(\d+)$/)
  if (match) {
    return { title: match[1].trim(), estimatedMinutes: Number(match[2]) }
  }
  return { title: trimmed, estimatedMinutes: defaultMinutes }
}

export default function AddTaskForm({ onAdd, onClose, defaultDuration }) {
  const [title, setTitle] = useState("")
  const [minutes, setMinutes] = useState(defaultDuration ?? 25)
  const [emoji, setEmoji] = useState("✏️")
  const [color, setColor] = useState("#6c63ff")

  function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({
      title: title.trim(),
      estimatedMinutes: Number(minutes),
      emoji,
      color,
    })
    onClose()
  }

  function handleTitlePaste(e) {
    const pasted = e.clipboardData.getData("text")
    const lines = pasted.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length <= 1) return // let browser handle single-line paste normally
    e.preventDefault()
    const tasks = lines
      .map((l) => parseLine(l, defaultDuration ?? 25))
      .filter(Boolean)
      .map((t) => ({ ...t, emoji, color }))
    if (!tasks.length) return
    onAdd(tasks)
    onClose()
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form className="add-task-form" onSubmit={handleSubmit}>
        <h3 className="add-task-form__title">Add Task</h3>

        <label className="form-label">
          Title
          <input
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onPaste={handleTitlePaste}
            placeholder="What are you working on? (paste multiple lines to bulk-add)"
            autoFocus
          />
        </label>

        <label className="form-label">
          Duration (minutes)
          <input
            className="form-input"
            type="number"
            min="1"
            max="180"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </label>

        <label className="form-label">
          Emoji
          <select
            className="form-input"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
          >
            {EMOJIS.map((em) => (
              <option key={em} value={em}>
                {em}
              </option>
            ))}
          </select>
        </label>

        <div className="form-label">
          Color
          <div className="color-swatches">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch ${color === c ? "selected" : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="add-task-form__actions">
          <button type="submit" className="form-btn form-btn--primary">
            Add Task
          </button>
          <button
            type="button"
            className="form-btn form-btn--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
