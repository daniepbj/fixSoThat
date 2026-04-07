import { useState } from "react"
import { EMOJIS, COLORS } from "../data/seedData"

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
            placeholder="What are you working on?"
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
