import { useState, useRef } from "react"
import { useMainTask } from "../context/MainTaskContext"
import { genStepId, parseStepRaw } from "../utils/stepUtils"

const MAX_CATEGORIES = 5
const STAGES = ["Categories", "Goals", "Proof", "Steps", "Review"]

function makeCat() {
  return {
    id: genStepId(),
    name: "",
    minutes: "",
    goal: "",
    proof: "",
    steps: [{ id: genStepId(), raw: "" }],
  }
}

export default function GuidedCategoryBuilder() {
  const { addMainTask } = useMainTask()
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState(0)
  const [categories, setCategories] = useState([makeCat()])
  const [error, setError] = useState("")
  const [loadMsg, setLoadMsg] = useState("")
  const stepRefs = useRef({})

  // ── helpers ──

  function updateCat(id, patch) {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    )
  }

  function removeCat(id) {
    setCategories((prev) => {
      const next = prev.filter((c) => c.id !== id)
      return next.length ? next : [makeCat()]
    })
  }

  function addCat() {
    if (categories.length >= MAX_CATEGORIES) return
    setCategories((prev) => [...prev, makeCat()])
  }

  // step helpers per category
  function updateStep(catId, stepId, raw) {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === catId
          ? {
              ...c,
              steps: c.steps.map((s) => (s.id === stepId ? { ...s, raw } : s)),
            }
          : c,
      ),
    )
  }

  function addStep(catId, afterStepId) {
    const newStep = { id: genStepId(), raw: "" }
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== catId) return c
        const idx = c.steps.findIndex((s) => s.id === afterStepId)
        const next = [...c.steps]
        next.splice(idx + 1, 0, newStep)
        return { ...c, steps: next }
      }),
    )
    window.setTimeout(() => {
      const ref = stepRefs.current[newStep.id]
      if (ref) ref.focus()
    }, 0)
  }

  function removeStep(catId, stepId) {
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== catId) return c
        const next = c.steps.filter((s) => s.id !== stepId)
        return {
          ...c,
          steps: next.length ? next : [{ id: genStepId(), raw: "" }],
        }
      }),
    )
  }

  function handleStepKeyDown(e, catId, stepId) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      addStep(catId, stepId)
    }
    if (e.key === "Backspace") {
      const cat = categories.find((c) => c.id === catId)
      const step = cat?.steps.find((s) => s.id === stepId)
      if (step && step.raw === "" && cat.steps.length > 1) {
        e.preventDefault()
        const idx = cat.steps.findIndex((s) => s.id === stepId)
        removeStep(catId, stepId)
        window.setTimeout(() => {
          const prev = cat.steps[idx > 0 ? idx - 1 : 0]
          if (prev) {
            const ref = stepRefs.current[prev.id]
            if (ref) {
              ref.focus()
              ref.setSelectionRange(ref.value.length, ref.value.length)
            }
          }
        }, 0)
      }
    }
  }

  function handleStepPaste(e, catId, stepId) {
    const text = e.clipboardData.getData("text")
    if (!text.includes("\n")) return
    e.preventDefault()
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    if (!lines.length) return
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== catId) return c
        const idx = c.steps.findIndex((s) => s.id === stepId)
        const newSteps = lines.map((raw) => ({ id: genStepId(), raw }))
        const before = c.steps.slice(0, idx)
        const after = c.steps.slice(idx + 1).filter((s) => s.raw.trim() !== "")
        return { ...c, steps: [...before, ...newSteps, ...after] }
      }),
    )
  }

  // ── validation ──

  function validate() {
    if (stage === 0) {
      for (const c of categories) {
        if (!c.name.trim()) return "Every category needs a name."
        const mins = parseInt(c.minutes, 10)
        if (!mins || mins <= 0)
          return `"${c.name}" needs a positive time in minutes.`
      }
    }
    if (stage === 1) {
      for (const c of categories) {
        if (!c.goal.trim()) return `"${c.name}" needs an end goal.`
      }
    }
    if (stage === 2) {
      for (const c of categories) {
        if (!c.proof.trim()) return `"${c.name}" needs a proof description.`
      }
    }
    if (stage === 3) {
      for (const c of categories) {
        const hasStep = c.steps.some((s) => s.raw.trim())
        if (!hasStep) return `"${c.name}" needs at least one step.`
      }
    }
    return ""
  }

  function next() {
    const err = validate()
    if (err) {
      setError(err)
      return
    }
    setError("")
    setStage((s) => Math.min(s + 1, STAGES.length - 1))
  }

  function back() {
    setError("")
    setStage((s) => Math.max(s - 1, 0))
  }

  // ── load ──

  function loadAll() {
    for (const c of categories) {
      const mins = parseInt(c.minutes, 10) || 0
      // Parent step wrapping user steps: "name minutes"
      const parentId = genStepId()
      const parentRaw = `${c.name.trim()} ${mins}`
      const childSteps = c.steps
        .map((s, i) => ({
          id: genStepId(),
          raw: s.raw.trim(),
          parentId,
          order: i,
        }))
        .filter((s) => s.raw.length > 0)

      addMainTask({
        title: c.goal.trim(),
        steps: [{ id: parentId, raw: parentRaw, order: 0 }, ...childSteps],
        proof: c.proof.trim(),
        priority: "",
      })
    }
    setLoadMsg(
      `Loaded ${categories.length} task${categories.length > 1 ? "s" : ""} ✓`,
    )
    setTimeout(() => setLoadMsg(""), 2500)
    // reset
    setStage(0)
    setCategories([makeCat()])
    setError("")
  }

  // ── render stages ──

  function renderStage0() {
    return (
      <>
        <p className="gcb-stage-desc">
          Name your categories and set a time cap (minutes) for each.
        </p>
        <div className="gcb-cat-list">
          {categories.map((c, i) => (
            <div className="gcb-cat-row" key={c.id}>
              <span className="gcb-cat-num">{i + 1}</span>
              <input
                className="gcb-input gcb-input--name"
                value={c.name}
                onChange={(e) => updateCat(c.id, { name: e.target.value })}
                placeholder="Category name"
              />
              <input
                className="gcb-input gcb-input--mins"
                type="number"
                min="1"
                value={c.minutes}
                onChange={(e) => updateCat(c.id, { minutes: e.target.value })}
                placeholder="min"
              />
              <button
                type="button"
                className="gcb-remove-btn"
                onClick={() => removeCat(c.id)}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {categories.length < MAX_CATEGORIES && (
          <button type="button" className="gcb-add-btn" onClick={addCat}>
            + Add category
          </button>
        )}
      </>
    )
  }

  function renderStage1() {
    return (
      <>
        <p className="gcb-stage-desc">What's the end goal for each category?</p>
        {categories.map((c) => (
          <div className="gcb-field-card" key={c.id}>
            <div className="gcb-field-header">
              {c.name} <span className="gcb-field-time">{c.minutes} min</span>
            </div>
            <textarea
              className="gcb-textarea"
              value={c.goal}
              onChange={(e) => updateCat(c.id, { goal: e.target.value })}
              placeholder="Fixa så att jag …"
              rows={2}
            />
          </div>
        ))}
      </>
    )
  }

  function renderStage2() {
    return (
      <>
        <p className="gcb-stage-desc">
          How will you prove you completed each category?
        </p>
        {categories.map((c) => (
          <div className="gcb-field-card" key={c.id}>
            <div className="gcb-field-header">
              {c.name} <span className="gcb-field-time">{c.minutes} min</span>
            </div>
            <p className="gcb-field-goal">{c.goal}</p>
            <textarea
              className="gcb-textarea"
              value={c.proof}
              onChange={(e) => updateCat(c.id, { proof: e.target.value })}
              placeholder="Proof att jag gjorde det jag sa …"
              rows={2}
            />
          </div>
        ))}
      </>
    )
  }

  function renderStage3() {
    return (
      <>
        <p className="gcb-stage-desc">
          Add steps for each category. Use <code>step name 5</code> for minutes.
          Press <kbd>Enter</kbd> to add a step.
        </p>
        {categories.map((c) => (
          <div className="gcb-field-card" key={c.id}>
            <div className="gcb-field-header">
              {c.name} <span className="gcb-field-time">{c.minutes} min</span>
            </div>
            <p className="gcb-field-goal">{c.goal}</p>
            <div className="gcb-step-list">
              {c.steps.map((step, idx) => {
                const parsed = parseStepRaw(step.raw)
                return (
                  <div className="gcb-step-row" key={step.id}>
                    <span className="gcb-step-num">{idx + 1}</span>
                    <input
                      ref={(el) => {
                        if (el) stepRefs.current[step.id] = el
                      }}
                      className="gcb-step-input"
                      value={step.raw}
                      onChange={(e) =>
                        updateStep(c.id, step.id, e.target.value)
                      }
                      onKeyDown={(e) => handleStepKeyDown(e, c.id, step.id)}
                      onPaste={(e) => handleStepPaste(e, c.id, step.id)}
                      placeholder="Step name 5"
                    />
                    {parsed.minutes > 0 && (
                      <span className="task-step-time-badge">
                        {parsed.minutes}m
                      </span>
                    )}
                    <button
                      type="button"
                      className="gcb-remove-btn"
                      onClick={() => removeStep(c.id, step.id)}
                      title="Remove step"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </>
    )
  }

  function renderStage4() {
    return (
      <>
        <p className="gcb-stage-desc">
          Review your categories, then load them as tasks.
        </p>
        {categories.map((c) => {
          const validSteps = c.steps.filter((s) => s.raw.trim())
          const totalMins = validSteps.reduce(
            (sum, s) => sum + (parseStepRaw(s.raw).minutes || 0),
            0,
          )
          return (
            <div className="gcb-summary-card" key={c.id}>
              <div className="gcb-summary-header">
                <strong>{c.name}</strong>
                <span className="gcb-field-time">{c.minutes} min cap</span>
              </div>
              <p className="gcb-summary-goal">
                <strong>Goal:</strong> {c.goal}
              </p>
              <p className="gcb-summary-proof">
                <strong>Proof:</strong> {c.proof}
              </p>
              <p className="gcb-summary-steps-title">
                Steps ({validSteps.length})
                {totalMins > 0 && ` · ${totalMins} min total`}
              </p>
              <ol className="gcb-summary-steps">
                {validSteps.map((s) => {
                  const p = parseStepRaw(s.raw)
                  return (
                    <li key={s.id}>
                      {p.text}
                      {p.minutes > 0 && (
                        <span className="task-step-time-badge">
                          {p.minutes}m
                        </span>
                      )}
                    </li>
                  )
                })}
              </ol>
            </div>
          )
        })}
      </>
    )
  }

  const stageRenderers = [
    renderStage0,
    renderStage1,
    renderStage2,
    renderStage3,
    renderStage4,
  ]

  if (!open) {
    return (
      <section className="task-builder-card gcb-collapsed">
        <button
          type="button"
          className="gcb-toggle-btn"
          onClick={() => setOpen(true)}
        >
          Guided Category Builder
          <span className="gcb-toggle-arrow">▸</span>
        </button>
      </section>
    )
  }

  return (
    <section
      className="task-builder-card gcb"
      aria-label="Guided Category Builder"
    >
      <button
        type="button"
        className="gcb-toggle-btn gcb-toggle-btn--open"
        onClick={() => setOpen(false)}
      >
        Guided Category Builder
        <span className="gcb-toggle-arrow">▾</span>
      </button>

      {/* Stage indicator */}
      <div className="gcb-stages">
        {STAGES.map((label, i) => (
          <div
            key={label}
            className={`gcb-stage-dot ${i === stage ? "gcb-stage-dot--active" : ""} ${i < stage ? "gcb-stage-dot--done" : ""}`}
          >
            <span className="gcb-stage-dot-num">{i < stage ? "✓" : i + 1}</span>
            <span className="gcb-stage-dot-label">{label}</span>
          </div>
        ))}
      </div>

      {/* Stage content */}
      <div className="gcb-content">{stageRenderers[stage]()}</div>

      {/* Error */}
      {error && <p className="gcb-error">{error}</p>}

      {/* Navigation */}
      <div className="gcb-nav">
        {stage > 0 && (
          <button type="button" className="gcb-nav-btn" onClick={back}>
            ← Back
          </button>
        )}
        {stage < STAGES.length - 1 && (
          <button
            type="button"
            className="gcb-nav-btn gcb-nav-btn--next"
            onClick={next}
          >
            Next →
          </button>
        )}
        {stage === STAGES.length - 1 && (
          <button
            type="button"
            className="task-builder-load-btn"
            onClick={loadAll}
          >
            Load All ({categories.length})
          </button>
        )}
      </div>

      {loadMsg && <p className="task-builder-load-message">{loadMsg}</p>}
    </section>
  )
}
