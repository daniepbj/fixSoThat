import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useTimerContext } from "../context/TimerContext"
import { useLocalStorage } from "../hooks/useLocalStorage"
import { fmtTimerDisplay, getHourRingProgress } from "../utils/timeUtils"
import WaitingTaskPanel from "./WaitingTaskPanel"

export default function TimerPanel() {
  const {
    currentTask,
    timerRunning,
    setCurrentView,
    musicPromptRequestId,
    toggleTimerWithClick,
    adjustTime,
    alarmActive,
    stopAlarm,
    queueBlockedByWait,
    hasSelectedTrack,
    hasUploadedTracks,
    uploadMusicFromModal,
    waitingTask,
  } = useTimerContext()
  const remaining = currentTask?.remainingSeconds ?? 0
  const progress = getHourRingProgress(remaining)
  const [showNoMusicModal, setShowNoMusicModal] = useState(false)
  const [uploadingFromModal, setUploadingFromModal] = useState(false)
  const [skipNoUploadPromptForever, setSkipNoUploadPromptForever] =
    useLocalStorage("fst_skip_no_music_upload_prompt_forever", false)

  // SVG ring
  const r = 88
  // Keep zero at top and fill left side as time increases:
  // 15m => top->left, 30m => top->left->bottom.
  const offset = 0

  function toggle() {
    if (!currentTask) return
    const shouldPromptMissingUpload =
      !hasUploadedTracks && !skipNoUploadPromptForever
    const shouldPromptMissingSelection = hasUploadedTracks && !hasSelectedTrack

    if (shouldPromptMissingUpload || shouldPromptMissingSelection) {
      setShowNoMusicModal(true)
      return
    }
    toggleTimerWithClick()
  }

  const noMusicHintText = hasUploadedTracks
    ? "No track selected. Open Settings to choose one."
    : "No music uploaded yet. Upload one now or skip."

  useEffect(() => {
    if (!musicPromptRequestId) return
    const shouldPromptMissingUpload =
      !hasUploadedTracks && !skipNoUploadPromptForever
    const shouldPromptMissingSelection = hasUploadedTracks && !hasSelectedTrack
    if (shouldPromptMissingUpload || shouldPromptMissingSelection) {
      setShowNoMusicModal(true)
    }
  }, [
    musicPromptRequestId,
    hasUploadedTracks,
    hasSelectedTrack,
    skipNoUploadPromptForever,
  ])

  async function handleUploadNow() {
    if (uploadingFromModal) return
    setUploadingFromModal(true)
    const uploaded = await uploadMusicFromModal()
    setUploadingFromModal(false)
    if (uploaded) {
      setShowNoMusicModal(false)
      toggleTimerWithClick()
    }
  }

  function handleSkipMusicModal() {
    setShowNoMusicModal(false)
    setCurrentView("timer")
  }

  function handleSkipForever() {
    setSkipNoUploadPromptForever(true)
    setShowNoMusicModal(false)
    setCurrentView("timer")
    toggleTimerWithClick()
  }

  const noMusicModal =
    showNoMusicModal && typeof document !== "undefined"
      ? createPortal(
          <div
            className="timer-music-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Music upload required"
          >
            <div className="timer-music-modal__backdrop" />
            <div className="timer-music-modal__card">
              <strong>No music configured</strong>
              <span>{noMusicHintText}</span>
              <div className="timer-music-modal__actions">
                <button
                  type="button"
                  className="timer-music-modal__btn timer-music-modal__btn--primary"
                  onClick={handleUploadNow}
                  disabled={uploadingFromModal}
                >
                  {uploadingFromModal ? "Opening..." : "Upload now"}
                </button>
                <button
                  type="button"
                  className="timer-music-modal__btn"
                  onClick={handleSkipMusicModal}
                  disabled={uploadingFromModal}
                >
                  Skip
                </button>
                {!hasUploadedTracks && (
                  <button
                    type="button"
                    className="timer-music-modal__btn timer-music-modal__btn--danger"
                    onClick={handleSkipForever}
                    disabled={uploadingFromModal}
                  >
                    Skip forever
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <section
      className={`timer-panel${timerRunning ? " timer-panel--running" : ""}${alarmActive ? " timer-panel--alarm" : ""}`}
      style={{ "--timer-glow-color": currentTask?.color ?? "#6c63ff" }}
    >
      {waitingTask && <WaitingTaskPanel />}
      <div className="timer-ring-wrapper">
        <svg
          className="timer-ring"
          viewBox="0 0 200 200"
          aria-hidden="true"
          style={{
            transform: "rotate(90deg) scaleX(-1)",
            transformOrigin: "center",
          }}
        >
          <circle className="timer-ring__track" cx="100" cy="100" r={r} />
          <circle
            className="timer-ring__progress"
            cx="100"
            cy="100"
            r={r}
            pathLength={1}
            strokeDasharray={`${progress} 1`}
            strokeDashoffset={offset}
            style={{ stroke: currentTask?.color ?? "#6c63ff" }}
          />
        </svg>
        <div className="timer-zero-marker" aria-hidden="true">
          00
        </div>
        <div className="timer-ring__center">
          <div className="timer-display">{fmtTimerDisplay(remaining)}</div>
          {currentTask && (
            <div className="timer-task-label">
              {currentTask.emoji} {currentTask.title}
            </div>
          )}
          {!currentTask && (
            <div className="timer-task-label" style={{ opacity: 0.4 }}>
              {queueBlockedByWait ? "Queue paused by wait" : "No active task"}
            </div>
          )}
        </div>
      </div>

      <div className="timer-controls">
        <button
          className="timer-btn timer-btn--adjust"
          onClick={() => adjustTime(-300)}
          title="−5 minutes"
          disabled={!currentTask}
        >
          −5m
        </button>
        <button
          className="timer-btn timer-btn--play"
          onClick={toggle}
          disabled={!currentTask}
          aria-label={timerRunning ? "Pause timer" : "Start timer"}
        >
          {timerRunning ? "⏸" : "▶"}
        </button>
        <button
          className="timer-btn timer-btn--adjust"
          onClick={() => adjustTime(300)}
          title="+5 minutes"
          disabled={!currentTask}
        >
          +5m
        </button>
      </div>

      {noMusicModal}

      {alarmActive && (
        <button className="timer-btn timer-btn--dismiss" onClick={stopAlarm}>
          🔕 Dismiss alarm
        </button>
      )}
    </section>
  )
}
