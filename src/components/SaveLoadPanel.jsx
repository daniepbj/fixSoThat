import { useState, useRef } from "react"
import { useMainTask } from "../context/MainTaskContext"
import { fmtLocalDateTime } from "../utils/timeUtils"
import { listTracks, getTrack, addTrackFromFile } from "../utils/musicStore"

function formatSavedAt(iso) {
  if (!iso) return ""
  return fmtLocalDateTime(iso)
}

// All localStorage keys the app uses
const FST_KEYS = [
  "fst_main_tasks",
  "fst_save_slots",
  "fst_fixa_presets",
  "fst_active_main_task",
  "fst_active",
  "fst_completed",
  "fst_deferred",
  "fst_presets",
  "fst_settings",
  "fst_running",
  "fst_session",
  "fst_view",
  "fst_theme",
  "fst_music_volume",
  "fst_music_loop",
  "fst_music_muted",
  "fst_music_selected_track",
  "fst_pomo_work_start",
  "fst_pomo_break_start",
  "fst_timezone_override",
  "fst_v1_init",
]

export default function SaveLoadPanel() {
  const { saveSlots, saveSlot, loadSlot, clearSlot, mainTasks } = useMainTask()
  const [slotNames, setSlotNames] = useState(["", "", "", "", ""])
  const [message, setMessage] = useState("")
  const importRef = useRef(null)

  function flash(msg) {
    setMessage(msg)
    setTimeout(() => setMessage(""), 2200)
  }

  // ── helpers: blob <-> base64 ────────────────────────────────────────────
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result.split(",")[1])
      r.onerror = reject
      r.readAsDataURL(blob)
    })
  }

  function base64ToBlob(b64, mime) {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  }

  // ── Export everything as JSON file ──────────────────────────────────────
  async function handleExport() {
    flash("Preparing export…")
    const snapshot = {}
    for (const key of FST_KEYS) {
      const val = localStorage.getItem(key)
      if (val !== null) snapshot[key] = JSON.parse(val)
    }
    snapshot._exportedAt = new Date().toISOString()

    // Always include uploaded music
    try {
      const tracks = await listTracks()
      const musicData = []
      for (const meta of tracks) {
        const full = await getTrack(meta.id)
        if (full?.blob) {
          const b64 = await blobToBase64(full.blob)
          musicData.push({ ...meta, _b64: b64 })
        }
      }
      if (musicData.length) snapshot._music = musicData
    } catch {
      /* skip music on error */
    }

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `fixsothat-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.style.display = "none"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    flash(
      snapshot._music
        ? `Exported with ${snapshot._music.length} track(s) ✓`
        : "Exported ✓",
    )
  }

  // ── Import from JSON file ──────────────────────────────────────────────
  function handleImportClick() {
    importRef.current?.click()
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (typeof data !== "object" || data === null) throw new Error("bad")
      let count = 0
      for (const key of FST_KEYS) {
        if (key in data) {
          localStorage.setItem(key, JSON.stringify(data[key]))
          count++
        }
      }
      let musicCount = 0
      if (Array.isArray(data._music)) {
        for (const track of data._music) {
          if (track._b64 && track.mimeType && track.name) {
            const blob = base64ToBlob(track._b64, track.mimeType)
            const f = new File([blob], track.name, { type: track.mimeType })
            await addTrackFromFile(f)
            musicCount++
          }
        }
      }
      const parts = [`Imported ${count} keys`]
      if (musicCount) parts.push(`${musicCount} track(s)`)
      flash(`${parts.join(" + ")} — reloading…`)
      setTimeout(() => window.location.reload(), 800)
    } catch {
      flash("Invalid backup file.")
    }
    e.target.value = ""
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

      <div className="export-import-section">
        <h3 className="export-import-title">Export / Import</h3>
        <p className="save-load-panel__help">
          Download all tasks, settings, and music as a JSON file, or load a
          previous backup to restore everything.
        </p>
        <div className="export-import-actions">
          <button
            type="button"
            className="save-slot-btn save-slot-btn--save"
            onClick={handleExport}
          >
            Export All
          </button>
          <button
            type="button"
            className="save-slot-btn save-slot-btn--load"
            onClick={handleImportClick}
          >
            Import
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleImportFile}
          />
        </div>
      </div>
    </section>
  )
}
