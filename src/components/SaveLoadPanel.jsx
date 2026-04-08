import { useState } from "react"
import { useMainTask } from "../context/MainTaskContext"

function formatSavedAt(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function SaveLoadPanel() {
  const { saveSlots, saveSlot, loadSlot, clearSlot, mainTasks } = useMainTask()
  const [slotNames, setSlotNames] = useState(["", "", "", "", ""])
  const [message, setMessage] = useState("")

  function flash(msg) {
    setMessage(msg)
    setTimeout(() => setMessage(""), 2200)
  }

  function handleSave(index) {
    const defaultName = `Save ${index + 1} — ${mainTasks.length} task(s)`
    const name = slotNames[index].trim() || defaultName
    saveSlot(index, name)
    flash(`Saved to slot ${index + 1}.`)
  }

  function handleLoad(index) {
    const ok = loadSlot(index)
    if (ok) flash(`Slot ${index + 1} loaded.`)
  }

  function handleClear(index) {
    if (window.confirm(`Clear save slot ${index + 1}?`)) {
      clearSlot(index)
      flash(`Slot ${index + 1} cleared.`)
    }
  }

  return (
    <section className="save-load-panel" aria-label="Save and load">
      <h2 className="save-load-panel__title">Save / Load</h2>
      <p className="save-load-panel__help">
        Save your current tasks to a slot and reload them any time — like save
        states in a game.
      </p>

      {message && <p className="save-load-msg">{message}</p>}

      <div className="save-load-slots">
        {saveSlots.map((slot, index) => (
          <div
            key={index}
            className={`save-slot ${slot ? "save-slot--filled" : "save-slot--empty"}`}
          >
            <div className="save-slot__top">
              <span className="save-slot__num">#{index + 1}</span>
              {slot ? (
                <span className="save-slot__name">{slot.name}</span>
              ) : (
                <span className="save-slot__empty-label">Empty</span>
              )}
            </div>
            {slot && (
              <div className="save-slot__meta">
                {slot.tasks?.length ?? 0} task(s) ·{" "}
                {formatSavedAt(slot.savedAt)}
              </div>
            )}
            {!slot && (
              <input
                className="save-slot__name-input"
                value={slotNames[index]}
                onChange={(e) => {
                  const arr = [...slotNames]
                  arr[index] = e.target.value
                  setSlotNames(arr)
                }}
                placeholder="Optional name…"
              />
            )}
            <div className="save-slot__actions">
              <button
                type="button"
                className="save-slot-btn save-slot-btn--save"
                onClick={() => handleSave(index)}
              >
                Save here
              </button>
              {slot && (
                <>
                  <button
                    type="button"
                    className="save-slot-btn save-slot-btn--load"
                    onClick={() => handleLoad(index)}
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    className="save-slot-btn save-slot-btn--clear"
                    onClick={() => handleClear(index)}
                  >
                    ×
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
