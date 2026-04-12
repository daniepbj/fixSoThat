import { useState, useRef, useContext } from "react"
import { useMainTask } from "../context/MainTaskContext"
import { useLocalStorage } from "../hooks/useLocalStorage"
import { genStepId, parseStepRaw } from "../utils/stepUtils"
import { TimerContext } from "../context/TimerContext"

const MAX_CATEGORIES = 5
const STAGES = ["Areas", "Goals", "Proof", "Steps", "Review"]
const TIME_CHIPS = [3, 5, 10]
const PLACEHOLDERS = ["cleaning", "school project", "website", "kitchen", "essay"]

function makeCat() {
  return {
    id: genStepId(),
    name: "",
    minutes: "5",
    chipValue: "5",
    goal: "",
    proof: "",
    steps: [{ id: genStepId(), raw: "" }],
  }
}

function ContextBar({ categories, stage }) {
  if (stage < 1) return null
  return (
    <div className="gcb-context-bar">
      {categories.map((c) => (
        <span key={c.id} className="gcb-context-chip">
          {c.name || "…"}
          <span className="gcb-context-chip-time">·{c.minutes}m</span>
        </span>
      ))}
    </div>
  )
}

export default function GuidedCategoryBuilder() {
  const { addMainTask } = useMainTask()
  const timerCtx = useContext(TimerContext)
  const timerRunning = timerCtx?.timerRunning ?? false

  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState(0)
  const [categories, setCategories] = useState([makeCat()])
  const [error, setError] = useState("")
  const [loadMsg, setLoadMsg] = useState("")
  const [builderVisualStyle, setBuilderVisualStyle] = useLocalStorage(
    "fst_builder_visual_style",
    "calm",
  )
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
        if (!c.name.trim()) return "Every area needs a name."
        const mins = parseInt(c.minutes, 10)
        if (!mins || mins <= 0)
          return `"${c.name}" needs a positive time cap.`
      }
    }
    if (stage === 1) {
      for (const c of categories) {
        if (!c.goal.trim()) return `"${c.name}" needs a goal.`
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
    setStage(0)
    setCategories([makeCat()])
    setError("")
  }

  // ── render stages ──

  function renderStage0() {
    return (
      <div className="gcb-cat-list">
        {categories.map((c, i) => (
          <div className="gcb-cat-card" key={c.id}>
            <button
              type="button"
              className="gcb-card-remove"
              onClick={() => removeCat(c.id)}
              aria-label="Remove area"
            >
              ×
            </button>
            <label className="gcb-cat-prompt" htmlFor={`gcb-name-${c.id}`}>
              {i === 0
                ? "What do I want to work on right now?"
                : "Another area?"}
            </label>
            <span className="gcb-cat-helper">One area. Small is enough.</span>
            <input
              id={`gcb-name-${c.id}`}
              className="gcb-input gcb-input--name"
              value={c.name}
              onChange={(e) => updateCat(c.id, { name: e.target.value })}
              placeholder={PLACEHOLDERS[i % PLACEHOLDERS.length]}
              aria-required="true"
            />
            <fieldset className="gcb-time-chips">
              <legend className="gcb-time-chips-legend">Time cap</legend>
              {TIME_CHIPS.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  className={`gcb-time-chip${c.chipValue === String(mins) ? " gcb-time-chip--selected" : ""}`}
                  aria-pressed={c.chipValue === String(mins)}
                  onClick={() =>
                    updateCat(c.id, {
                      chipValue: String(mins),
                      minutes: String(mins),
                    })
                  }
                >
                  {mins}m
                </button>
              ))}
              <button
                type="button"
                className={`gcb-time-chip${c.chipValue === "custom" ? " gcb-time-chip--selected" : ""}`}
                aria-pressed={c.chipValue === "custom"}
                onClick={() => updateCat(c.id, { chipValue: "custom" })}
              >
                Custom
              </button>
              {c.chipValue === "custom" && (
                <input
                  className="gcb-input gcb-input--mins"
                  type="number"
                  min="1"
                  value={c.minutes}
                  onChange={(e) =>
                    updateCat(c.id, { minutes: e.target.value })
                  }
                  placeholder="min"
                  aria-label="Custom minutes"
                />
              )}
            </fieldset>
          </div>
        ))}
        {categories.length < MAX_CATEGORIES && (
          <button type="button" className="gcb-add-btn" onClick={addCat}>
            + Add another area
          </button>
        )}
      </div>
    )
  }

  function renderStage1() {
    return (
      <div className="gcb-field-list">
        {categories.map((c) => (
          <div className="gcb-field-card" key={c.id}>
            <div className="gcb-field-header">
              {c.name} <span className="gcb-field-time">{c.minutes}m</span>
            </div>
            <label className="gcb-field-prompt" htmlFor={`gcb-goal-${c.id}`}>
              What would count as good enough?
            </label>
            <span className="gcb-field-hint">Short. One sentence max.</span>
            <textarea
              id={`gcb-goal-${c.id}`}
              className="gcb-textarea"
              value={c.goal}
              onChange={(e) => updateCat(c.id, { goal: e.target.value })}
              placeholder="Fixa så att jag …"
              rows={2}
            />
          </div>
        ))}
      </div>
    )
  }

  function renderStage2() {
    return (
      <div className="gcb-field-list">
        {categories.map((c) => (
          <div className="gcb-field-card" key={c.id}>
            <div className="gcb-field-header">
              {c.name} <span className="gcb-field-time">{c.minutes}m</span>
            </div>
            <p className="gcb-field-goal">{c.goal}</p>
            <label className="gcb-field-prompt" htmlFor={`gcb-proof-${c.id}`}>
              How will I know it&rsquo;s done enough?
            </label>
            <span className="gcb-field-hint">
              Something I can see or check off.
            </span>
            <textarea
              id={`gcb-proof-${c.id}`}
              className="gcb-textarea"
              value={c.proof}
              onChange={(e) => updateCat(c.id, { proof: e.target.value })}
              placeholder="Proof att jag gjorde det jag sa …"
              rows={2}
            />
          </div>
        ))}
      </div>
    )
  }

  function renderStage3() {
    return (
      <div className="gcb-field-list">
        <p className="gcb-stage-desc">
          What tiny steps come first?
          <span className="gcb-stage-hint">
            {" "}
            · end a step with a number for minutes, e.g.{" "}
            <code>dishes 5</code>
          </span>
        </p>
        {categories.map((c) => (
          <div className="gcb-field-card" key={c.id}>
            <div className="gcb-field-header">
              {c.name} <span className="gcb-field-time">{c.minutes}m</span>
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
                      placeholder="e.g. stack dishes 5"
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
      </div>
    )
  }

  function renderStage4() {
    return (
      <>
        <p className="gcb-stage-desc">Ready to go?</p>
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
                <span className="gcb-field-time">{c.minutes}m cap</span>
              </div>
              <p className="gcb-summary-goal">
                <strong>Goal:</strong> {c.goal}
              </p>
              <p className="gcb-summary-proof">
                <strong>Proof:</strong> {c.proof}
              </p>
              <p className="gcb-summary-steps-title">
                Steps ({validSteps.length})
                {totalMins > 0 && ` · ${totalMins}m total`}
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

  const styleClass =
    builderVisualStyle === "minimal"
      ? "gcb--minimal"
      : builderVisualStyle === "match"
        ? "gcb--match"
        : "gcb--calm"

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
      className={`task-builder-card gcb ${styleClass}`}
      aria-label="Guided Category Builder"
    >
      {/* Header row: title + style toggle */}
      <div className="gcb-header-row">
        <button
          type="button"
          className="gcb-toggle-btn gcb-toggle-btn--open"
          onClick={() => setOpen(false)}
        >
          Guided Category Builder
          <span className="gcb-toggle-arrow">▾</span>
        </button>
        <div className="gcb-style-toggle" role="group" aria-label="Card style">
          <button
            type="button"
            className={`gcb-style-btn${builderVisualStyle === "calm" ? " gcb-style-btn--active" : ""}`}
            aria-pressed={builderVisualStyle === "calm"}
            title="Calm motion"
            onClick={() => setBuilderVisualStyle("calm")}
          >
            🌊
          </button>
          <button
            type="button"
            className={`gcb-style-btn${builderVisualStyle === "minimal" ? " gcb-style-btn--active" : ""}`}
            aria-pressed={builderVisualStyle === "minimal"}
            title="Minimal"
            onClick={() => setBuilderVisualStyle("minimal")}
          >
            ○
          </button>
          <button
            type="button"
            className={`gcb-style-btn${builderVisualStyle === "match" ? " gcb-style-btn--active" : ""}`}
            aria-pressed={builderVisualStyle === "match"}
            title="Match main style"
            onClick={() => setBuilderVisualStyle("match")}
          >
            ✦
          </button>
        </div>
      </div>

      {/* Timer badge */}
      {timerRunning && (
        <div className="gcb-timer-badge">
          <span className="gcb-timer-badge-dot" aria-hidden="true" />
          Running under timer
        </div>
      )}

      {/* Stage indicator */}
      <div className="gcb-stages">
        {STAGES.map((label, i) => (
          <div
            key={label}
            className={[
              "gcb-stage-dot",
              i === stage ? "gcb-stage-dot--active" : "",
              i < stage ? "gcb-stage-dot--done" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="gcb-stage-dot-num">
              {i < stage ? "✓" : i + 1}
            </span>
            <span className="gcb-stage-dot-label">{label}</span>
          </div>
        ))}
      </div>

      {/* Context bar (stage 1+) */}
      <ContextBar categories={categories} stage={stage} />

      {/* Stage content */}
      <div className="gcb-content">{stageRenderers[stage]()}</div>

      {/* Error */}
      {error && (
        <p className="gcb-error" role="alert" aria-live="assertive">
          {error}
        </p>
      )}

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
            Load and Start → ({categories.length})
          </button>
        )}
      </div>

      {loadMsg && <p className="task-builder-load-message">{loadMsg}</p>}
    </section>
  )
}
