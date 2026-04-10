import { useState, useMemo } from "react"
import { useMainTask } from "../context/MainTaskContext"
import { parseStepRaw, buildRenderTree, getDepth } from "../utils/stepUtils"

const REASON_OPTIONS = [
  { key: "know_why", label: "I know why it didn't work" },
  { key: "stuck_unknown", label: "I don't know why I'm stuck" },
  { key: "needs_smaller_steps", label: "I need smaller steps" },
  { key: "needs_different_order", label: "I need a different order" },
  { key: "interrupted", label: "I was interrupted / waiting" },
  { key: "needs_simplification", label: "I need to simplify the task" },
]

export default function RetryReflectionModal() {
  const {
    mainTasks,
    retryReflectionTaskId,
    saveRetryReflection,
    dismissRetryReflection,
    reorderStep,
    removeStepFromTask,
    moveStepNextTo,
  } = useMainTask()

  const task = mainTasks.find((t) => t.id === retryReflectionTaskId)

  // ── Local state ──
  const [selectedReasons, setSelectedReasons] = useState([])
  const [freeText, setFreeText] = useState("")
  const [newStepLines, setNewStepLines] = useState([""])
  const [parentStepId, setParentStepId] = useState("")

  // ── Derived ──
  const flatSteps = useMemo(
    () => (Array.isArray(task?.steps) ? task.steps : []),
    [task?.steps],
  )
  const incompleteSteps = useMemo(
    () => flatSteps.filter((s) => !s.completed),
    [flatSteps],
  )
  const renderTree = useMemo(
    () => buildRenderTree(incompleteSteps),
    [incompleteSteps],
  )
  const allStepsTree = useMemo(() => buildRenderTree(flatSteps), [flatSteps])

  if (!task) return null

  // ── Helpers ──
  function toggleReason(key) {
    setSelectedReasons((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  function handleNewStepChange(index, value) {
    setNewStepLines((prev) => {
      const copy = [...prev]
      copy[index] = value
      return copy
    })
  }

  function handleNewStepKeyDown(index, e) {
    if (e.key === "Enter") {
      e.preventDefault()
      setNewStepLines((prev) => {
        const copy = [...prev]
        copy.splice(index + 1, 0, "")
        return copy
      })
      // Focus next input after render
      setTimeout(() => {
        const inputs = document.querySelectorAll(".mtask-retry-step-input")
        if (inputs[index + 1]) inputs[index + 1].focus()
      }, 0)
    }
    if (
      e.key === "Backspace" &&
      newStepLines[index] === "" &&
      newStepLines.length > 1
    ) {
      e.preventDefault()
      setNewStepLines((prev) => prev.filter((_, i) => i !== index))
      setTimeout(() => {
        const inputs = document.querySelectorAll(".mtask-retry-step-input")
        const focusIdx = Math.max(0, index - 1)
        if (inputs[focusIdx]) inputs[focusIdx].focus()
      }, 0)
    }
  }

  function removeNewStepLine(index) {
    if (newStepLines.length <= 1) {
      setNewStepLines([""])
      return
    }
    setNewStepLines((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSave() {
    const steps = newStepLines.map((l) => l.trim()).filter((l) => l.length > 0)
    saveRetryReflection(task.id, {
      reasons: selectedReasons,
      freeText: freeText.trim(),
      newSteps: steps,
      parentStepId: parentStepId || null,
    })
    // Reset local state
    setSelectedReasons([])
    setFreeText("")
    setNewStepLines([""])
    setParentStepId("")
  }

  function handleSkip() {
    dismissRetryReflection()
    setSelectedReasons([])
    setFreeText("")
    setNewStepLines([""])
    setParentStepId("")
  }

  // ── Existing step rendering (reorderable + removable) ──
  function renderExistingStepNode(node, siblingIndex, siblingCount, depth = 0) {
    const parsed = parseStepRaw(node.raw)
    return (
      <div key={node.id} className="mtask-retry-existing-node">
        <div
          className="mtask-retry-existing-row"
          style={{ marginLeft: `${depth * 16}px` }}
        >
          {depth > 0 && <span className="mtask-retry-indent">↳</span>}
          <span
            className={`mtask-retry-existing-text ${node.completed ? "mtask-retry-existing-text--done" : ""}`}
          >
            {parsed.text || node.raw}
          </span>
          {parsed.minutes > 0 && (
            <span className="mtask-retry-time-badge">{parsed.minutes}m</span>
          )}
          <div className="mtask-retry-existing-controls">
            <button
              type="button"
              className="mtask-retry-ctrl"
              onClick={() => reorderStep(task.id, node.id, "up")}
              disabled={siblingIndex === 0}
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              className="mtask-retry-ctrl"
              onClick={() => reorderStep(task.id, node.id, "down")}
              disabled={siblingIndex === siblingCount - 1}
              title="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              className="mtask-retry-ctrl mtask-retry-ctrl--danger"
              onClick={() => removeStepFromTask(task.id, node.id)}
              title="Remove step"
            >
              ×
            </button>
          </div>
        </div>
        {(node.children || []).map((child, ci) =>
          renderExistingStepNode(child, ci, node.children.length, depth + 1),
        )}
      </div>
    )
  }

  // ── Flat list of all steps for parent picker ──
  function flattenForSelect(nodes, depth = 0) {
    const result = []
    for (const node of nodes) {
      result.push({ id: node.id, raw: node.raw, depth })
      if (node.children?.length) {
        result.push(...flattenForSelect(node.children, depth + 1))
      }
    }
    return result
  }
  const flatOptionsForParent = flattenForSelect(allStepsTree)

  return (
    <div className="mtask-retry-overlay">
      <div className="mtask-retry-modal">
        {/* Header */}
        <div className="mtask-retry-header">
          <h2 className="mtask-retry-title">
            Attempt #{task.tries} — Time to reflect
          </h2>
          <p className="mtask-retry-subtitle">
            <strong>Task:</strong> Fixa så att jag {task.title || "(no title)"}
          </p>
        </div>

        {/* Section A: Reflection */}
        <section className="mtask-retry-section">
          <h3 className="mtask-retry-section-title">
            Why do you need another try?
          </h3>
          <div className="mtask-retry-options">
            {REASON_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`mtask-retry-option ${selectedReasons.includes(opt.key) ? "mtask-retry-option--selected" : ""}`}
                onClick={() => toggleReason(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <textarea
            className="mtask-retry-textarea"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Explain in your own words (optional)"
            rows={3}
          />
        </section>

        {/* Section B: Replanning */}
        <section className="mtask-retry-section">
          <h3 className="mtask-retry-section-title">Plan your next attempt</h3>

          {/* Existing incomplete steps (reorderable) */}
          {incompleteSteps.length > 0 && (
            <div className="mtask-retry-existing">
              <span className="mtask-retry-label">
                Current incomplete steps — reorder or remove:
              </span>
              <div className="mtask-retry-existing-list">
                {renderTree.map((node, idx) =>
                  renderExistingStepNode(node, idx, renderTree.length, 0),
                )}
              </div>
            </div>
          )}

          {/* New steps input */}
          <div className="mtask-retry-new-steps">
            <span className="mtask-retry-label">
              Add new steps (one per line, trailing number = minutes):
            </span>

            {/* Parent step picker */}
            <div className="mtask-retry-parent-picker">
              <label className="mtask-retry-parent-label">
                Add under:
                <select
                  className="mtask-retry-parent-select"
                  value={parentStepId}
                  onChange={(e) => setParentStepId(e.target.value)}
                >
                  <option value="">Root level (top-level steps)</option>
                  {flatOptionsForParent.map((opt) => {
                    const parsed = parseStepRaw(opt.raw)
                    const prefix = "\u00A0\u00A0".repeat(opt.depth)
                    return (
                      <option key={opt.id} value={opt.id}>
                        {prefix}
                        {opt.depth > 0 ? "↳ " : ""}
                        {parsed.text || opt.raw}
                      </option>
                    )
                  })}
                </select>
              </label>
            </div>

            <div className="mtask-retry-step-lines">
              {newStepLines.map((line, index) => (
                <div key={index} className="mtask-retry-step-line">
                  <span className="mtask-retry-step-num">{index + 1}.</span>
                  <input
                    type="text"
                    className="mtask-retry-step-input"
                    value={line}
                    onChange={(e) => handleNewStepChange(index, e.target.value)}
                    onKeyDown={(e) => handleNewStepKeyDown(index, e)}
                    placeholder="Step name 5"
                  />
                  <button
                    type="button"
                    className="mtask-retry-ctrl mtask-retry-ctrl--danger"
                    onClick={() => removeNewStepLine(index)}
                    title="Remove line"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="mtask-retry-add-line"
                onClick={() => setNewStepLines((prev) => [...prev, ""])}
              >
                + Add another step
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="mtask-retry-footer">
          <button
            type="button"
            className="mtask-retry-btn mtask-retry-btn--save"
            onClick={handleSave}
          >
            Save &amp; Continue
          </button>
          <button
            type="button"
            className="mtask-retry-btn mtask-retry-btn--skip"
            onClick={handleSkip}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
