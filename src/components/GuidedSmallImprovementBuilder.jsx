import { useMemo, useState } from "react"
import { useMainTask } from "../context/MainTaskContext"
import { genStepId, formatStepRaw } from "../utils/stepUtils"

const STAGES = ["Area", "Target", "Proof", "Brainstorm", "Order", "Save"]

function genProofId() {
  return `proof-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function makeStep() {
  return { id: genStepId(), text: "", minutes: 0 }
}

function makeProof() {
  return { id: genProofId(), text: "" }
}

function parsePositiveInt(value, fallback = 0) {
  const num = parseInt(String(value || "").trim(), 10)
  if (!Number.isFinite(num) || num <= 0) return fallback
  return num
}

function inferAreaExamples(area) {
  const normalizedArea = area.trim().toLowerCase()

  if (
    normalizedArea.includes("essay") ||
    normalizedArea.includes("writing") ||
    normalizedArea.includes("paper")
  ) {
    return {
      now: [
        "blank document",
        "only the title is written",
        "notes are open but no paragraph exists",
      ],
      target: [
        "one rough paragraph drafted",
        "an outline with the intro started",
        "the next section has a messy first pass",
      ],
      proof: [
        "there is one real paragraph on the page",
        "the document has an outline plus a draft section",
        "I can point to text instead of just notes",
      ],
      steps: [
        "open the essay document",
        "turn notes into a 3-bullet outline",
        "draft the first rough paragraph",
      ],
    }
  }

  if (
    normalizedArea.includes("kitchen") ||
    normalizedArea.includes("dishes") ||
    normalizedArea.includes("clean")
  ) {
    return {
      now: [
        "dirty dishes are stacked up",
        "the counter is covered",
        "there are a few things out in different spots",
      ],
      target: [
        "the counter is usable",
        "the sink is mostly cleared",
        "the obvious mess is gone",
      ],
      proof: [
        "the counter is wiped",
        "dirty dishes are no longer piled up",
        "there is one clear work surface",
      ],
      steps: [
        "throw away visible trash",
        "stack dishes by the sink",
        "wipe one section of counter",
      ],
    }
  }

  if (normalizedArea.includes("email") || normalizedArea.includes("inbox")) {
    return {
      now: [
        "the inbox feels overloaded",
        "important messages are mixed with noise",
        "I keep avoiding opening it",
      ],
      target: [
        "the urgent emails are handled",
        "the inbox is sorted into a few clear groups",
        "the top priority replies are sent",
      ],
      proof: [
        "the urgent emails are answered",
        "the inbox has fewer open decisions",
        "the messages I was avoiding are no longer unread",
      ],
      steps: [
        "open the inbox",
        "star the urgent messages",
        "reply to the first important email",
      ],
    }
  }

  return {
    now: [
      `I keep avoiding ${area}`,
      `${area} feels stuck`,
      `I started ${area} but have not moved it forward`,
    ],
    target: [
      `${area} is in a better spot than before`,
      `there is one clear piece of progress in ${area}`,
      `${area} feels easier to continue later`,
    ],
    proof: [
      `I can point to one visible sign that ${area} moved forward`,
      `there is something concrete done in ${area}`,
      `${area} is easier to pick up next time`,
    ],
    steps: [
      `open what you need for ${area}`,
      `do the first obvious action for ${area}`,
      `leave ${area} easier to continue later`,
    ],
  }
}

function StageSummary({ lines }) {
  return (
    <div className="gsi-stage-compact-summary">
      {lines.map(({ label, value }) => (
        <div className="gsi-summary-line" key={label}>
          <strong>{label}:</strong> <span>{value}</span>
        </div>
      ))}
    </div>
  )
}

function ExampleList({ title, examples }) {
  return (
    <div className="gsi-example-block">
      <span className="gsi-example-title">{title}</span>
      <ul className="gsi-example-list">
        {examples.map((example) => (
          <li key={example}>{example}</li>
        ))}
      </ul>
    </div>
  )
}

export default function GuidedSmallImprovementBuilder() {
  const { addMainTask } = useMainTask()

  const [stage, setStage] = useState(0)
  const [area, setArea] = useState("")
  const [maxMinutes, setMaxMinutes] = useState("5")
  const [now, setNow] = useState("")
  const [goodEnough, setGoodEnough] = useState("")
  const [proofs, setProofs] = useState([makeProof()])
  const [steps, setSteps] = useState([makeStep()])
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const plannedTotal = useMemo(() => {
    return steps.reduce((sum, step) => sum + (step.minutes || 0), 0)
  }, [steps])

  const trimmedArea = area.trim()
  const areaLabel = trimmedArea || "this area"
  const areaExamples = useMemo(
    () => inferAreaExamples(trimmedArea || "this area"),
    [trimmedArea],
  )

  const maxTotal = parsePositiveInt(maxMinutes, 0)
  const overBudget = maxTotal > 0 && plannedTotal > maxTotal
  const validProofs = proofs.filter((p) => p.text.trim().length > 0)

  function resetForm() {
    setStage(0)
    setArea("")
    setMaxMinutes("5")
    setNow("")
    setGoodEnough("")
    setProofs([makeProof()])
    setSteps([makeStep()])
    setError("")
    setMessage("")
  }

  // Proof management
  function updateProofText(id, text) {
    setProofs((prev) =>
      prev.map((proof) => (proof.id === id ? { ...proof, text } : proof)),
    )
  }

  function removeProof(id) {
    setProofs((prev) => {
      const next = prev.filter((proof) => proof.id !== id)
      return next.length ? next : [makeProof()]
    })
  }

  function addProof() {
    setProofs((prev) => [...prev, makeProof()])
  }

  // Step management
  function updateStepText(id, text) {
    setSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, text } : step)),
    )
  }

  function updateStepMinutes(id, minutes) {
    const normalizedMinutes = parsePositiveInt(minutes, 0)
    setSteps((prev) =>
      prev.map((step) =>
        step.id === id ? { ...step, minutes: normalizedMinutes } : step,
      ),
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

  function moveStepUp(id) {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id)
      if (idx <= 0) return prev
      const next = [...prev]
      ;[next[idx], next[idx - 1]] = [next[idx - 1], next[idx]]
      return next
    })
  }

  function moveStepDown(id) {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id)
      if (idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  // Validation
  function validateStage(index = stage) {
    if (index === 0) {
      if (!area.trim()) {
        return "Pick an area."
      }
      if (!parsePositiveInt(maxMinutes, 0)) {
        return "Set a positive max time."
      }
    }
    if (index === 1) {
      if (!now.trim()) {
        return "Describe the current state."
      }
      if (!goodEnough.trim()) {
        return "Describe the target state."
      }
    }
    if (index === 2) {
      if (!validProofs.length) {
        return "Add at least one proof checkpoint."
      }
    }
    if (index === 3) {
      const validSteps = steps.filter((s) => s.text.trim().length > 0)
      if (!validSteps.length) {
        return "Add at least one step."
      }
    }
    if (index === 4) {
      const validSteps = steps.filter((s) => s.text.trim().length > 0)
      if (!validSteps.length) {
        return "You have no steps."
      }
      if (validSteps.some((s) => s.minutes <= 0)) {
        return "Each step needs a time in minutes."
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

  function handleSaveToList() {
    const err = validateStage(4)
    if (err) {
      setError(err)
      return
    }

    const validStepsArray = steps
      .filter((s) => s.text.trim().length > 0)
      .map((s) => ({
        raw: formatStepRaw(s.text, s.minutes),
      }))

    const proofText = validProofs.map((p) => p.text.trim()).join("\n")

    addMainTask({
      title: `${area.trim()}: ${goodEnough.trim()}`,
      steps: validStepsArray,
      proof: proofText,
      priority: "",
    })

    setMessage("Saved to task list ✓")
    setTimeout(() => setMessage(""), 2200)
    resetForm()
  }

  return (
    <section className="gsi-card" aria-label="Guided small improvement builder">
      <div className="gsi-header">
        <p className="gsi-hero-kicker">Experimental Builder</p>
        <h2 className="gsi-title">Build a small improvement</h2>
      </div>

      <div className="gsi-progress-bar">
        {STAGES.map((name, i) => (
          <div
            key={name}
            className={`gsi-progress-dot ${i === stage ? "gsi-progress-dot--active" : ""} ${i < stage ? "gsi-progress-dot--done" : ""}`}
          >
            <span className="gsi-progress-num">{i + 1}</span>
            <span className="gsi-progress-label">{name}</span>
          </div>
        ))}
      </div>

      <div className="gsi-content">
        {/* STAGE 0: Area + Time */}
        {stage === 0 && (
          <div className="gsi-stage">
            <div className="gsi-stage-body">
              <label className="gsi-label" htmlFor="gsi-area">
                What area would make life easier if I improved it a little right
                now?
              </label>
              <p className="gsi-hint">Pick one area, not your whole life.</p>
              <input
                id="gsi-area"
                className="gsi-input"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="kitchen"
              />

              <label
                className="gsi-label gsi-label--top"
                htmlFor="gsi-max-time"
              >
                Max time I want to spend on this
              </label>
              <div className="gsi-time-input-wrapper">
                <input
                  id="gsi-max-time"
                  className="gsi-input gsi-input--number"
                  type="number"
                  min="1"
                  value={maxMinutes}
                  onChange={(e) => setMaxMinutes(e.target.value)}
                />
                <span className="gsi-time-unit">min</span>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 1: Now + Good Enough */}
        {stage === 1 && (
          <div className="gsi-stage">
            <StageSummary
              lines={[
                { label: "Area", value: areaLabel },
                { label: "Time", value: `${maxTotal || 0} min max` },
              ]}
            />

            <div className="gsi-stage-body">
              <div className="gsi-two-field-pair">
                <div>
                  <label className="gsi-label" htmlFor="gsi-now">
                    What is the current state of {areaLabel} right now?
                  </label>
                  <p className="gsi-hint">
                    Keep it tied to {areaLabel}, not a different area.
                  </p>
                  <textarea
                    id="gsi-now"
                    className="gsi-input gsi-textarea"
                    rows={2}
                    value={now}
                    onChange={(e) => setNow(e.target.value)}
                    placeholder={`What feels stuck about ${areaLabel}?`}
                  />
                  <ExampleList title="Examples" examples={areaExamples.now} />
                </div>

                <div>
                  <label className="gsi-label" htmlFor="gsi-good-enough">
                    What would be good enough for {areaLabel} right now?
                  </label>
                  <p className="gsi-hint">
                    Not perfect. Just better for {areaLabel}.
                  </p>
                  <textarea
                    id="gsi-good-enough"
                    className="gsi-input gsi-textarea"
                    rows={2}
                    value={goodEnough}
                    onChange={(e) => setGoodEnough(e.target.value)}
                    placeholder={`What would make ${areaLabel} feel meaningfully better?`}
                  />
                  <ExampleList
                    title="Examples"
                    examples={areaExamples.target}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 2: Proof Checkpoints */}
        {stage === 2 && (
          <div className="gsi-stage">
            <StageSummary
              lines={[
                { label: "Area", value: areaLabel },
                { label: "Now", value: now || "Not filled in yet" },
                { label: "Target", value: goodEnough || "Not filled in yet" },
              ]}
            />

            <div className="gsi-stage-body">
              <label className="gsi-label" htmlFor="gsi-proof-0">
                How will I know {areaLabel} reached good enough?
              </label>
              <p className="gsi-hint">
                Add proof one checkpoint at a time so you can see progress in{" "}
                {areaLabel}.
              </p>
              <ExampleList title="Examples" examples={areaExamples.proof} />

              <div className="gsi-proof-rows">
                {proofs.map((proof) => (
                  <div className="gsi-proof-row" key={proof.id}>
                    <input
                      className="gsi-input gsi-proof-input"
                      type="text"
                      value={proof.text}
                      onChange={(e) =>
                        updateProofText(proof.id, e.target.value)
                      }
                      placeholder={`One visible sign that ${areaLabel} moved forward`}
                    />
                    <button
                      type="button"
                      className="gsi-proof-remove-btn"
                      onClick={() => removeProof(proof.id)}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="gsi-add-proof-btn"
                onClick={addProof}
              >
                + Add another
              </button>
            </div>
          </div>
        )}

        {/* STAGE 3: Brainstorm Steps */}
        {stage === 3 && (
          <div className="gsi-stage">
            <StageSummary
              lines={[
                { label: "Area", value: areaLabel },
                { label: "Now", value: now || "Not filled in yet" },
                { label: "Target", value: goodEnough || "Not filled in yet" },
              ]}
            />

            {validProofs.length > 0 && (
              <div className="gsi-stage-compact-proof">
                <strong>Proof:</strong>
                <ul className="gsi-proof-list">
                  {validProofs.map((p) => (
                    <li key={p.id}>{p.text}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="gsi-stage-body">
              <label className="gsi-label" htmlFor="gsi-step-0">
                What tiny steps might help move {areaLabel} forward?
              </label>
              <p className="gsi-hint">
                Brainstorm fast. Keep the steps clearly about {areaLabel}. Order
                them next.
              </p>
              <ExampleList
                title="Step examples"
                examples={areaExamples.steps}
              />

              <div className="gsi-step-rows gsi-step-rows--brainstorm">
                {steps.map((step) => (
                  <div
                    className="gsi-step-row gsi-step-row--brainstorm"
                    key={step.id}
                  >
                    <input
                      className="gsi-input gsi-step-input"
                      type="text"
                      value={step.text}
                      onChange={(e) => updateStepText(step.id, e.target.value)}
                      placeholder={`First small action for ${areaLabel}`}
                    />
                    <input
                      className="gsi-input gsi-step-minutes"
                      type="number"
                      min="1"
                      value={step.minutes || ""}
                      onChange={(e) =>
                        updateStepMinutes(step.id, e.target.value)
                      }
                      placeholder="2"
                    />
                    <button
                      type="button"
                      className="gsi-step-btn gsi-step-remove-btn"
                      onClick={() => removeStep(step.id)}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="gsi-add-step-btn"
                onClick={addStep}
              >
                + Add step
              </button>
            </div>
          </div>
        )}

        {/* STAGE 4: Order Steps */}
        {stage === 4 && (
          <div className="gsi-stage">
            <StageSummary
              lines={[
                { label: "Area", value: areaLabel },
                { label: "Now", value: now || "Not filled in yet" },
                { label: "Target", value: goodEnough || "Not filled in yet" },
              ]}
            />

            {validProofs.length > 0 && (
              <div className="gsi-stage-compact-proof">
                <strong>Proof:</strong>
                <ul className="gsi-proof-list">
                  {validProofs.map((p) => (
                    <li key={p.id}>{p.text}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="gsi-stage-body">
              <label className="gsi-label">
                Put the steps for {areaLabel} in the order you want
              </label>
              <p className="gsi-hint">
                Reorder, adjust, or remove steps until the plan for {areaLabel}{" "}
                feels realistic.
              </p>

              <div className="gsi-step-rows gsi-step-rows--order">
                {steps.map((step, idx) => (
                  <div
                    className="gsi-step-row gsi-step-row--order"
                    key={step.id}
                  >
                    <span className="gsi-step-index">{idx + 1}</span>
                    <input
                      className="gsi-input gsi-step-input"
                      type="text"
                      value={step.text}
                      onChange={(e) => updateStepText(step.id, e.target.value)}
                      placeholder={`Step ${idx + 1} for ${areaLabel}`}
                    />
                    <input
                      className="gsi-input gsi-step-minutes"
                      type="number"
                      min="1"
                      value={step.minutes || ""}
                      onChange={(e) =>
                        updateStepMinutes(step.id, e.target.value)
                      }
                      placeholder="2"
                    />
                    <button
                      type="button"
                      className="gsi-step-btn gsi-step-up-btn"
                      onClick={() => moveStepUp(step.id)}
                      disabled={idx === 0}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="gsi-step-btn gsi-step-down-btn"
                      onClick={() => moveStepDown(step.id)}
                      disabled={idx === steps.length - 1}
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="gsi-step-btn gsi-step-remove-btn"
                      onClick={() => removeStep(step.id)}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div
                className={`gsi-budget-display ${
                  overBudget
                    ? "gsi-budget-display--over"
                    : "gsi-budget-display--ok"
                }`}
              >
                <span className="gsi-budget-label">Planned steps total</span>
                <strong className="gsi-budget-value">
                  {plannedTotal} / {maxTotal || 0} min
                </strong>
              </div>

              {overBudget && (
                <p className="gsi-budget-warning">
                  This plan is longer than your max time for this area.
                </p>
              )}
            </div>
          </div>
        )}

        {/* STAGE 5: Save */}
        {stage === 5 && (
          <div className="gsi-stage">
            <StageSummary
              lines={[
                { label: "Area", value: areaLabel },
                { label: "Now", value: now || "Not filled in yet" },
                { label: "Target", value: goodEnough || "Not filled in yet" },
              ]}
            />

            <div className="gsi-stage-body gsi-save-review">
              <h3 className="gsi-review-title">Ready to save?</h3>

              <div className="gsi-review-box">
                <div className="gsi-review-item">
                  <strong>Area</strong>
                  <p>{area}</p>
                </div>
                <div className="gsi-review-item">
                  <strong>Now</strong>
                  <p>{now}</p>
                </div>
                <div className="gsi-review-item">
                  <strong>Target</strong>
                  <p>{goodEnough}</p>
                </div>
                {validProofs.length > 0 && (
                  <div className="gsi-review-item">
                    <strong>Proof</strong>
                    <ul className="gsi-review-proof-list">
                      {validProofs.map((p) => (
                        <li key={p.id}>{p.text}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="gsi-review-item">
                  <strong>
                    Steps ({steps.filter((s) => s.text.trim()).length})
                  </strong>
                  <ol className="gsi-review-steps-list">
                    {steps
                      .filter((s) => s.text.trim())
                      .map((s) => (
                        <li key={s.id}>
                          {s.text}{" "}
                          <span className="gsi-review-time">
                            ({s.minutes}m)
                          </span>
                        </li>
                      ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && <p className="gsi-error">{error}</p>}
        {message && <p className="gsi-success">{message}</p>}
      </div>

      <div className="gsi-nav">
        <button
          type="button"
          className="gsi-btn gsi-btn--back"
          onClick={goBack}
          disabled={stage === 0}
        >
          Back
        </button>

        {stage < STAGES.length - 1 ? (
          <button
            type="button"
            className="gsi-btn gsi-btn--next"
            onClick={goNext}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            className="gsi-btn gsi-btn--save"
            onClick={handleSaveToList}
          >
            Save to list
          </button>
        )}
      </div>
    </section>
  )
}
