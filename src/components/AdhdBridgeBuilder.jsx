import { useMemo, useState } from "react"
import { useMainTask } from "../context/MainTaskContext"
import { genStepId, parseStepRaw, formatStepRaw } from "../utils/stepUtils"

const STAGES = ["Area", "Current", "Better", "Proof", "Steps"]

function makeStep() {
  return { id: genStepId(), text: "", minutes: 0 }
}

function parsePositiveInt(value, fallback = 0) {
  const num = parseInt(String(value || "").trim(), 10)
  if (!Number.isFinite(num) || num <= 0) return fallback
  return num
}

export default function AdhdBridgeBuilder() {
  const { addMainTask } = useMainTask()

  const [stage, setStage] = useState(0)
  const [area, setArea] = useState("")
  const [maxMinutes, setMaxMinutes] = useState("5")
  const [currentState, setCurrentState] = useState("")
  const [betterState, setBetterState] = useState("")
  const [proof, setProof] = useState("")
  const [steps, setSteps] = useState([makeStep()])
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const plannedTotal = useMemo(() => {
    return steps.reduce((sum, step) => sum + (step.minutes || 0), 0)
  }, [steps])

  const maxTotal = parsePositiveInt(maxMinutes, 0)
  const overBudget = maxTotal > 0 && plannedTotal > maxTotal

  function resetForm() {
    setStage(0)
    setArea("")
    setMaxMinutes("5")
    setCurrentState("")
    setBetterState("")
    setProof("")
    setSteps([makeStep()])
    setError("")
  }

  function updateStepText(id, text) {
    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== id) return step
        return { ...step, text }
      }),
    )
  }

  function updateStepMinutes(id, minutes) {
    const normalizedMinutes = parsePositiveInt(minutes, 0)
    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== id) return step
        return { ...step, minutes: normalizedMinutes }
      }),
    )
  }

  function addStep() {
    setSteps((prev) => [...prev, makeStep()])
  }

  function removeStep(id) {
    setSteps((prev) => {
      const next = prev.filter((step) => step.id !== id)
      return next.length ? next : [makeStep()]
    })
  }

  function validateStage(index = stage) {
    if (index === 0) {
      if (!area.trim()) {
        return "Please pick one area to focus on."
      }
      if (!parsePositiveInt(maxMinutes, 0)) {
        return "Please set a positive max time in minutes."
      }
    }
    if (index === 1 && !currentState.trim()) {
      return "Please describe the current state."
    }
    if (index === 2 && !betterState.trim()) {
      return "Please describe what better looks like."
    }
    if (index === 3 && !proof.trim()) {
      return "Please describe the proof for improved."
    }
    if (index === 4) {
      const valid = steps.filter((step) => step.text.trim().length > 0)
      if (!valid.length) {
        return "Add at least one specific small step."
      }
      if (valid.some((step) => step.minutes <= 0)) {
        return "Each step needs a positive minute value."
      }
    }
    return ""
  }

  function goNext() {
    const err = validateStage(stage)
    if (err) {
      setError(err)
      return
    }
    setError("")
    setStage((prev) => Math.min(prev + 1, STAGES.length - 1))
  }

  function goBack() {
    setError("")
    setStage((prev) => Math.max(prev - 1, 0))
  }

  function handleLoadIntoList() {
    const err = validateStage(4)
    if (err) {
      setError(err)
      return
    }

    const validSteps = steps
      .filter((step) => step.text.trim().length > 0)
      .map((step) => ({
        raw: formatStepRaw(step.text, step.minutes),
      }))

    addMainTask({
      title: `${area.trim()}: ${betterState.trim()}`,
      steps: validSteps,
      proof: proof.trim(),
      priority: "",
    })

    setMessage("Loaded into task list ✓")
    setTimeout(() => setMessage(""), 2200)
    resetForm()
  }

  return (
    <section className="adhd-bridge-card" aria-label="ADHD bridge builder">
      <p className="hero-kicker">New ADHD Guided Card</p>
      <h2 className="adhd-bridge-title">Current -> Better -> Proof -> Tiny Steps</h2>
      <p className="adhd-bridge-help">
        Concrete, low-pressure, and action-first. Build a small bridge from how
        it is now to what would be a little better.
      </p>

      <div className="adhd-bridge-stages" aria-hidden="true">
        {STAGES.map((name, i) => (
          <div
            key={name}
            className={`adhd-bridge-stage-dot ${i === stage ? "adhd-bridge-stage-dot--active" : ""} ${i < stage ? "adhd-bridge-stage-dot--done" : ""}`}
          >
            <span className="adhd-bridge-stage-dot-num">{i + 1}</span>
            <span className="adhd-bridge-stage-dot-label">{name}</span>
          </div>
        ))}
      </div>

      <div className="adhd-bridge-content">
        {stage === 0 && (
          <>
            <label className="adhd-bridge-label" htmlFor="adhd-bridge-area">
              What area would make life easier if I improved it a little right now?
            </label>
            <p className="adhd-bridge-helper">Pick one area, not your whole life.</p>
            <p className="adhd-bridge-helper">Small improvement is enough.</p>
            <input
              id="adhd-bridge-area"
              className="adhd-bridge-input"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="kitchen"
            />

            <label className="adhd-bridge-label" htmlFor="adhd-bridge-max-time">
              Max time I want to spend on this right now
            </label>
            <p className="adhd-bridge-helper">This is the total time budget for this area.</p>
            <p className="adhd-bridge-helper">All steps together should fit inside this.</p>
            <input
              id="adhd-bridge-max-time"
              className="adhd-bridge-input adhd-bridge-input--minutes"
              type="number"
              min="1"
              value={maxMinutes}
              onChange={(e) => setMaxMinutes(e.target.value)}
            />
          </>
        )}

        {stage === 1 && (
          <>
            <label className="adhd-bridge-label" htmlFor="adhd-bridge-current-state">
              What is the current state right now?
            </label>
            <p className="adhd-bridge-helper">Describe how it is now.</p>
            <p className="adhd-bridge-helper">Keep it concrete.</p>
            <ul className="adhd-bridge-examples">
              <li>messy kitchen</li>
              <li>blank school document</li>
              <li>clothes on the floor</li>
              <li>cluttered desk</li>
            </ul>
            <textarea
              id="adhd-bridge-current-state"
              className="adhd-bridge-input adhd-bridge-textarea"
              rows={3}
              value={currentState}
              onChange={(e) => setCurrentState(e.target.value)}
              placeholder="messy kitchen"
            />
          </>
        )}

        {stage === 2 && (
          <>
            <label className="adhd-bridge-label" htmlFor="adhd-bridge-better-state">
              What would better look like after this?
            </label>
            <p className="adhd-bridge-helper">Not perfect. Just better.</p>
            <p className="adhd-bridge-helper">What would count as an improvement here?</p>
            <ul className="adhd-bridge-examples">
              <li>cleaner kitchen</li>
              <li>one paragraph written</li>
              <li>floor visible</li>
              <li>desk clearer</li>
            </ul>
            <textarea
              id="adhd-bridge-better-state"
              className="adhd-bridge-input adhd-bridge-textarea"
              rows={3}
              value={betterState}
              onChange={(e) => setBetterState(e.target.value)}
              placeholder="cleaner kitchen"
            />
          </>
        )}

        {stage === 3 && (
          <>
            <label className="adhd-bridge-label" htmlFor="adhd-bridge-proof">
              How will I know this improved?
            </label>
            <p className="adhd-bridge-helper">What will be true when this is done enough?</p>
            <p className="adhd-bridge-helper">Use visible proof.</p>
            <ul className="adhd-bridge-examples">
              <li>counter is clear</li>
              <li>dirty plates are gone</li>
              <li>one paragraph exists</li>
              <li>floor is visible</li>
            </ul>
            <textarea
              id="adhd-bridge-proof"
              className="adhd-bridge-input adhd-bridge-textarea"
              rows={3}
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              placeholder="counter is clear, dirty plates are gone"
            />
          </>
        )}

        {stage === 4 && (
          <>
            <div className="adhd-bridge-summary">
              <p><strong>Current state:</strong> {currentState || "-"}</p>
              <p><strong>Better state:</strong> {betterState || "-"}</p>
              <p><strong>Proof:</strong> {proof || "-"}</p>
            </div>

            <label className="adhd-bridge-label" htmlFor="adhd-bridge-step-0">
              What specific small steps would go from the current state to the goal?
            </label>
            <p className="adhd-bridge-helper">
              Write the tiny actions between how it is now and how you want it to be.
            </p>
            <p className="adhd-bridge-helper">Keep them small and realistic.</p>
            <p className="adhd-bridge-helper">All step times together should fit inside your max time.</p>
            <p className="adhd-bridge-helper">Make the next physical action obvious.</p>
            <p className="adhd-bridge-helper">Smaller is better.</p>
            <p className="adhd-bridge-helper">You can add super small steps.</p>

            <div className="adhd-bridge-steps">
              {steps.map((step, idx) => {
                return (
                  <div className="adhd-bridge-step-row" key={step.id}>
                    <span className="adhd-bridge-step-index">{idx + 1}</span>
                    <input
                      id={`adhd-bridge-step-${idx}`}
                      className="adhd-bridge-input"
                      value={step.text}
                      onChange={(e) => updateStepText(step.id, e.target.value)}
                      placeholder="move dirty plates"
                    />
                    <input
                      className="adhd-bridge-input adhd-bridge-input--minutes"
                      type="number"
                      min="1"
                      value={step.minutes || ""}
                      onChange={(e) => updateStepMinutes(step.id, e.target.value)}
                      placeholder="2"
                    />
                    <button
                      type="button"
                      className="adhd-bridge-remove-btn"
                      onClick={() => removeStep(step.id)}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>

            <button type="button" className="adhd-bridge-add-btn" onClick={addStep}>
              + Add tiny step
            </button>

            <div className={`adhd-bridge-budget ${overBudget ? "adhd-bridge-budget--over" : "adhd-bridge-budget--ok"}`}>
              <span className="adhd-bridge-budget-label">Planned steps total</span>
              <strong>
                {plannedTotal} / {maxTotal || 0} min
              </strong>
            </div>

            {overBudget && (
              <p className="adhd-bridge-budget-warning">
                This plan is longer than your max time for this area.
              </p>
            )}
          </>
        )}

        {error && <p className="adhd-bridge-error">{error}</p>}
        {message && <p className="adhd-bridge-success">{message}</p>}
      </div>

      <div className="adhd-bridge-nav">
        <button
          type="button"
          className="adhd-bridge-nav-btn"
          onClick={goBack}
          disabled={stage === 0}
        >
          Back
        </button>

        {stage < STAGES.length - 1 ? (
          <button type="button" className="adhd-bridge-nav-btn adhd-bridge-nav-btn--next" onClick={goNext}>
            Next
          </button>
        ) : (
          <button
            type="button"
            className="adhd-bridge-nav-btn adhd-bridge-nav-btn--next"
            onClick={handleLoadIntoList}
          >
            Load into list
          </button>
        )}
      </div>
    </section>
  )
}
