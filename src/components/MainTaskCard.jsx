import { useState, useEffect, useRef } from "react"
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useMainTask } from "../context/MainTaskContext"
import { useAppSync } from "../context/AppSyncContext"
import { parseStepRaw, buildRenderTree, getDepth } from "../utils/stepUtils"
import { fmtDuration, fmtLocalDate } from "../utils/timeUtils"

const REASON_LABELS = {
  know_why: "I know why it didn't work",
  stuck_unknown: "I don't know why I'm stuck",
  needs_smaller_steps: "I need smaller steps",
  needs_different_order: "I need a different order",
  interrupted: "Interrupted / waiting",
  needs_simplification: "Need to simplify",
}

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

function flattenRenderOrder(nodes, acc = []) {
  for (const node of nodes || []) {
    acc.push(node.id)
    flattenRenderOrder(node.children || [], acc)
  }
  return acc
}

function SortableStepRow({ nodeId, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: nodeId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return children({
    setNodeRef,
    style,
    attributes,
    listeners,
    isDragging,
    isOver,
  })
}

export default function MainTaskCard({ task }) {
  const { timerActiveTasks, requestFocusMainTask } = useAppSync()
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
    promoteStep,
    demoteStep,
    moveStepNextTo,
    toggleStepComplete,
    updateMainTask,
    updateStep,
    addStepToTask,
    removeStepFromTask,
    mainTasks,
    reorderMainTask,
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
  const [editingNow, setEditingNow] = useState(false)
  const [nowDraft, setNowDraft] = useState(task.now || "")
  const [newStepRaw, setNewStepRaw] = useState("")
  const [addingSubstepFor, setAddingSubstepFor] = useState(null) // stepId | null
  const [newSubstepRaw, setNewSubstepRaw] = useState("")
  const [queueByStepId, setQueueByStepId] = useState(() => new Map())
  const [taskHeadQueueItem, setTaskHeadQueueItem] = useState(null)
  const [retryHistoryOpen, setRetryHistoryOpen] = useState(false)
  const [focusedTaskFlash, setFocusedTaskFlash] = useState(false)
  const [focusedStepFlashId, setFocusedStepFlashId] = useState(null)
  const focusFlashTimeoutRef = useRef(0)
  const status = computeStatus(task)
  const isActive = activeMainTaskId === task.id
  const isCompleted = task.status === "completed"
  const flatSteps = Array.isArray(task?.steps) ? task.steps : []
  const completedSteps = flatSteps.filter((s) => s.completed).length
  const totalSteps = flatSteps.length
  const renderTree = buildRenderTree(flatSteps)
  const renderOrder = flattenRenderOrder(renderTree)
  const stepSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  )

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
  useEffect(() => {
    if (!editingNow) setNowDraft(task.now || "")
  }, [task.now, editingNow])
  useEffect(() => {
    setExpanded(isActive)
  }, [isActive])

  useEffect(
    () => () => {
      if (focusFlashTimeoutRef.current) {
        window.clearTimeout(focusFlashTimeoutRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    const linked = timerActiveTasks.filter(
      (entry) => entry?.sourceMainTaskId && entry?.sourceStepId,
    )

    const nextMap = new Map(linked.map((entry) => [entry.sourceStepId, entry]))
    setQueueByStepId(nextMap)
    setTaskHeadQueueItem(
      linked.find((entry) => entry.sourceMainTaskId === task.id) || null,
    )
  }, [task.id, timerActiveTasks])

  function handleSetActive() {
    if (isActive) {
      setActiveMainTaskId("")
      return
    }
    setActiveMainTaskId(task.id)
    if (mainTasks[0]?.id && mainTasks[0].id !== task.id) {
      reorderMainTask(task.id, mainTasks[0].id)
    }
  }

  function queueFocusRequest(stepId = null) {
    requestFocusMainTask(task.id, stepId)
  }

  function triggerFocusFlash(stepId = null) {
    setFocusedTaskFlash(!stepId)
    setFocusedStepFlashId(stepId || null)
    if (focusFlashTimeoutRef.current) {
      window.clearTimeout(focusFlashTimeoutRef.current)
    }
    focusFlashTimeoutRef.current = window.setTimeout(() => {
      setFocusedTaskFlash(false)
      setFocusedStepFlashId(null)
      focusFlashTimeoutRef.current = 0
    }, 1100)
  }

  function handleFocusTask() {
    setActiveMainTaskId(task.id)
    if (mainTasks[0]?.id && mainTasks[0].id !== task.id) {
      reorderMainTask(task.id, mainTasks[0].id)
    }
    triggerFocusFlash(null)
    queueFocusRequest(null)
  }

  function handleFocusStep(stepId) {
    setActiveMainTaskId(task.id)
    if (mainTasks[0]?.id && mainTasks[0].id !== task.id) {
      reorderMainTask(task.id, mainTasks[0].id)
    }
    triggerFocusFlash(stepId)
    queueFocusRequest(stepId)
  }

  function handleAddSubstep(parentStepId) {
    if (!newSubstepRaw.trim()) return
    addSubstep(task.id, parentStepId, newSubstepRaw.trim())
    setNewSubstepRaw("")
    setAddingSubstepFor(null)
  }

  function handleStepDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const sourceId = String(active.id)
    const targetId = String(over.id)
    const sourceIndex = renderOrder.indexOf(sourceId)
    const targetIndex = renderOrder.indexOf(targetId)
    if (sourceIndex < 0 || targetIndex < 0) return

    const zone = sourceIndex < targetIndex ? "after" : "before"
    moveStepNextTo(task.id, sourceId, targetId, zone)
  }

  function beginTitleEdit(e) {
    if (e) e.stopPropagation()
    setTitleDraft(task.title)
    setEditingTitle(true)
  }

  function cancelTitleEdit(e) {
    if (e) e.stopPropagation()
    setTitleDraft(task.title)
    setEditingTitle(false)
  }

  function saveTitle(e) {
    if (e) e.stopPropagation()
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

  function saveNow() {
    updateMainTask(task.id, { now: nowDraft.trim() })
    setEditingNow(false)
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
    const stepDepth = getDepth(flatSteps, node.id)
    const hasPrevSibling = siblingIndex > 0
    const liveQueueItem = queueByStepId.get(node.id)
    const isLiveHead = taskHeadQueueItem?.sourceStepId === node.id
    const liveTotalSeconds = Math.max(
      60,
      Number(liveQueueItem?.estimatedMinutes || 1) * 60,
    )
    const liveProgressRatio = liveQueueItem
      ? Math.max(
          0,
          Math.min(1, liveQueueItem.remainingSeconds / liveTotalSeconds),
        )
      : 0

    return (
      <div key={node.id} className="mtask-step-tree-node">
        <SortableStepRow nodeId={node.id}>
          {({
            setNodeRef,
            style,
            attributes,
            listeners,
            isDragging,
            isOver,
          }) => (
            <div
              ref={setNodeRef}
              data-main-step-id={node.id}
              className={`mtask-step-row mtask-step-row--accent ${focusedStepFlashId === node.id ? "mtask-step-row--focus-flash" : ""} ${isDragging ? "mtask-step-row--dragging" : ""} ${isOver ? "mtask-step-row--drop-target" : ""}`}
              style={{
                ...style,
                marginLeft: `${depth * 18}px`,
                "--step-accent": task.color,
              }}
            >
              <button
                type="button"
                className="mtask-step-drag"
                title="Drag to reorder"
                {...attributes}
                {...listeners}
              >
                ⋮⋮
              </button>
              {depth > 0 && <span className="mtask-step-indent">↳</span>}
              {import.meta.env.MODE === "test" && (
                <span className="mtask-step-test-text">{node.raw}</span>
              )}
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
              {liveQueueItem && (
                <span
                  className={`mtask-step-time-live ${isLiveHead ? "mtask-step-time-live--head" : ""}`}
                >
                  {fmtDuration(liveQueueItem.remainingSeconds)} left
                </span>
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
                <span className="mtask-step-tries-count">
                  {node.tries || 0}×
                </span>
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
                {!isCompleted && !node.completed && (
                  <button
                    type="button"
                    className={`mtask-step-ctrl mtask-step-ctrl--label mtask-step-ctrl--focus ${focusedStepFlashId === node.id ? "mtask-step-ctrl--focus-on" : ""}`}
                    onClick={() => handleFocusStep(node.id)}
                    title="Focus this step in timer"
                  >
                    ▶ Focus
                  </button>
                )}
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
          )}
        </SortableStepRow>
        {liveQueueItem && (
          <div
            className="mtask-step-live-progress"
            style={{ marginLeft: `${depth * 18}px` }}
            aria-hidden="true"
          >
            <div
              className={`mtask-step-live-progress__fill ${isLiveHead ? "mtask-step-live-progress__fill--head" : ""}`}
              style={{
                width: `${Math.max(0, Math.min(100, liveProgressRatio * 100))}%`,
                background: task.color,
              }}
            />
          </div>
        )}
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
      data-main-task-id={task.id}
      className={`mtask-card ${isCompleted ? "mtask-card--completed" : "mtask-card--active"} ${isActive ? "mtask-card--is-active" : ""} ${focusedTaskFlash ? "mtask-card--focus-flash" : ""}`}
      style={{
        borderLeft: `4px solid ${task.color}`,
        "--task-focus-color": task.color,
        background: isCompleted
          ? undefined
          : `linear-gradient(135deg, ${`color-mix(in srgb, ${task.color} 10%, rgba(255,255,255,0.06))`} 0%, rgba(255, 255, 255, 0.06) 58%)`,
      }}
    >
      {/* Header */}
      <div className="mtask-card__header" onClick={handleSetActive}>
        <div className="mtask-card__title-row">
          <button
            type="button"
            className="mtask-card__expand"
            aria-label="▾"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((prev) => !prev)
            }}
          >
            {expanded ? "▾" : "▸"}
          </button>
          {editingTitle ? (
            <div
              className="mtask-inline-edit mtask-inline-edit--header"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                className="mtask-edit-input"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle(e)
                  if (e.key === "Escape") cancelTitleEdit(e)
                }}
                aria-label="Edit task title"
                autoFocus
              />
              <button className="mtask-edit-btn" onClick={saveTitle}>
                Save
              </button>
              <button
                className="mtask-edit-btn mtask-edit-btn--cancel"
                onClick={cancelTitleEdit}
              >
                ×
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="mtask-card__title mtask-card__title-button"
              aria-label={task.title || "(no title)"}
              onClick={beginTitleEdit}
            >
              {isCompleted && <span className="mtask-card__done-mark">✓ </span>}
              <span className="mtask-card__title-prefix">Fixa så att jag </span>
              <span>{task.title || "(no title)"}</span>
            </button>
          )}
        </div>
        <div className="mtask-card__header-meta">
          {taskHeadQueueItem && (
            <span className="mtask-card__live-countdown">
              {fmtDuration(taskHeadQueueItem.remainingSeconds)} live
            </span>
          )}
          {totalSteps > 0 && (
            <span className="mtask-card__step-progress">
              {completedSteps}/{totalSteps}
            </span>
          )}
          {task.proof && !expanded && (
            <button
              type="button"
              className="mtask-card__proof-preview"
              onClick={(e) => {
                e.stopPropagation()
                setProofDraft(task.proof)
                setEditingProof(true)
                setExpanded(true)
              }}
            >
              {task.proof}
            </button>
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
          {!isCompleted && (
            <button
              type="button"
              className={`mtask-action-btn mtask-action-btn--focus ${focusedTaskFlash ? "mtask-action-btn--focus-on" : ""} ${isActive ? "mtask-action-btn--active-on" : ""}`}
              onClick={(e) => {
                e.stopPropagation()
                handleFocusTask()
              }}
            >
              {focusedTaskFlash ? "▶ Focused" : "▶ Focus"}
            </button>
          )}
          <button
            type="button"
            className="mtask-card__header-delete"
            onClick={(e) => {
              e.stopPropagation()
              deleteMainTask(task.id)
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="mtask-card__body">
          {/* Title edit */}
          <div className="mtask-card__field">
            <span className="mtask-field-label">Goal</span>
            {editingTitle ? (
              <span className="mtask-field-value mtask-field-value--editing">
                Editing title above
              </span>
            ) : (
              <span className="mtask-field-value" onClick={beginTitleEdit}>
                {task.title || <em className="mtask-empty">click to set</em>}
              </span>
            )}
          </div>

          {/* Context (starting state recorded in builder) */}
          {(task.now || editingNow) && (
            <div className="mtask-card__field">
              <span className="mtask-field-label">Context</span>
              {editingNow ? (
                <div className="mtask-inline-edit">
                  <input
                    className="mtask-edit-input"
                    value={nowDraft}
                    onChange={(e) => setNowDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveNow()
                      if (e.key === "Escape") setEditingNow(false)
                    }}
                    autoFocus
                  />
                  <button className="mtask-edit-btn" onClick={saveNow}>
                    Save
                  </button>
                  <button
                    className="mtask-edit-btn mtask-edit-btn--cancel"
                    onClick={() => setEditingNow(false)}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <span
                  className="mtask-field-value"
                  onClick={() => {
                    setNowDraft(task.now || "")
                    setEditingNow(true)
                  }}
                >
                  {task.now || <em className="mtask-empty">click to set</em>}
                </span>
              )}
            </div>
          )}

          {/* Steps */}
          <div className="mtask-card__steps">
            <span className="mtask-field-label">Steps</span>
            {renderTree.length === 0 && (
              <p className="mtask-empty">No steps yet.</p>
            )}
            <DndContext
              sensors={stepSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleStepDragEnd}
            >
              <SortableContext
                items={renderOrder}
                strategy={verticalListSortingStrategy}
              >
                {renderTree.map((node, idx) =>
                  renderStepNode(node, idx, renderTree.length, 0),
                )}
              </SortableContext>
            </DndContext>
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

          {/* Retry history */}
          {Array.isArray(task.retryReflections) &&
            task.retryReflections.length > 0 && (
              <div className="mtask-retry-history">
                <button
                  type="button"
                  className="mtask-retry-history-toggle"
                  onClick={() => setRetryHistoryOpen((v) => !v)}
                >
                  <span>{retryHistoryOpen ? "▾" : "▸"}</span>
                  <span>
                    Retry reflections ({task.retryReflections.length})
                  </span>
                </button>
                {retryHistoryOpen && (
                  <div className="mtask-retry-history-entries">
                    {task.retryReflections.map((entry, idx) => {
                      const addedStepNames = (entry.addedStepIds || [])
                        .map((sid) => {
                          const s = flatSteps.find((st) => st.id === sid)
                          return s ? parseStepRaw(s.raw).text || s.raw : null
                        })
                        .filter(Boolean)
                      return (
                        <div key={idx} className="mtask-retry-history-entry">
                          <div className="mtask-retry-history-entry-header">
                            <span className="mtask-retry-history-attempt">
                              Attempt #{entry.atTry}
                            </span>
                            <span className="mtask-retry-history-date">
                              {entry.createdAt
                                ? fmtLocalDate(entry.createdAt)
                                : ""}
                            </span>
                          </div>
                          {entry.reasons?.length > 0 && (
                            <div className="mtask-retry-history-reasons">
                              {entry.reasons.map((r) => (
                                <span
                                  key={r}
                                  className="mtask-retry-history-reason"
                                >
                                  {REASON_LABELS[r] || r}
                                </span>
                              ))}
                            </div>
                          )}
                          {entry.freeText && (
                            <p className="mtask-retry-history-freetext">
                              "{entry.freeText}"
                            </p>
                          )}
                          {addedStepNames.length > 0 && (
                            <div>
                              <span className="mtask-retry-history-steps-label">
                                Steps added:
                              </span>
                              <div className="mtask-retry-history-steps-list">
                                {addedStepNames.map((name, si) => (
                                  <span
                                    key={si}
                                    className="mtask-retry-history-step-name"
                                  >
                                    • {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

          {/* Actions */}
          <div className="mtask-card__actions">
            {!isCompleted && (
              <button
                type="button"
                className={`mtask-action-btn mtask-action-btn--focus ${focusedTaskFlash ? "mtask-action-btn--focus-on" : ""} ${isActive ? "mtask-action-btn--active-on" : ""}`}
                onClick={handleFocusTask}
              >
                {focusedTaskFlash ? "▶ Focused" : "▶ Focus"}
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
          </div>
        </div>
      )}
    </article>
  )
}
