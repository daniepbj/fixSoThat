import { useState, useRef } from "react"
import JSZip from "jszip"
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
  const [exportUrl, setExportUrl] = useState(null)
  const [exportName, setExportName] = useState("")
  const [exporting, setExporting] = useState(false)
  const importRef = useRef(null)
  const flashTimerRef = useRef(null)

  function flash(msg, duration = 4000) {
    clearTimeout(flashTimerRef.current)
    setMessage(msg)
    if (duration > 0) {
      flashTimerRef.current = setTimeout(() => setMessage(""), duration)
    }
  }

  // ── Export: build zip with backup.json + music/ folder ──────────────────
  async function handlePrepareExport() {
    if (exportUrl) {
      URL.revokeObjectURL(exportUrl)
      setExportUrl(null)
    }
    setExporting(true)
    setMessage("Preparing export…")
    try {
      const zip = new JSZip()

      // 1. Collect all localStorage keys into backup.json
      const snapshot = {}
      for (const key of FST_KEYS) {
        const val = localStorage.getItem(key)
        if (val !== null) snapshot[key] = JSON.parse(val)
      }
      snapshot._exportedAt = new Date().toISOString()

      // 2. Add music files to music/ folder and track metadata
      const musicMeta = []
      try {
        const tracks = await listTracks()
        for (const meta of tracks) {
          const full = await getTrack(meta.id)
          if (full?.blob) {
            const safeName = meta.name.replace(/[^a-zA-Z0-9._-]/g, "_")
            const path = `music/${meta.id}_${safeName}`
            zip.file(path, full.blob)
            musicMeta.push({ ...meta, _file: path })
          }
        }
      } catch (e) {
        console.warn("Could not read music tracks:", e)
      }
      if (musicMeta.length) snapshot._musicFiles = musicMeta

      zip.file("backup.json", JSON.stringify(snapshot, null, 2))

      // 3. Generate zip blob
      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const name = `fixsothat-backup-${new Date().toISOString().slice(0, 10)}.zip`
      setExportUrl(url)
      setExportName(name)
      const msg = musicMeta.length
        ? `Ready — ${musicMeta.length} track(s) included. Click Download.`
        : "Ready — click Download."
      setMessage(msg)
    } catch (err) {
      console.error("Export failed:", err)
      flash("Export failed: " + (err?.message || "unknown error"))
    }
    setExporting(false)
  }

  // ── Import: accept .zip or .json ──────────────────────────────────────
  function handleImportClick() {
    importRef.current?.click()
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      let data
      let musicFiles = null

      if (file.name.endsWith(".zip")) {
        const zip = await JSZip.loadAsync(file)
        const jsonFile = zip.file("backup.json")
        if (!jsonFile) throw new Error("No backup.json found in zip")
        const text = await jsonFile.async("text")
        data = JSON.parse(text)
        musicFiles = zip
      } else {
        const text = await file.text()
        data = JSON.parse(text)
      }

      if (typeof data !== "object" || data === null) throw new Error("bad")

      // Restore localStorage keys
      let count = 0
      for (const key of FST_KEYS) {
        if (key in data) {
          localStorage.setItem(key, JSON.stringify(data[key]))
          count++
        }
      }

      // Restore music from zip
      let musicCount = 0
      if (musicFiles && Array.isArray(data._musicFiles)) {
        for (const meta of data._musicFiles) {
          if (!meta._file) continue
          const entry = musicFiles.file(meta._file)
          if (!entry) continue
          const blob = await entry.async("blob")
          const mime = meta.mimeType || "audio/mpeg"
          const f = new File([blob], meta.name || "track", { type: mime })
          await addTrackFromFile(f)
          musicCount++
        }
      }

      // Legacy: base64 embedded music from old exports
      if (!musicCount && Array.isArray(data._music)) {
        for (const track of data._music) {
          if (track._b64 && track.mimeType && track.name) {
            const bin = atob(track._b64)
            const bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
            const blob = new Blob([bytes], { type: track.mimeType })
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
    } catch (err) {
      console.error("Import failed:", err)
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
            onClick={handlePrepareExport}
            disabled={exporting}
          >
            {exporting ? "Preparing…" : "Export All"}
          </button>
          {exportUrl && (
            <a
              href={exportUrl}
              download={exportName}
              className="save-slot-btn save-slot-btn--load"
              onClick={() => {
                setTimeout(() => {
                  URL.revokeObjectURL(exportUrl)
                  setExportUrl(null)
                }, 1000)
              }}
            >
              Download
            </a>
          )}
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
            accept=".zip,.json"
            style={{ display: "none" }}
            onChange={handleImportFile}
          />
        </div>
      </div>
    </section>
  )
}
