import { useState, useRef } from "react"

const MAX_CHUNK_SIZE = 250

function normalizeInput(value) {
  return value.trim()
}

function buildFormattedTask({ goal, steps, proof }) {
  const trimmedGoal = normalizeInput(goal)
  const trimmedProof = normalizeInput(proof)
  const validSteps = steps
    .filter((s) => normalizeInput(s.text).length > 0)
    .map((s) => ({
      ...s,
      text: normalizeInput(s.text),
    }))

  const lines = []
  lines.push(
    trimmedGoal ? `* Fixa så att jag ${trimmedGoal}` : "* Fixa så att jag",
  )

  validSteps.forEach((step, index) => {
    const time =
      step.timeMinutes && step.timeMinutes > 0 ? ` ${step.timeMinutes}` : ""
    lines.push(`${index + 1}. ${step.text}${time}`)
  })

  lines.push(
    trimmedProof
      ? `Proof att jag gjorde det jag sa: ${trimmedProof}`
      : "Proof att jag gjorde det jag sa:",
  )

  return lines.join("\n")
}

function buildLlamaFormat({ goal, steps, proof }) {
  const trimmedGoal = normalizeInput(goal)
  const trimmedProof = normalizeInput(proof)
  const validSteps = steps
    .filter((s) => normalizeInput(s.text).length > 0)
    .map((s) => ({
      ...s,
      text: normalizeInput(s.text),
    }))

  const lines = []

  const totalTime = validSteps.reduce((sum, s) => sum + (s.timeMinutes || 0), 0)
  const goalLine = trimmedGoal
    ? `${trimmedGoal}${totalTime > 0 ? ` ${totalTime}` : ""}`
    : ""
  if (goalLine) lines.push(goalLine)

  validSteps.forEach((step) => {
    const stepLine =
      step.timeMinutes && step.timeMinutes > 0
        ? `${step.text} ${step.timeMinutes}`
        : step.text
    lines.push(stepLine)
  })

  if (trimmedProof) {
    lines.push(`Proof: ${trimmedProof}`)
  }

  return lines.join("\n")
}

function buildToDoChunks({ goal, steps, proof }, maxSize = MAX_CHUNK_SIZE) {
  const trimmedGoal = normalizeInput(goal)
  const trimmedProof = normalizeInput(proof)
  const validSteps = steps
    .filter((s) => normalizeInput(s.text).length > 0)
    .map((s) => ({ ...s, text: normalizeInput(s.text) }))

  const goalPart = trimmedGoal
    ? `Fixa så att jag ${trimmedGoal}`
    : "Fixa så att jag"

  // Content lines in parse-friendly format: step text followed by integer minutes
  const contentLines = []
  validSteps.forEach((step, index) => {
    const time =
      step.timeMinutes && step.timeMinutes > 0 ? ` ${step.timeMinutes}` : ""
    contentLines.push(`${index + 1}. ${step.text}${time}`)
  })
  if (trimmedProof) {
    contentLines.push(`Proof att jag gjorde det jag sa: ${trimmedProof}`)
  }

  if (contentLines.length === 0) {
    return [`* (1/1) ${goalPart}`]
  }

  // Reserve worst-case header length (2-digit chunk numbers) to stay safely under limit
  const headerReserve = `* (99/99) ${goalPart}\n`.length

  // Greedily pack lines into groups that each fit within maxSize
  const chunkGroups = []
  let currentLines = []
  let currentLen = headerReserve

  for (const line of contentLines) {
    const lineLen = line.length + 1 // +1 for \n
    if (currentLines.length > 0 && currentLen + lineLen > maxSize) {
      chunkGroups.push(currentLines)
      currentLines = [line]
      currentLen = headerReserve + lineLen
    } else {
      currentLines.push(line)
      currentLen += lineLen
    }
  }
  if (currentLines.length > 0) {
    chunkGroups.push(currentLines)
  }

  const total = chunkGroups.length
  return chunkGroups.map((lines, i) => {
    const header = `* (${i + 1}/${total}) ${goalPart}`
    return `${header}\n${lines.join("\n")}`
  })
}

function generateStepId() {
  return `step-${Math.random().toString(36).slice(2, 9)}`
}

export default function StructuredTaskBuilder() {
  const [isOpen, setIsOpen] = useState(false)
  const [goal, setGoal] = useState("")
  const [steps, setSteps] = useState([])
  const [proof, setProof] = useState("")
  const [generatedText, setGeneratedText] = useState("")
  const [llamaText, setLlamaText] = useState("")
  const [todoChunks, setTodoChunks] = useState([])
  const [todoChecks, setTodoChecks] = useState([])
  const [llamaPasted, setLlamaPasted] = useState(false)
  const [copyMessage, setCopyMessage] = useState("")
  const stepInputRefs = useRef({})

  function showCopyMessage(message) {
    setCopyMessage(message)
    window.setTimeout(() => setCopyMessage(""), 1600)
  }

  async function copyText(text, message) {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      showCopyMessage(message)
    } catch {
      showCopyMessage("Could not copy. Please copy manually.")
    }
  }

  function addStep() {
    const newStep = {
      id: generateStepId(),
      text: "",
      timeMinutes: 0,
    }
    setSteps((prev) => [...prev, newStep])
    window.setTimeout(() => {
      const ref = stepInputRefs.current[newStep.id]
      if (ref) ref.focus()
    }, 0)
  }

  function updateStep(id, field, value) {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    )
  }

  function removeStep(id) {
    setSteps((prev) => prev.filter((s) => s.id !== id))
    delete stepInputRefs.current[id]
  }

  function moveStepUp(id) {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id)
      if (idx <= 0) return prev
      const copy = [...prev]
      ;[copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]]
      return copy
    })
  }

  function moveStepDown(id) {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const copy = [...prev]
      ;[copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]]
      return copy
    })
  }

  function adjustTime(id, delta) {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, timeMinutes: Math.max(0, s.timeMinutes + delta) }
          : s,
      ),
    )
  }

  function handleStepKeyDown(event, id) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      const idx = steps.findIndex((s) => s.id === id)
      const newStep = {
        id: generateStepId(),
        text: "",
        timeMinutes: 0,
      }
      setSteps((prev) => [
        ...prev.slice(0, idx + 1),
        newStep,
        ...prev.slice(idx + 1),
      ])
      window.setTimeout(() => {
        const ref = stepInputRefs.current[newStep.id]
        if (ref) ref.focus()
      }, 0)
    }
  }

  function handleGenerate(event) {
    event.preventDefault()
    const nextText = buildFormattedTask({ goal, steps, proof })
    const nextLlamaText = buildLlamaFormat({ goal, steps, proof })
    const nextTodoChunks = buildToDoChunks({ goal, steps, proof })
    setGeneratedText(nextText)
    setLlamaText(nextLlamaText)
    setTodoChunks(nextTodoChunks)
    setTodoChecks(new Array(nextTodoChunks.length).fill(false))
    setLlamaPasted(false)
  }

  function toggleTodoCheck(index) {
    setTodoChecks((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }

  return (
    <section className="task-builder-card" aria-label="Fixa så att jag flow">
      <p className="hero-kicker">Structured task writer</p>
      <h2 className="task-builder-title">
        Build once, paste to Microsoft To Do and Llama
      </h2>
      <p className="task-builder-help">
        Dump your task, structure the steps, then generate output.
      </p>

      {!isOpen && (
        <button
          className="task-builder-main-button"
          type="button"
          onClick={() => setIsOpen(true)}
        >
          Fixa så att jag
        </button>
      )}

      {isOpen && (
        <form className="task-builder-form" onSubmit={handleGenerate}>
          <label className="task-builder-label" htmlFor="goal-input">
            Goal
          </label>
          <textarea
            id="goal-input"
            className="task-builder-input task-builder-textarea"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="What should go after: * Fixa så att jag ..."
          />

          <fieldset className="task-builder-steps-section">
            <legend className="task-builder-legend">Steps</legend>
            <p className="task-builder-hint">
              Press Enter to add a step. Click +/- to adjust time.
            </p>

            {steps.length === 0 && (
              <p className="task-builder-empty-hint">
                No steps yet. Add one below.
              </p>
            )}

            <div className="task-step-list">
              {steps.map((step, idx) => (
                <div className="task-step-row" key={step.id}>
                  <div className="task-step-number">{idx + 1}</div>

                  <input
                    ref={(el) => {
                      if (el) stepInputRefs.current[step.id] = el
                    }}
                    type="text"
                    className="task-step-input"
                    value={step.text}
                    onChange={(e) =>
                      updateStep(step.id, "text", e.target.value)
                    }
                    onKeyDown={(e) => handleStepKeyDown(e, step.id)}
                    placeholder="Step description"
                  />

                  <div className="task-step-time-controls">
                    <button
                      type="button"
                      className="task-time-btn"
                      onClick={() => adjustTime(step.id, -1)}
                      title="Decrease by 1 min"
                    >
                      −
                    </button>
                    <span className="task-time-display">
                      {step.timeMinutes > 0 ? `${step.timeMinutes}m` : "—"}
                    </span>
                    <button
                      type="button"
                      className="task-time-btn"
                      onClick={() => adjustTime(step.id, 1)}
                      title="Increase by 1 min"
                    >
                      +
                    </button>
                  </div>

                  <div className="task-step-controls">
                    <button
                      type="button"
                      className="task-control-btn"
                      onClick={() => moveStepUp(step.id)}
                      title="Move up"
                      disabled={idx === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="task-control-btn"
                      onClick={() => moveStepDown(step.id)}
                      title="Move down"
                      disabled={idx === steps.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="task-control-btn task-control-btn--remove"
                      onClick={() => removeStep(step.id)}
                      title="Remove step"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="task-builder-add-step-btn"
              onClick={addStep}
            >
              + Add step
            </button>
          </fieldset>

          <label className="task-builder-label" htmlFor="proof-input">
            Proof
          </label>
          <textarea
            id="proof-input"
            className="task-builder-input task-builder-textarea"
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            placeholder="Proof att jag gjorde det jag sa: ..."
          />

          <div className="task-builder-actions">
            <button className="task-builder-generate" type="submit">
              Generate output
            </button>
          </div>
        </form>
      )}

      {copyMessage && (
        <p className="task-builder-copy-message">{copyMessage}</p>
      )}

      {generatedText && (
        <>
          <section
            className="task-builder-output"
            aria-label="Full formatted output"
          >
            <h3>1. Full formatted text preview</h3>
            <pre className="task-builder-pre">{generatedText}</pre>
          </section>

          <section
            className="task-builder-output"
            aria-label="Microsoft To Do chunks"
          >
            <h3>2. Microsoft To Do chunks</h3>
            <p className="task-builder-help">
              Paste these chunks into Microsoft To Do as steps, in order. If
              needed, keep splitting long chunks into multiple steps.
            </p>
            <div className="task-chunk-list">
              {todoChunks.map((chunk, index) => (
                <article className="task-chunk-box" key={`chunk-${index}`}>
                  <pre className="task-builder-pre task-builder-pre--chunk">
                    {chunk}
                  </pre>
                  <div className="task-chunk-actions">
                    <button
                      type="button"
                      className="task-builder-copy-button"
                      onClick={() => copyText(chunk, "Chunk copied")}
                    >
                      Copy chunk
                    </button>
                    <label className="task-check-label">
                      <input
                        type="checkbox"
                        checked={Boolean(todoChecks[index])}
                        onChange={() => toggleTodoCheck(index)}
                      />
                      Added to Microsoft To Do
                    </label>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="task-builder-output" aria-label="Llama copy">
            <h3>3. Llama copy section</h3>
            <p className="task-builder-help">
              Copy this text for Llama. Each item is formatted as "taskname
              minutes" for easy parsing.
            </p>
            <button
              type="button"
              className="task-builder-copy-button"
              onClick={() => copyText(llamaText, "Llama format copied")}
            >
              Copy for Llama
            </button>
            <label className="task-check-label task-check-label--llama">
              <input
                type="checkbox"
                checked={llamaPasted}
                onChange={() => setLlamaPasted((prev) => !prev)}
              />
              Pasted into Llama
            </label>
          </section>
        </>
      )}
    </section>
  )
}
