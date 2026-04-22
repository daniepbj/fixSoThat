import { useRef, useState } from "react"
import SectionMoveControls from "./SectionMoveControls"
import { parseStepRaw, genStepId } from "../utils/stepUtils"

function normalizeInput(value) {
  return value.trim()
}

function buildPrototypeOutput({ goal, steps }) {
  const trimmedGoal = normalizeInput(goal)
  const validSteps = (steps || [])
    .map((s) => ({ ...s, raw: normalizeInput(s.raw) }))
    .filter((s) => s.raw.length > 0)

  const lines = []
  lines.push(
    trimmedGoal ? `* Fixa så att jag ${trimmedGoal}` : "* Fixa så att jag",
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
  const [goal, setGoal] = useState("")
  const [steps, setSteps] = useState([{ id: genStepId(), raw: "" }])
  const [doneSteps, setDoneSteps] = useState({})
  const [generatedText, setGeneratedText] = useState("")
  const stepInputRefs = useRef({})

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

  function removeStep(id) {
    setSteps((prev) => {
      const next = prev.filter((s) => s.id !== id)
      return next.length > 0 ? next : [{ id: genStepId(), raw: "" }]
    })
    delete stepInputRefs.current[id]
  }

  function handleStepDone(id) {
    const idx = steps.findIndex((s) => s.id === id)
    if (idx < 0) return

    setDoneSteps((prev) => ({ ...prev, [id]: true }))

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
    if (event.key === "Enter" && !event.shiftKey) {
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
      return
    }

    if (event.key === "Backspace") {
      const idx = steps.findIndex((s) => s.id === id)
      if (idx < 0) return
      const step = steps[idx]
      const inputRef = stepInputRefs.current[id]
      const cursorStart = inputRef?.selectionStart ?? step.raw.length
      const cursorEnd = inputRef?.selectionEnd ?? step.raw.length

      if (step.raw === "" && steps.length > 1) {
        event.preventDefault()
        removeStep(id)
        window.setTimeout(() => {
          const prevStep = steps[idx > 0 ? idx - 1 : 0]
          if (prevStep) {
            const ref = stepInputRefs.current[prevStep.id]
            if (ref) {
              ref.focus()
              const len = ref.value.length
              ref.setSelectionRange(len, len)
            }
          }
        }, 0)
        return
      }

      if (idx > 0 && cursorStart === 0 && cursorEnd === 0) {
        event.preventDefault()
        const prevStep = steps[idx - 1]
        const mergedRaw = `${prevStep.raw}${step.raw}`
        const mergeCursorPos = prevStep.raw.length

        setSteps((prev) => {
          const copy = [...prev]
          copy[idx - 1] = { ...copy[idx - 1], raw: mergedRaw }
          copy.splice(idx, 1)
          return copy
        })
        delete stepInputRefs.current[id]

        window.setTimeout(() => {
          const ref = stepInputRefs.current[prevStep.id]
          if (ref) {
            ref.focus()
            ref.setSelectionRange(mergeCursorPos, mergeCursorPos)
          }
        }, 0)
      }
    }
  }

  function handleStepPaste(event, id) {
    const text = event.clipboardData.getData("text")
    if (!text.includes("\n")) return
    event.preventDefault()
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    if (lines.length === 0) return
    const idx = steps.findIndex((s) => s.id === id)
    const newSteps = lines.map((raw) => ({ id: genStepId(), raw }))
    setSteps((prev) => {
      const before = prev.slice(0, idx)
      const after = prev.slice(idx + 1).filter((s) => s.raw.trim() !== "")
      return [...before, ...newSteps, ...after]
    })
    window.setTimeout(() => {
      const last = newSteps[newSteps.length - 1]
      if (last) {
        const ref = stepInputRefs.current[last.id]
        if (ref) ref.focus()
      }
    }, 0)
  }

  function handleDoneAndGenerate() {
    const validStepIds = new Set(
      (steps || [])
        .map((s) => s.id)
        .filter((id) =>
          normalizeInput(steps.find((x) => x.id === id)?.raw || ""),
        ),
    )
    const markedDone = {}
    validStepIds.forEach((id) => {
      markedDone[id] = true
    })
    setDoneSteps((prev) => ({ ...prev, ...markedDone }))
    setGeneratedText(buildPrototypeOutput({ goal, steps }))
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
            Fixa så att jag (prototype)
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
            <label
              className="task-builder-label"
              htmlFor="prototype-goal-input"
            >
              Fixa så att jag …
            </label>
            <textarea
              id="prototype-goal-input"
              className="task-builder-input task-builder-textarea"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="ätit mat"
              rows={2}
            />

            <fieldset className="task-builder-steps-section">
              <legend className="task-builder-legend">Steps</legend>
              <p className="task-builder-hint">
                Format: <code>Diska 10</code> · Paste a block of lines to fill
                all at once.
              </p>

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
                        onPaste={(e) => handleStepPaste(e, step.id)}
                        placeholder="Step name 5"
                      />

                      {parsed.minutes > 0 && (
                        <span className="task-step-time-badge">
                          {parsed.minutes}m
                        </span>
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
            <section
              className="task-builder-output"
              aria-label="Prototype output"
            >
              <h3>Prototype output</h3>
              <pre className="task-builder-pre">{generatedText}</pre>
            </section>
          )}
        </>
      )}
    </section>
  )
}
