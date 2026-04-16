import { useState } from "react"
import { useLocalStorage } from "../hooks/useLocalStorage"
import {
  getAutoTimezone,
  getTimezoneOverride,
  setTimezoneOverride,
} from "../utils/timeUtils"

export default function SettingsView({ settings, setSettings, music }) {
  const [tzOverride, setTzOverride] = useState(getTimezoneOverride())
  const [tzInput, setTzInput] = useState(tzOverride)
  const [tzError, setTzError] = useState("")
  const [builderVisualStyle, setBuilderVisualStyle] = useLocalStorage(
    "fst_builder_visual_style",
    "calm",
  )

  function update(key, value) {
    setSettings((s) => ({ ...s, [key]: value }))
  }

  function handleTzApply() {
    const trimmed = tzInput.trim()
    setTimezoneOverride(trimmed)
    const effective = getTimezoneOverride()
    if (trimmed && !effective) {
      setTzError("Invalid timezone. Use IANA format like Europe/Oslo")
    } else {
      setTzError("")
      setTzOverride(effective)
    }
  }

  function handleTzClear() {
    setTimezoneOverride("")
    setTzOverride("")
    setTzInput("")
    setTzError("")
  }

  function onUpload(event) {
    const files = event.target.files
    music.onUploadTracks(files)
    event.target.value = ""
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
            onChange={(e) => update("autoStartNextTask", e.target.checked)}
          />
        </label>

        <div className="settings-row settings-row--block">
          <span className="settings-row__label">🍅 Pomodoro mode</span>
          <label className="settings-row">
            <span>Enable Pomodoro timer</span>
            <input
              type="checkbox"
              checked={Boolean(settings.pomodoroEnabled)}
              onChange={(e) => update("pomodoroEnabled", e.target.checked)}
            />
          </label>
          {settings.pomodoroEnabled && (
            <>
              <label className="settings-row">
                <span>Work session (minutes)</span>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={settings.pomodoroWorkMinutes || 20}
                  onChange={(e) =>
                    update(
                      "pomodoroWorkMinutes",
                      Math.max(1, Math.min(120, Number(e.target.value) || 20)),
                    )
                  }
                  className="settings-number"
                />
              </label>
              <label className="settings-row">
                <span>Break duration (minutes)</span>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.pomodoroBreakMinutes || 5}
                  onChange={(e) =>
                    update(
                      "pomodoroBreakMinutes",
                      Math.max(1, Math.min(30, Number(e.target.value) || 5)),
                    )
                  }
                  className="settings-number"
                />
              </label>
              <p className="settings-help-text">
                Work for {settings.pomodoroWorkMinutes || 20} min, then enjoy a{" "}
                {settings.pomodoroBreakMinutes || 5} min beach break. 🏖️
              </p>
            </>
          )}
        </div>

        <div className="settings-row settings-row--block">
          <span className="settings-row__label">Alarm when time is up</span>
          <div className="alarm-options">
            {[
              {
                value: "silent",
                label: "Silent / Visual",
                desc: "No sound - flashes when time is up",
              },
              {
                value: "nag",
                label: "Nag Alarm",
                desc: "Beeps when done, reminds every minute until dismissed",
              },
              {
                value: "continuous",
                label: "Continuous",
                desc: "Beeps when done, then loops until dismissed",
              },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`alarm-option ${settings.alarmMode === opt.value ? "alarm-option--selected" : ""}`}
              >
                <input
                  type="radio"
                  name="alarmMode"
                  value={opt.value}
                  checked={(settings.alarmMode ?? "nag") === opt.value}
                  onChange={() => update("alarmMode", opt.value)}
                />
                <span className="alarm-option__label">{opt.label}</span>
                <span className="alarm-option__desc">{opt.desc}</span>
              </label>
            ))}
          </div>
          <label className="settings-row">
            <span>Auto-scroll to active task when alarm starts</span>
            <input
              type="checkbox"
              checked={settings.autoScrollOnAlarm !== false}
              onChange={(e) => update("autoScrollOnAlarm", e.target.checked)}
            />
          </label>
        </div>

        <label className="settings-row">
          <span>Show completed tasks by default</span>
          <input
            type="checkbox"
            checked={settings.showCompletedByDefault}
            onChange={(e) => update("showCompletedByDefault", e.target.checked)}
          />
        </label>

        <label className="settings-row">
          <span>Match main page style and motion</span>
          <input
            type="checkbox"
            checked={Boolean(settings.matchMainPageStyle)}
            onChange={(e) => update("matchMainPageStyle", e.target.checked)}
          />
        </label>

        <div className="settings-row settings-row--block">
          <span className="settings-row__label">Builder card style</span>
          <p className="settings-help-text">
            Controls the visual style of guided builder cards.
          </p>
          <div className="gcb-style-toggle settings-style-toggle">
            {[
              { v: "calm", icon: "🌊", label: "Calm Motion" },
              { v: "minimal", icon: "○", label: "Minimal" },
              { v: "match", icon: "✦", label: "Match Main" },
            ].map(({ v, icon, label }) => (
              <button
                key={v}
                type="button"
                className={`gcb-style-btn settings-style-btn${builderVisualStyle === v ? " gcb-style-btn--active" : ""}`}
                aria-pressed={builderVisualStyle === v}
                onClick={() => setBuilderVisualStyle(v)}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        <label className="settings-row">
          <span>Default task duration (minutes)</span>
          <input
            type="number"
            min="1"
            max="60"
            value={settings.defaultTaskDuration}
            onChange={(e) =>
              update(
                "defaultTaskDuration",
                Math.max(1, Math.min(60, Number(e.target.value) || 1)),
              )
            }
            className="settings-number"
          />
        </label>

        <label className="settings-row">
          <span>Idle prompt delay (seconds)</span>
          <input
            type="number"
            min="5"
            max="300"
            value={settings.idlePromptSeconds ?? 30}
            onChange={(e) =>
              update(
                "idlePromptSeconds",
                Math.max(5, Math.min(300, Number(e.target.value) || 30)),
              )
            }
            className="settings-number"
          />
        </label>

        <div className="settings-row settings-row--block">
          <span className="settings-row__label">Timezone override</span>
          <p className="settings-help-text">
            Auto-detected: <strong>{getAutoTimezone()}</strong>.
            {tzOverride ? (
              <>
                {" "}
                Override: <strong>{tzOverride}</strong>.
              </>
            ) : (
              " Set a manual timezone if your browser spoofs it (e.g. LibreWolf)."
            )}
          </p>
          <div className="tz-override-row">
            <input
              type="text"
              placeholder="e.g. Europe/Oslo"
              value={tzInput}
              onChange={(e) => setTzInput(e.target.value)}
              className="settings-text-input"
              list="tz-suggestions"
            />
            <datalist id="tz-suggestions">
              {[
                "Europe/Oslo",
                "Europe/London",
                "Europe/Berlin",
                "Europe/Paris",
                "Europe/Stockholm",
                "America/New_York",
                "America/Chicago",
                "America/Denver",
                "America/Los_Angeles",
                "Asia/Tokyo",
                "Asia/Shanghai",
                "Australia/Sydney",
                "Pacific/Auckland",
                "UTC",
              ].map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
            <button type="button" className="quick-btn" onClick={handleTzApply}>
              Apply
            </button>
            {tzOverride && (
              <button
                type="button"
                className="quick-btn quick-btn--danger"
                onClick={handleTzClear}
              >
                Clear
              </button>
            )}
          </div>
          {tzError && <p className="settings-warn-text">{tzError}</p>}
        </div>

        <div className="settings-row settings-row--block">
          <span className="settings-row__label">Task music</span>
          <p className="settings-help-text">
            Upload tracks once and reuse them across sessions. The selected
            track is used globally for active tasks.
          </p>

          <div className="music-upload-row">
            <label className="music-upload-btn" htmlFor="music-upload-input">
              Upload tracks
            </label>
            <input
              id="music-upload-input"
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a"
              multiple
              onChange={onUpload}
            />
            <button
              type="button"
              className="music-control-btn"
              onClick={music.onToggleMusicPlayback}
              disabled={!music.selectedTrackId}
            >
              {music.isMusicPlaying ? "Pause" : "Play"}
            </button>
          </div>

          <label className="settings-row settings-row--compact">
            <span>Volume ({Math.round((music.musicVolume ?? 0) * 100)}%)</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={music.musicVolume ?? 0.55}
              onChange={(e) => music.setMusicVolume(Number(e.target.value))}
              className="music-volume-slider"
            />
          </label>

          <label className="settings-row">
            <span>Loop selected track</span>
            <input
              type="checkbox"
              checked={Boolean(music.musicLoop)}
              onChange={(e) => music.setMusicLoop(e.target.checked)}
            />
          </label>

          <label className="settings-row">
            <span>Mute music</span>
            <input
              type="checkbox"
              checked={Boolean(music.musicMuted)}
              onChange={(e) => music.setMusicMuted(e.target.checked)}
            />
          </label>

          {music.audioBlockedMessage && (
            <p className="settings-warn-text">{music.audioBlockedMessage}</p>
          )}
          {music.musicUiMessage && (
            <p className="settings-help-text">{music.musicUiMessage}</p>
          )}

          <div className="music-track-list">
            {music.uploadedTracks.length === 0 && (
              <p className="settings-help-text">No uploaded tracks yet.</p>
            )}
            {music.uploadedTracks.map((track) => (
              <article
                key={track.id}
                className={`music-track-item ${music.selectedTrackId === track.id ? "music-track-item--selected" : ""}`}
              >
                <div className="music-track-meta">
                  <strong>{track.name}</strong>
                  <small>{Math.max(1, Math.round(track.size / 1024))} KB</small>
                </div>
                <div className="music-track-actions">
                  <button
                    type="button"
                    className="music-control-btn"
                    onClick={() => music.setSelectedTrackId(track.id)}
                  >
                    {music.selectedTrackId === track.id ? "Selected" : "Select"}
                  </button>
                  <button
                    type="button"
                    className="music-control-btn"
                    onClick={() => music.onPreviewTrack(track.id)}
                  >
                    {music.previewTrackId === track.id ? "Stop" : "Preview"}
                  </button>
                  <button
                    type="button"
                    className="music-control-btn music-control-btn--danger"
                    onClick={() => music.onDeleteTrack(track.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
