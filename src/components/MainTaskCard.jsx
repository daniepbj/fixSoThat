import { useState, useEffect } from "react"
import { useMainTask } from "../context/MainTaskContext"
import { parseStepRaw, sortStepsWithLinks } from "../utils/stepUtils"

function StatusBadge({ label, isGreen }) {
  return (
    <span
      className={`mtask-badge ${isGreen ? "mtask-badge--green" : "mtask-badge--red"}`}
    >
      {label}
    </span>
  )
}

function computeStatus(task) {
  const steps = Array.isArray(task?.steps) ? task.steps : []
  const proof = typeof task?.proof === "string" ? task.proof : ""
  const priority = typeof task?.priority === "string" ? task.priority : ""
  const validSteps = steps.filter((s) => (s?.raw || "").trim().length > 0)
  const hasSteps = validSteps.length > 0
  const hasTime =
    hasSteps && validSteps.every((s) => parseStepRaw(s.raw).minutes > 0)
  const hasProof = proof.trim().length > 0
  const hasPriority = priority.trim().length > 0
  return { hasSteps, hasTime, hasProof, hasPriority }
}

function normalizeRenderSteps(taskId, steps) {
  return (Array.isArray(steps) ? steps : []).map((step, index) => {
    const isObject = step && typeof step === "object"
    return {
      id:
        (isObject && typeof step.id === "string" && step.id) ||
        `safe-${taskId}-${index}`,
      raw: isObject ? String(step.raw || "") : String(step || ""),
      completed: Boolean(isObject && step.completed),
      tries: Math.max(0, Number(isObject ? step.tries : 0) || 0),
      linkedAfter:
        isObject && typeof step.linkedAfter === "string"
          ? step.linkedAfter
          : null,
    }
  })
}

export default function MainTaskCard({ task }) {
  const {
    deleteMainTask,
    completeMainTask,
    restoreMainTask,
    incrementTries,
    decrementTries,
    incrementStepTries,
    decrementStepTries,
    reorderSteps,
    setStepLink,
    toggleStepComplete,
    updateMainTask,
    updateStep,
    addStepToTask,
    removeStepFromTask,
    setActiveMainTaskId,
    activeMainTaskId,
  } = useMainTask()

  const [expanded, setExpanded] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(task.title)
  const [editingProof, setEditingProof] = useState(false)
  const [proofDraft, setProofDraft] = useState(task.proof)
  const [editingPriority, setEditingPriority] = useState(false)
  const [priorityDraft, setPriorityDraft] = useState(task.priority)
  const [newStepRaw, setNewStepRaw] = useState("")
  const [draggedStepId, setDraggedStepId] = useState("")
  const [linkPrompt, setLinkPrompt] = useState(null)

  // Keep draft values in sync with task prop updates (e.g. external edits)
  useEffect(() => {
    if (!editingTitle) setTitleDraft(task.title)
  }, [task.title, editingTitle])
  useEffect(() => {
    if (!editingProof) setProofDraft(task.proof)
  }, [task.proof, editingProof])
  useEffect(() => {
    if (!editingPriority) setPriorityDraft(task.priority)
  }, [task.priority, editingPriority])

  const safeSteps = normalizeRenderSteps(task?.id || "task", task?.steps)
  const status = computeStatus(task)
  const isActive = activeMainTaskId === task.id
  const isCompleted = task.status === "completed"
  const sortedSteps = sortStepsWithLinks(safeSteps, { includeCompleted: true })
  const completedSteps = safeSteps.filter((s) => s.completed).length
  const totalSteps = safeSteps.length

  function saveTitle() {
    updateMainTask(task.id, { title: titleDraft.trim() })
    setEditingTitle(false)
  }

  function saveProof() {
    updateMainTask(task.id, { proof: proofDraft.trim() })
    setEditingProof(false)
  }

  function savePriority() {
    updateMainTask(task.id, { priority: priorityDraft.trim() })
    setEditingPriority(false)
  }

  function handleAddStep(e) {
    e.preventDefault()
    if (!newStepRaw.trim()) return
    addStepToTask(task.id, newStepRaw.trim())
    setNewStepRaw("")
  }

  function handleConfirmComplete() {
    if (
      window.confirm(`Mark "${task.title || "this task"}" as fully complete?`)
    ) {
      completeMainTask(task.id)
    }
  }

  function handleStepDragStart(stepId, event) {
    setDraggedStepId(stepId)
    setLinkPrompt(null)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", stepId)
  }

  function handleStepDragOver(stepId, event) {
    const sourceId = draggedStepId || event.dataTransfer.getData("text/plain")
    if (!sourceId || sourceId === stepId) return
    event.preventDefault()
  }

  function handleStepDrop(targetStepId, event) {
    event.preventDefault()
    const sourceId = draggedStepId || event.dataTransfer.getData("text/plain")
    if (!sourceId || sourceId === targetStepId) return
    setLinkPrompt({ sourceId, targetStepId })
    setDraggedStepId("")
  }

  function clearStepDragState() {
    setDraggedStepId("")
  }

  function applyDroppedLink(relation) {
    if (!linkPrompt) return
    setStepLink(
      task.id,
      linkPrompt.sourceId,
      `${relation}:${linkPrompt.targetStepId}`,
    )
    setLinkPrompt(null)
  }

  return (
    <article
      className={`mtask-card ${isCompleted ? "mtask-card--completed" : "mtask-card--active"} ${isActive ? "mtask-card--is-active" : ""}`}
    >
      {/* Header */}
      <div
        className="mtask-card__header"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="mtask-card__title-row">
          <span className="mtask-card__expand">{expanded ? "▾" : "▸"}</span>
          <span className="mtask-card__title">
            {isCompleted && <span className="mtask-card__done-mark">✓ </span>}*
            Fixa så att jag {task.title || "(no title)"}
          </span>
        </div>
        <div className="mtask-card__header-meta">
          {totalSteps > 0 && (
            <span className="mtask-card__step-progress">
              {completedSteps}/{totalSteps}
            </span>
          )}
          <div
            className="mtask-card__status-badges"
            onClick={(e) => e.stopPropagation()}
          >
            <StatusBadge label="Steps" isGreen={status.hasSteps} />
            <StatusBadge label="Time" isGreen={status.hasTime} />
            <StatusBadge label="Proof" isGreen={status.hasProof} />
            <StatusBadge label="Priority" isGreen={status.hasPriority} />
          </div>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="mtask-card__body">
          {/* Title edit */}
          <div className="mtask-card__field">
            <span className="mtask-field-label">Goal</span>
            {editingTitle ? (
              <div className="mtask-inline-edit">
                <input
                  className="mtask-edit-input"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTitle()
                    if (e.key === "Escape") setEditingTitle(false)
                  }}
                  autoFocus
                />
                <button className="mtask-edit-btn" onClick={saveTitle}>
                  Save
                </button>
                <button
                  className="mtask-edit-btn mtask-edit-btn--cancel"
                  onClick={() => setEditingTitle(false)}
                >
                  ×
                </button>
              </div>
            ) : (
              <span
                className="mtask-field-value"
                onClick={() => {
                  setTitleDraft(task.title)
                  setEditingTitle(true)
                }}
              >
                {task.title || <em className="mtask-empty">click to set</em>}
              </span>
            )}
          </div>

          {/* Steps */}
          <div className="mtask-card__steps">
            <span className="mtask-field-label">Steps</span>
            {safeSteps.length === 0 && (
              <p className="mtask-empty">No steps yet.</p>
            )}
            {sortedSteps.map((step, stepIdx) => {
              const parsed = parseStepRaw(step.raw)
              const sourceIndex = safeSteps.findIndex(
                (candidate) => candidate.id === step.id,
              )
              const prevSourceIndex =
                stepIdx > 0
                  ? safeSteps.findIndex(
                      (candidate) =>
                        candidate.id === sortedSteps[stepIdx - 1].id,
                    )
                  : -1
              const nextSourceIndex =
                stepIdx < sortedSteps.length - 1
                  ? safeSteps.findIndex(
                      (candidate) =>
                        candidate.id === sortedSteps[stepIdx + 1].id,
                    )
                  : -1
              const linkedBefore =
                safeSteps.find((candidate) => candidate.linkedAfter === step.id)
                  ?.id || ""
              const linkValue = step.linkedAfter
                ? `after:${step.linkedAfter}`
                : linkedBefore
                  ? `before:${linkedBefore}`
                  : ""
              const showLinkPrompt = linkPrompt?.targetStepId === step.id
              const isDraggedSource = draggedStepId === step.id
              return (
                <div
                  key={step.id}
                  className={`mtask-step-row ${isDraggedSource ? "mtask-step-row--dragging" : ""} ${showLinkPrompt ? "mtask-step-row--drop-target" : ""}`}
                  onDragOver={(event) => handleStepDragOver(step.id, event)}
                  onDrop={(event) => handleStepDrop(step.id, event)}
                >
                  <button
                    type="button"
                    className="mtask-step-drag"
                    draggable
                    onDragStart={(event) => handleStepDragStart(step.id, event)}
                    onDragEnd={clearStepDragState}
                    title="Drag onto another step to link before/after"
                  >
                    ⋮⋮
                  </button>
                  <input
                    type="checkbox"
                    className="mtask-step-check"
                    checked={step.completed}
                    onChange={() => toggleStepComplete(task.id, step.id)}
                  />
                  <input
                    type="text"
                    className={`mtask-step-edit ${step.completed ? "mtask-step-text--done" : ""}`}
                    value={step.raw}
                    onChange={(e) =>
                      updateStep(task.id, step.id, e.target.value)
                    }
                    placeholder="Step name 5"
                  />
                  {parsed.minutes > 0 && (
                    <span className="mtask-step-time">{parsed.minutes}m</span>
                  )}
                  {showLinkPrompt && (
                    <div className="mtask-step-link-prompt">
                      <span className="mtask-step-link-prompt-label">
                        Link dropped step:
                      </span>
                      <button
                        type="button"
                        className="mtask-step-link-action"
                        onClick={() => applyDroppedLink("before")}
                      >
                        before this
                      </button>
                      <button
                        type="button"
                        className="mtask-step-link-action"
                        onClick={() => applyDroppedLink("after")}
                      >
                        after this
                      </button>
                      <button
                        type="button"
                        className="mtask-step-link-cancel"
                        onClick={() => setLinkPrompt(null)}
                      >
                        cancel
                      </button>
                    </div>
                  )}
                  <div className="mtask-step-right">
                    <button
                      type="button"
                      className="mtask-step-ctrl"
                      onClick={() =>
                        reorderSteps(task.id, sourceIndex, prevSourceIndex)
                      }
                      disabled={stepIdx === 0}
                      title="Move step up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="mtask-step-ctrl"
                      onClick={() =>
                        reorderSteps(task.id, sourceIndex, nextSourceIndex)
                      }
                      disabled={stepIdx === sortedSteps.length - 1}
                      title="Move step down"
                    >
                      ↓
                    </button>
                    <span className="mtask-step-tries-count">
                      {step.tries || 0}×
                    </span>
                    <button
                      type="button"
                      className="mtask-step-ctrl"
                      onClick={() => decrementStepTries(task.id, step.id)}
                      title="Decrease step tries"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      className="mtask-step-ctrl"
                      onClick={() => incrementStepTries(task.id, step.id)}
                      title="Increase step tries"
                    >
                      +
                    </button>
                    <select
                      className="mtask-step-link-select"
                      value={linkValue}
                      onChange={(e) =>
                        setStepLink(task.id, step.id, e.target.value)
                      }
                      title="Linked ordering"
                    >
                      <option value="">🔗 free</option>
                      {safeSteps
                        .filter((s) => s.id !== step.id)
                        .map((s) => {
                          const p = parseStepRaw(s.raw)
                          return (
                            <option
                              key={`before-${s.id}`}
                              value={`before:${s.id}`}
                            >
                              before: {p.text || s.raw}
                            </option>
                          )
                        })}
                      {safeSteps
                        .filter((s) => s.id !== step.id)
                        .map((s) => {
                          const p = parseStepRaw(s.raw)
                          return (
                            <option
                              key={`after-${s.id}`}
                              value={`after:${s.id}`}
                            >
                              after: {p.text || s.raw}
                            </option>
                          )
                        })}
                    </select>
                    <button
                      type="button"
                      className="mtask-step-remove"
                      onClick={() => removeStepFromTask(task.id, step.id)}
                      title="Remove step"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )
            })}
            <form className="mtask-add-step-form" onSubmit={handleAddStep}>
              <input
                className="mtask-add-step-input"
                value={newStepRaw}
                onChange={(e) => setNewStepRaw(e.target.value)}
                placeholder="Add step (e.g. Diska 10)"
              />
              <button type="submit" className="mtask-add-step-btn">
                +
              </button>
            </form>
          </div>

          {/* Proof */}
          <div className="mtask-card__field">
            <span className="mtask-field-label">Proof</span>
            {editingProof ? (
              <div className="mtask-inline-edit">
                <input
                  className="mtask-edit-input"
                  value={proofDraft}
                  onChange={(e) => setProofDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveProof()
                    if (e.key === "Escape") setEditingProof(false)
                  }}
                  autoFocus
                />
                <button className="mtask-edit-btn" onClick={saveProof}>
                  Save
                </button>
                <button
                  className="mtask-edit-btn mtask-edit-btn--cancel"
                  onClick={() => setEditingProof(false)}
                >
                  ×
                </button>
              </div>
            ) : (
              <span
                className={`mtask-field-value ${status.hasProof ? "" : "mtask-empty"}`}
                onClick={() => {
                  setProofDraft(task.proof)
                  setEditingProof(true)
                }}
              >
                {task.proof || "click to set"}
              </span>
            )}
          </div>

          {/* Priority */}
          <div className="mtask-card__field">
            <span className="mtask-field-label">Priority</span>
            {editingPriority ? (
              <div className="mtask-inline-edit">
                <input
                  className="mtask-edit-input"
                  value={priorityDraft}
                  onChange={(e) => setPriorityDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") savePriority()
                    if (e.key === "Escape") setEditingPriority(false)
                  }}
                  autoFocus
                />
                <button className="mtask-edit-btn" onClick={savePriority}>
                  Save
                </button>
                <button
                  className="mtask-edit-btn mtask-edit-btn--cancel"
                  onClick={() => setEditingPriority(false)}
                >
                  ×
                </button>
              </div>
            ) : (
              <span
                className={`mtask-field-value ${status.hasPriority ? "" : "mtask-empty"}`}
                onClick={() => {
                  setPriorityDraft(task.priority)
                  setEditingPriority(true)
                }}
              >
                {task.priority || "click to set"}
              </span>
            )}
          </div>

          {/* Try counter */}
          <div className="mtask-card__tries">
            <span className="mtask-field-label">Tries</span>
            <span className="mtask-tries-count">{task.tries || 0}</span>
            <button
              type="button"
              className="mtask-tries-btn"
              onClick={() => decrementTries(task.id)}
              title="Decrease try count"
            >
              - attempt
            </button>
            <button
              type="button"
              className="mtask-tries-btn"
              onClick={() => incrementTries(task.id)}
              title="Increment try count"
            >
              + attempt
            </button>
          </div>

          {/* Actions */}
          <div className="mtask-card__actions">
            {!isCompleted && (
              <button
                type="button"
                className={`mtask-action-btn ${isActive ? "mtask-action-btn--active-on" : ""}`}
                onClick={() => setActiveMainTaskId(isActive ? "" : task.id)}
              >
                {isActive ? "▶ In sidebar" : "▶ Set active"}
              </button>
            )}
            {!isCompleted && (
              <button
                type="button"
                className="mtask-action-btn mtask-action-btn--complete"
                onClick={handleConfirmComplete}
              >
                ✓ Complete task
              </button>
            )}
            {isCompleted && (
              <button
                type="button"
                className="mtask-action-btn"
                onClick={() => restoreMainTask(task.id)}
              >
                ↩ Restore
              </button>
            )}
            <button
              type="button"
              className="mtask-action-btn mtask-action-btn--danger"
              onClick={() => {
                if (window.confirm("Delete this task?")) deleteMainTask(task.id)
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
