export default function SettingsView({ settings, setSettings, music }) {
  function update(key, value) {
    setSettings((s) => ({ ...s, [key]: value }))
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
