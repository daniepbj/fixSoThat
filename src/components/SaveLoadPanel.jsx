import { useState, useRef } from "react"
import { useMainTask } from "../context/MainTaskContext"
import SectionMoveControls from "./SectionMoveControls"
import { fmtLocalDateTime } from "../utils/timeUtils"
import {
  listTracks,
  getTrack,
  addTrackFromFile,
  clearAllTracks,
} from "../utils/musicStore"
import JSZip from "jszip"

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
  "fst_section_order",
  "fst_section_collapsed",
]

// Build the export JSON string synchronously from localStorage
function buildExportJSON() {
  const snapshot = {}
  for (const key of FST_KEYS) {
    const val = localStorage.getItem(key)
    if (val !== null) {
      try {
        snapshot[key] = JSON.parse(val)
      } catch (e) {
        snapshot[key] = val // fallback to raw string if not valid JSON
      }
    }
  }
  snapshot._exportedAt = new Date().toISOString()
  return JSON.stringify(snapshot, null, 2)
}

export default function SaveLoadPanel({ sectionControls, sectionCollapsed, onToggleSectionCollapsed }) {
  const { saveSlots, saveSlot, loadSlot, clearSlot, mainTasks, resetMainTaskData } = useMainTask()
  const [slotNames, setSlotNames] = useState(["", "", "", "", ""])
  const [message, setMessage] = useState("")
  const [musicMsg, setMusicMsg] = useState("")
  const [includeMusic, setIncludeMusic] = useState(true)
  const [clearMusic, setClearMusic] = useState(true)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const importRef = useRef(null)
  const flashTimerRef = useRef(null)

  // Fallback JSON export for privacy browsers
  const exportFileName = `fixsothat-backup-${new Date().toISOString().slice(0, 10)}.json`
  const exportJSON = buildExportJSON()
  const exportBlob = new Blob([exportJSON], { type: "application/json" })
  let exportHref = ""
  try { exportHref = URL.createObjectURL(exportBlob) } catch { /* not available in test/SSR environments */ }

  function flash(msg, duration = 3000) {
    clearTimeout(flashTimerRef.current)
    setMessage(msg)
    if (duration > 0) {
      flashTimerRef.current = setTimeout(() => setMessage(""), duration)
    }
  }

  // ── Export everything as ZIP (tasks/settings + music) ──
  async function handleExportZip() {
    setMusicMsg("Preparing zip…")
    try {
      const zip = new JSZip()
      // Add settings/tasks
      zip.file("backup.json", buildExportJSON())
      // Optionally add music
      if (includeMusic) {
        const tracks = await listTracks()
        for (const meta of tracks) {
          const full = await getTrack(meta.id)
          if (full?.blob) {
            zip.file(`music/${meta.name || meta.id}`, full.blob)
          }
        }
      }
      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `fixsothat-backup-${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      setMusicMsg("Zip download started ✓")
      setTimeout(() => setMusicMsg(""), 2000)
    } catch (err) {
      setMusicMsg("Zip export failed.")
      setTimeout(() => setMusicMsg(""), 3000)
    }
  }

  // ── Import from zip or json ──
  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      if (file.name.endsWith(".zip")) {
        // Import from zip
        const zip = await JSZip.loadAsync(file)
        // Restore settings/tasks
        const jsonFile = zip.file("backup.json")
        if (jsonFile) {
          const text = await jsonFile.async("text")
          const data = JSON.parse(text)
          let count = 0
          for (const key of FST_KEYS) {
            if (key in data) {
              localStorage.setItem(key, JSON.stringify(data[key]))
              count++
            }
          }
        }
        // Restore music
        const musicFiles = Object.values(zip.files).filter((f) =>
          f.name.startsWith("music/"),
        )
        let musicCount = 0
        for (const mf of musicFiles) {
          const blob = await mf.async("blob")
          const fileObj = new File([blob], mf.name.replace(/^music\//, ""), {
            type: blob.type,
          })
          await addTrackFromFile(fileObj)
          musicCount++
        }
        flash(`Imported backup and ${musicCount} track(s) — reloading…`)
        setTimeout(() => window.location.reload(), 800)
      } else {
        // Import from JSON
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
        flash(`Imported ${count} keys — reloading…`)
        setTimeout(() => window.location.reload(), 800)
      }
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

  async function handleClearAllData() {
    setShowClearConfirm(false)
    let musicClearFailed = false
    try {
      resetMainTaskData()
      if (clearMusic) {
        try {
          await clearAllTracks()
        } catch {
          musicClearFailed = true
        }
      }

      const keys = Object.keys(window.localStorage).filter((key) =>
        key.startsWith("fst_"),
      )
      for (const key of keys) {
        window.localStorage.removeItem(key)
      }

      // Keep init sentinel so startup does not inject demo tasks after reset.
      window.localStorage.setItem("fst_v1_init", "1")

      flash(
        musicClearFailed
          ? `Cleared ${keys.length} data key(s). Music clear failed — reloading…`
          : `Cleared ${keys.length} data key(s)${clearMusic ? " + music" : ""} — reloading…`,
      )
      setTimeout(() => { try { window.location.reload() } catch {} }, 350)
    } catch {
      flash("Failed to clear all data. Please try again.")
    }
  }

  return (
    <section className="save-load-panel" aria-label="Save and load">
      <div className="save-load-panel__header">
        <button
          type="button"
          aria-label="Toggle data section"
          className="section-collapse-toggle"
          onClick={onToggleSectionCollapsed}
        >
          Save / Load
          <span className="section-collapse-arrow">{sectionCollapsed ? "▸" : "▾"}</span>
        </button>
        {sectionControls && <SectionMoveControls {...sectionControls} />}
      </div>
      {!sectionCollapsed && (
        <>
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
                Store here
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
          Download all tasks, settings, and music as a single zip file, or use
          the fallback for privacy browsers.
        </p>
        <div className="export-import-actions">
          <button
            type="button"
            className="save-slot-btn save-slot-btn--save"
            onClick={handleExportZip}
          >
            Export Everything (.zip)
          </button>
          <label
            style={{ marginLeft: 12, fontSize: "0.98em", userSelect: "none" }}
          >
            <input
              type="checkbox"
              checked={includeMusic}
              onChange={(e) => setIncludeMusic(e.target.checked)}
              style={{ marginRight: 4 }}
            />
            Include music
          </label>
          <a
            href={exportHref}
            download={exportFileName}
            className="save-slot-btn save-slot-btn--load"
            style={{ marginLeft: 12 }}
          >
            Privacy Browser Export (.json)
          </a>
        </div>
        <div className="export-import-actions" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="save-slot-btn save-slot-btn--load"
            onClick={() => importRef.current?.click()}
          >
            Import (.zip or .json)
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".zip,.json"
            style={{ display: "none" }}
            onChange={handleImportFile}
          />
        </div>
        {musicMsg && <p className="save-load-msg">{musicMsg}</p>}
      </div>

      <div className="save-load-danger-zone">
        <h3 className="export-import-title">Danger Zone</h3>
        <p className="save-load-panel__help">
          Use this before trying a new version to avoid legacy-data bugs. This
          action is permanent.
        </p>
        <div className="export-import-actions" style={{ marginTop: 8 }}>
          <label
            style={{ marginRight: 12, fontSize: "0.98em", userSelect: "none" }}
          >
            <input
              type="checkbox"
              checked={clearMusic}
              onChange={(e) => setClearMusic(e.target.checked)}
              style={{ marginRight: 4 }}
            />
            Also clear saved music
          </label>
          {showClearConfirm ? (
            <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: "0.9em", color: "var(--ta-danger, #c0392b)" }}>Permanently delete all app data?</span>
              <button
                type="button"
                className="save-slot-btn save-slot-btn--danger"
                onClick={handleClearAllData}
              >
                Yes, delete all data
              </button>
              <button
                type="button"
                className="save-slot-btn"
                onClick={() => setShowClearConfirm(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="save-slot-btn save-slot-btn--danger"
              onClick={() => setShowClearConfirm(true)}
            >
              Clear All Data
            </button>
          )}
        </div>
      </div>
        </>
      )}
    </section>
  )
}
