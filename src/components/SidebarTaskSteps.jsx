import { useState } from "react"
import { useMainTask } from "../context/MainTaskContext"
import { parseStepRaw, buildRenderTree, getDepth } from "../utils/stepUtils"

export default function SidebarTaskSteps() {
  const {
    mainTasks,
    activeMainTaskId,
    setActiveMainTaskId,
    toggleStepComplete,
    completeMainTask,
    incrementTries,
    decrementTries,
    incrementStepTries,
    decrementStepTries,
    reorderStep,
    addSubstep,
    promoteStep,
    demoteStep,
  } = useMainTask()

  const [addingSubstepFor, setAddingSubstepFor] = useState(null)
  const [newSubstepRaw, setNewSubstepRaw] = useState("")

  const task = mainTasks.find((t) => t.id === activeMainTaskId)

  if (!task) return null

  const flatSteps = Array.isArray(task.steps) ? task.steps : []
  const totalCount = flatSteps.length
  const completedCount = flatSteps.filter((s) => s.completed).length
  const allDone = totalCount > 0 && completedCount === totalCount
  const renderTree = buildRenderTree(flatSteps)

  function handleAddSubstep(parentStepId) {
    if (!newSubstepRaw.trim()) return
    addSubstep(task.id, parentStepId, newSubstepRaw.trim())
    setNewSubstepRaw("")
    setAddingSubstepFor(null)
  }

  function renderStep(node, siblingIndex, siblingCount, depth = 0) {
    const parsed = parseStepRaw(node.raw)
    const stepDepth = getDepth(flatSteps, node.id)
    const hasPrevSibling = siblingIndex > 0

    return (
      <div key={node.id}>
        <div className="sidebar-step" style={{ marginLeft: `${depth * 16}px` }}>
          <input
            type="checkbox"
            checked={node.completed}
            onChange={() => toggleStepComplete(task.id, node.id)}
          />
          <span
            className={`sidebar-step__text ${node.completed ? "sidebar-step__text--done" : ""}`}
          >
            {parsed.text || node.raw}
          </span>
          {parsed.minutes > 0 && (
            <span className="sidebar-step__time">{parsed.minutes}m</span>
          )}
          <span className="sidebar-step__step-tries">
            {node.tries || 0}×
            <button
              type="button"
              className="sidebar-step__tries-btn"
              onClick={() => decrementStepTries(task.id, node.id)}
              title="Decrease step tries"
            >
              -
            </button>
            <button
              type="button"
              className="sidebar-step__tries-btn"
              onClick={() => incrementStepTries(task.id, node.id)}
              title="Increase step tries"
            >
              +
            </button>
          </span>
          <span className="sidebar-step__hierarchy-btns">
            <button
              type="button"
              className="sidebar-step__tries-btn"
              onClick={() => reorderStep(task.id, node.id, "up")}
              disabled={siblingIndex === 0}
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              className="sidebar-step__tries-btn"
              onClick={() => reorderStep(task.id, node.id, "down")}
              disabled={siblingIndex === siblingCount - 1}
              title="Move down"
            >
              ↓
            </button>
            {stepDepth > 0 && (
              <button
                type="button"
                className="sidebar-step__tries-btn"
                onClick={() => promoteStep(task.id, node.id)}
                title="Promote"
              >
                ←
              </button>
            )}
            {hasPrevSibling && (
              <button
                type="button"
                className="sidebar-step__tries-btn"
                onClick={() => demoteStep(task.id, node.id)}
                title="Demote"
              >
                →
              </button>
            )}
            <button
              type="button"
              className="sidebar-step__tries-btn sidebar-step__breakdown-btn"
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
          </span>
        </div>
        {addingSubstepFor === node.id && (
          <div
            className="sidebar-step__add-child"
            style={{ marginLeft: `${(depth + 1) * 16}px` }}
          >
            <input
              className="sidebar-step__add-child-input"
              value={newSubstepRaw}
              onChange={(e) => setNewSubstepRaw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAddSubstep(node.id)
                }
                if (e.key === "Escape") setAddingSubstepFor(null)
              }}
              placeholder="Add substep"
              autoFocus
            />
            <button
              type="button"
              className="sidebar-step__tries-btn"
              onClick={() => handleAddSubstep(node.id)}
            >
              +
            </button>
          </div>
        )}
        {(node.children || []).map((child, ci) =>
          renderStep(child, ci, node.children.length, depth + 1),
        )}
      </div>
    )
  }

  return (
    <div className="sidebar-steps">
      <div className="sidebar-steps__header">
        <span
          className="sidebar-steps__title"
          title={`Fixa så att jag ${task.title}`}
        >
          ▸ {task.title || "Unnamed task"}
        </span>
        <button
          type="button"
          className="sidebar-steps__close"
          onClick={() => setActiveMainTaskId("")}
          title="Clear active task"
        >
          ×
        </button>
      </div>

      {totalCount > 0 && (
        <div className="sidebar-steps__progress">
          {completedCount}/{totalCount} steps
        </div>
      )}

      <div className="sidebar-steps__list">
        {renderTree.map((node, idx) =>
          renderStep(node, idx, renderTree.length),
        )}
      </div>

      {flatSteps.length === 0 && (
        <p className="sidebar-steps__empty">No steps.</p>
      )}

      <div className="sidebar-steps__actions">
        <button
          type="button"
          className="sidebar-steps__try-btn"
          onClick={() => decrementTries(task.id)}
          title={`Tries: ${task.tries || 0}`}
        >
          Tries: {task.tries || 0} -
        </button>
        <button
          type="button"
          className="sidebar-steps__try-btn"
          onClick={() => incrementTries(task.id)}
          title={`Tries: ${task.tries || 0}`}
        >
          Tries: {task.tries || 0} +
        </button>
        {allDone && (
          <button
            type="button"
            className="sidebar-steps__complete-btn"
            onClick={() => {
              if (window.confirm("Complete this entire task?")) {
                completeMainTask(task.id)
              }
            }}
          >
            ✓ Complete!
          </button>
        )}
      </div>
    </div>
  )
}
