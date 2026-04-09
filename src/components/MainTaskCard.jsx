import { useState, useEffect } from "react"
import { useMainTask } from "../context/MainTaskContext"
import { parseStepRaw, buildRenderTree, getDepth } from "../utils/stepUtils"

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
  const validSteps = steps.filter((s) => (s?.raw || "").trim().length > 0)
  const proof = typeof task?.proof === "string" ? task.proof : ""
  const priority = typeof task?.priority === "string" ? task.priority : ""
  const hasSteps = validSteps.length > 0
  const hasTime =
    hasSteps && validSteps.every((s) => parseStepRaw(s.raw).minutes > 0)
  const hasProof = proof.trim().length > 0
  const hasPriority = priority.trim().length > 0
  return { hasSteps, hasTime, hasProof, hasPriority }
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
    reorderStep,
    addSubstep,
    reparentStep,
    promoteStep,
    demoteStep,
    moveStepNextTo,
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
  const [addingSubstepFor, setAddingSubstepFor] = useState(null) // stepId | null
  const [newSubstepRaw, setNewSubstepRaw] = useState("")
  const [draggedStepId, setDraggedStepId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null) // { id, zone: "before"|"after"|"into" }

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

  const status = computeStatus(task)
  const isActive = activeMainTaskId === task.id
  const isCompleted = task.status === "completed"
  const flatSteps = Array.isArray(task?.steps) ? task.steps : []
  const completedSteps = flatSteps.filter((s) => s.completed).length
  const totalSteps = flatSteps.length
  const renderTree = buildRenderTree(flatSteps)

  function handleAddSubstep(parentStepId) {
    if (!newSubstepRaw.trim()) return
    addSubstep(task.id, parentStepId, newSubstepRaw.trim())
    setNewSubstepRaw("")
    setAddingSubstepFor(null)
  }

  function handleDragStart(stepId, event) {
    setDraggedStepId(stepId)
    setDropTarget(null)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", stepId)
  }

  function handleDragOver(stepId, event) {
    if (!draggedStepId || draggedStepId === stepId) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const y = event.clientY - rect.top
    const pct = y / rect.height
    const zone = pct < 0.25 ? "before" : pct > 0.75 ? "after" : "into"
    setDropTarget((prev) =>
      prev?.id === stepId && prev?.zone === zone ? prev : { id: stepId, zone },
    )
  }

  function handleDragLeave(stepId) {
    setDropTarget((prev) => (prev?.id === stepId ? null : prev))
  }

  function handleDrop(targetStepId, event) {
    event.preventDefault()
    const sourceId = draggedStepId
    if (!sourceId || sourceId === targetStepId) {
      setDraggedStepId(null)
      setDropTarget(null)
      return
    }
    const zone = dropTarget?.zone ?? "after"
    if (zone === "into") {
      reparentStep(task.id, sourceId, targetStepId)
    } else {
      moveStepNextTo(task.id, sourceId, targetStepId, zone)
    }
    setDraggedStepId(null)
    setDropTarget(null)
  }

  function handleDragEnd() {
    setDraggedStepId(null)
    setDropTarget(null)
  }

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

  function renderStepNode(node, siblingIndex, siblingCount, depth = 0) {
    const parsed = parseStepRaw(node.raw)
    const isDragged = draggedStepId === node.id
    const isDropTarget = dropTarget?.id === node.id
    const dropZone = isDropTarget ? dropTarget.zone : null
    const stepDepth = getDepth(flatSteps, node.id)
    const hasPrevSibling = siblingIndex > 0

    const dropClass =
      dropZone === "before"
        ? "mtask-step-row--drop-before"
        : dropZone === "after"
          ? "mtask-step-row--drop-after"
          : dropZone === "into"
            ? "mtask-step-row--drop-into"
            : ""

    return (
      <div key={node.id} className="mtask-step-tree-node">
        <div
          className={`mtask-step-row ${isDragged ? "mtask-step-row--dragging" : ""} ${dropClass}`}
          style={{ marginLeft: `${depth * 18}px` }}
          onDragOver={(event) => handleDragOver(node.id, event)}
          onDragLeave={() => handleDragLeave(node.id)}
          onDrop={(event) => handleDrop(node.id, event)}
        >
          <button
            type="button"
            className="mtask-step-drag"
            draggable
            onDragStart={(event) => handleDragStart(node.id, event)}
            onDragEnd={handleDragEnd}
            title="Drag to reorder or reparent"
          >
            ⋮⋮
          </button>
          {depth > 0 && <span className="mtask-step-indent">↳</span>}
          <input
            type="checkbox"
            className="mtask-step-check"
            checked={node.completed}
            onChange={() => toggleStepComplete(task.id, node.id)}
          />
          <input
            type="text"
            className={`mtask-step-edit ${node.completed ? "mtask-step-text--done" : ""}`}
            value={node.raw}
            onChange={(e) => updateStep(task.id, node.id, e.target.value)}
            placeholder="Step name 5"
          />
          {parsed.minutes > 0 && (
            <span className="mtask-step-time">{parsed.minutes}m</span>
          )}
          <div className="mtask-step-right">
            <button
              type="button"
              className="mtask-step-ctrl"
              onClick={() => reorderStep(task.id, node.id, "up")}
              disabled={siblingIndex === 0}
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              className="mtask-step-ctrl"
              onClick={() => reorderStep(task.id, node.id, "down")}
              disabled={siblingIndex === siblingCount - 1}
              title="Move down"
            >
              ↓
            </button>
            {stepDepth > 0 && (
              <button
                type="button"
                className="mtask-step-ctrl"
                onClick={() => promoteStep(task.id, node.id)}
                title="Promote (move up one level)"
              >
                ←
              </button>
            )}
            {hasPrevSibling && (
              <button
                type="button"
                className="mtask-step-ctrl"
                onClick={() => demoteStep(task.id, node.id)}
                title="Demote (nest under previous sibling)"
              >
                →
              </button>
            )}
            <span className="mtask-step-tries-count">{node.tries || 0}×</span>
            <button
              type="button"
              className="mtask-step-ctrl"
              onClick={() => decrementStepTries(task.id, node.id)}
              title="Decrease step tries"
            >
              -
            </button>
            <button
              type="button"
              className="mtask-step-ctrl"
              onClick={() => incrementStepTries(task.id, node.id)}
              title="Increase step tries"
            >
              +
            </button>
            <button
              type="button"
              className="mtask-step-ctrl mtask-step-ctrl--label"
              onClick={() => {
                setAddingSubstepFor(
                  addingSubstepFor === node.id ? null : node.id,
                )
                setNewSubstepRaw("")
              }}
              title="Add child substep"
            >
              + Sub
            </button>
            <button
              type="button"
              className="mtask-step-remove"
              onClick={() => removeStepFromTask(task.id, node.id)}
              title="Remove step"
            >
              ×
            </button>
          </div>
        </div>
        {addingSubstepFor === node.id && (
          <div
            className="mtask-step-add-child"
            style={{ marginLeft: `${(depth + 1) * 18}px` }}
          >
            <input
              className="mtask-add-step-input"
              value={newSubstepRaw}
              onChange={(e) => setNewSubstepRaw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAddSubstep(node.id)
                }
                if (e.key === "Escape") setAddingSubstepFor(null)
              }}
              placeholder="Add substep (e.g. Diska 5)"
              autoFocus
            />
            <button
              type="button"
              className="mtask-add-step-btn"
              onClick={() => handleAddSubstep(node.id)}
            >
              +
            </button>
            <button
              type="button"
              className="mtask-step-ctrl"
              onClick={() => setAddingSubstepFor(null)}
            >
              ×
            </button>
          </div>
        )}
        {(node.children || []).map((child, ci) =>
          renderStepNode(child, ci, node.children.length, depth + 1),
        )}
      </div>
    )
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
            {renderTree.length === 0 && (
              <p className="mtask-empty">No steps yet.</p>
            )}
            {renderTree.map((node, idx) =>
              renderStepNode(node, idx, renderTree.length, 0),
            )}
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
