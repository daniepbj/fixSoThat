import { useRef, useState } from "react"
import SectionMoveControls from "./SectionMoveControls"
import { parseStepRaw, genStepId } from "../utils/stepUtils"
import { useMainTask } from "../context/MainTaskContext"

function normalizeInput(value) {
  return value.trim()
}

function buildPrototypeOutput({ goal, steps }) {
  const trimmedGoal = normalizeInput(goal)
  const validSteps = steps
    .map((s) => ({ ...s, raw: normalizeInput(s.raw) }))
    .filter((s) => s.raw.length > 0)

  const lines = []
  lines.push(
    trimmedGoal ? `* Fixa sa att jag ${trimmedGoal}` : "* Fixa sa att jag",
  )

  validSteps.forEach((step, index) => {
    const { text, minutes } = parseStepRaw(step.raw)
    const time = minutes > 0 ? ` ${minutes}` : ""
    lines.push(`${index + 1}. ${text}${time}`)
  })

  return lines.join("\n")
}

export default function StructuredTaskPrototype({
  sectionControls,
  sectionCollapsed,
  onToggleSectionCollapsed,
}) {
  const { addMainTaskAndActivate, updateMainTask, mainTasks } = useMainTask()
  const [goal, setGoal] = useState("")
  const [steps, setSteps] = useState([{ id: genStepId(), raw: "" }])
  const [doneSteps, setDoneSteps] = useState({})
  const [generatedText, setGeneratedText] = useState("")
  const [queueTaskId, setQueueTaskId] = useState("")
  const stepInputRefs = useRef({})

  function buildTaskSteps(doneMap) {
    return (steps || [])
      .map((step) => ({
        id: step.id,
        raw: String(step.raw || "").trim(),
        completed: Boolean(doneMap[step.id]),
      }))
      .filter((step) => step.raw.length > 0)
  }

  function syncPrototypeTask(taskId, doneMap) {
    if (!taskId) return
    updateMainTask(taskId, {
      title: normalizeInput(goal) || "Fixa prototype",
      steps: buildTaskSteps(doneMap),
      proof: "",
      priority: "",
      status: "active",
    })
  }

  function ensurePrototypeTask(doneMap) {
    const exists = Boolean(queueTaskId) && mainTasks.some((t) => t.id === queueTaskId)
    if (exists) {
      syncPrototypeTask(queueTaskId, doneMap)
      return queueTaskId
    }

    const created = addMainTaskAndActivate({
      title: normalizeInput(goal) || "Fixa prototype",
      now: "",
      steps: buildTaskSteps(doneMap),
      proof: "",
      priority: "",
    })

    if (created?.id) {
      window.localStorage.setItem("fst_autostart_main_task", created.id)
      setQueueTaskId(created.id)
      return created.id
    }
    return ""
  }

  function addStep(nextRaw = "") {
    const newStep = { id: genStepId(), raw: nextRaw }
    setSteps((prev) => [...prev, newStep])
    window.setTimeout(() => {
      const ref = stepInputRefs.current[newStep.id]
      if (ref) {
        ref.focus()
        ref.setSelectionRange(0, 0)
      }
    }, 0)
  }

  function updateStepRaw(id, raw) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, raw } : s)))
  }

  function handleStepDone(id) {
    const idx = steps.findIndex((s) => s.id === id)
    if (idx < 0) return

    const nextDoneMap = { ...doneSteps, [id]: true }
    setDoneSteps(nextDoneMap)
    ensurePrototypeTask(nextDoneMap)

    const nextStep = steps[idx + 1]
    if (nextStep) {
      window.setTimeout(() => {
        const ref = stepInputRefs.current[nextStep.id]
        if (ref) {
          ref.focus()
          ref.setSelectionRange(0, 0)
        }
      }, 0)
      return
    }

    addStep("")
  }

  function handleStepKeyDown(event, id) {
    if (event.key !== "Enter" || event.shiftKey) return
    event.preventDefault()

    const idx = steps.findIndex((s) => s.id === id)
    if (idx < 0) return

    const inputRef = stepInputRefs.current[id]
    const currentRaw = steps[idx]?.raw ?? ""
    const cursor = inputRef?.selectionStart ?? currentRaw.length
    const before = currentRaw.slice(0, cursor)
    const after = currentRaw.slice(cursor)
    const newStep = { id: genStepId(), raw: after }

    setSteps((prev) => [
      ...prev.slice(0, idx),
      { ...prev[idx], raw: before },
      newStep,
      ...prev.slice(idx + 1),
    ])

    window.setTimeout(() => {
      const ref = stepInputRefs.current[newStep.id]
      if (ref) {
        ref.focus()
        ref.setSelectionRange(0, 0)
      }
    }, 0)
  }

  function handleDoneAndGenerate() {
    ensurePrototypeTask(doneSteps)
    const nextOutput = buildPrototypeOutput({ goal, steps })
    setGeneratedText(nextOutput)
  }

  return (
    <section className="task-builder-card" aria-label="Fixa prototype flow">
      <div className="task-builder-header">
        <div className="task-builder-header-text">
          <button
            type="button"
            className="section-collapse-toggle"
            onClick={onToggleSectionCollapsed}
          >
            Fixa prototype (Done flow)
            <span className="section-collapse-arrow">
              {sectionCollapsed ? "▸" : "▾"}
            </span>
          </button>
        </div>
        <div className="task-builder-header-actions">
          {sectionControls && <SectionMoveControls {...sectionControls} />}
        </div>
      </div>

      {!sectionCollapsed && (
        <>
          <p className="task-builder-help">
            Type your goal and steps. Use <code>step name 5</code> format for
            integer minutes. Press <kbd>Enter</kbd> to split or add steps fast;
            paste multiple lines at once.
          </p>

          <form
            className="task-builder-form"
            onSubmit={(event) => {
              event.preventDefault()
              handleDoneAndGenerate()
            }}
          >
            <label className="task-builder-label" htmlFor="prototype-goal-input">
              Fixa sa att jag ...
            </label>
            <textarea
              id="prototype-goal-input"
              className="task-builder-input task-builder-textarea"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="laddat mobilen stadat usbn"
              rows={2}
            />

            <fieldset className="task-builder-steps-section">
              <legend className="task-builder-legend">Steps</legend>
              <div className="task-step-list">
                {steps.map((step, idx) => {
                  const parsed = parseStepRaw(step.raw)
                  const isDone = Boolean(doneSteps[step.id])
                  return (
                    <div
                      className={`task-step-row ${isDone ? "task-step-row--completed" : ""}`}
                      key={step.id}
                    >
                      <div className="task-step-number">{idx + 1}</div>
                      <input
                        ref={(el) => {
                          if (el) stepInputRefs.current[step.id] = el
                        }}
                        type="text"
                        className={`task-step-input ${isDone ? "task-step-input--completed" : ""}`}
                        value={step.raw}
                        onChange={(e) => updateStepRaw(step.id, e.target.value)}
                        onKeyDown={(e) => handleStepKeyDown(e, step.id)}
                        placeholder="Step name 5"
                      />

                      {parsed.minutes > 0 && (
                        <span className="task-step-time-badge">{parsed.minutes}m</span>
                      )}

                      <button
                        type="button"
                        className={`task-step-done-btn ${isDone ? "task-step-done-btn--active" : ""}`}
                        onClick={() => handleStepDone(step.id)}
                      >
                        {isDone ? "Done ✓" : "Done"}
                      </button>
                    </div>
                  )
                })}
              </div>

              <button
                type="button"
                className="task-builder-add-step-btn"
                onClick={() => addStep("")}
              >
                + Add step
              </button>
            </fieldset>

            <button
              type="submit"
              className="task-builder-generate task-builder-generate--big"
            >
              Done and Generate
            </button>
          </form>

          {generatedText && (
            <section className="task-builder-output" aria-label="Prototype output">
              <h3>Prototype output</h3>
              <pre className="task-builder-pre">{generatedText}</pre>
            </section>
          )}
        </>
      )}
    </section>
  )
}
