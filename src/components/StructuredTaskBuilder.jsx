import { useMemo, useState } from "react"

const MAX_CHUNK_SIZE = 250

function normalizeInput(value) {
  return value.trim()
}

function buildFormattedTask({ goal, step1, step2, step3, step4, proof }) {
  const trimmedGoal = normalizeInput(goal)
  const trimmedProof = normalizeInput(proof)
  const rawSteps = [step1, step2, step3, step4].map(normalizeInput)
  const usedSteps = rawSteps.filter(Boolean)

  const lines = []
  lines.push(
    trimmedGoal ? `* Fixa så att jag ${trimmedGoal}` : "* Fixa så att jag",
  )
  usedSteps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step}`)
  })
  lines.push(
    trimmedProof
      ? `Proof att jag gjorde det jag sa: ${trimmedProof}`
      : "Proof att jag gjorde det jag sa:",
  )

  return lines.join("\n")
}

function findLineBreakSplit(text, maxSize) {
  for (let i = maxSize; i > 0; i -= 1) {
    if (text[i - 1] === "\n") return i
  }
  return -1
}

function findSentenceSplit(text, maxSize) {
  const segment = text.slice(0, maxSize)
  const pattern = /[.!?](\s|$)/g
  let match = pattern.exec(segment)
  let split = -1

  while (match) {
    split = match.index + 1
    match = pattern.exec(segment)
  }

  return split
}

function splitIntoChunks(text, maxSize = MAX_CHUNK_SIZE) {
  if (!text) return []

  const chunks = []
  let remaining = text

  while (remaining.length > maxSize) {
    const lineSplit = findLineBreakSplit(remaining, maxSize)
    const sentenceSplit =
      lineSplit > 0 ? -1 : findSentenceSplit(remaining, maxSize)
    const splitAt =
      lineSplit > 0 ? lineSplit : sentenceSplit > 0 ? sentenceSplit : maxSize

    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt)
  }

  if (remaining) {
    chunks.push(remaining)
  }

  return chunks
}

export default function StructuredTaskBuilder() {
  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState({
    goal: "",
    step1: "",
    step2: "",
    step3: "",
    step4: "",
    proof: "",
  })
  const [generatedText, setGeneratedText] = useState("")
  const [todoChecks, setTodoChecks] = useState([])
  const [llamaPasted, setLlamaPasted] = useState(false)
  const [copyMessage, setCopyMessage] = useState("")

  const chunks = useMemo(() => splitIntoChunks(generatedText), [generatedText])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

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

  function handleGenerate(event) {
    event.preventDefault()
    const nextText = buildFormattedTask(form)
    const nextChunks = splitIntoChunks(nextText)
    setGeneratedText(nextText)
    setTodoChecks(new Array(nextChunks.length).fill(false))
    setLlamaPasted(false)
  }

  function toggleTodoCheck(index) {
    setTodoChecks((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }

  const allChunksJoined = chunks.join("")

  return (
    <section className="task-builder-card" aria-label="Fixa så att jag flow">
      <p className="hero-kicker">Structured task writer</p>
      <h2 className="task-builder-title">
        Build once, paste to Microsoft To Do and Llama
      </h2>
      <p className="task-builder-help">
        First open the form, then generate the text, then copy chunks in order.
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
            value={form.goal}
            onChange={(event) => updateField("goal", event.target.value)}
            placeholder="What should go after: * Fixa så att jag ..."
          />

          <label className="task-builder-label" htmlFor="step-1-input">
            Step 1
          </label>
          <input
            id="step-1-input"
            className="task-builder-input"
            type="text"
            value={form.step1}
            onChange={(event) => updateField("step1", event.target.value)}
          />

          <label className="task-builder-label" htmlFor="step-2-input">
            Step 2
          </label>
          <input
            id="step-2-input"
            className="task-builder-input"
            type="text"
            value={form.step2}
            onChange={(event) => updateField("step2", event.target.value)}
          />

          <label className="task-builder-label" htmlFor="step-3-input">
            Step 3
          </label>
          <input
            id="step-3-input"
            className="task-builder-input"
            type="text"
            value={form.step3}
            onChange={(event) => updateField("step3", event.target.value)}
          />

          <label className="task-builder-label" htmlFor="step-4-input">
            Step 4
          </label>
          <input
            id="step-4-input"
            className="task-builder-input"
            type="text"
            value={form.step4}
            onChange={(event) => updateField("step4", event.target.value)}
          />

          <label className="task-builder-label" htmlFor="proof-input">
            Proof
          </label>
          <textarea
            id="proof-input"
            className="task-builder-input task-builder-textarea"
            value={form.proof}
            onChange={(event) => updateField("proof", event.target.value)}
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
              {chunks.map((chunk, index) => (
                <article className="task-chunk-box" key={`chunk-${index}`}>
                  <p className="task-chunk-title">Chunk {index + 1}</p>
                  <pre className="task-builder-pre task-builder-pre--chunk">
                    {chunk}
                  </pre>
                  <div className="task-chunk-actions">
                    <button
                      type="button"
                      className="task-builder-copy-button"
                      onClick={() =>
                        copyText(chunk, `Chunk ${index + 1} copied`)
                      }
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
              Copy all chunks as one string for Llama. The chunk order is
              preserved.
            </p>
            <button
              type="button"
              className="task-builder-copy-button"
              onClick={() => copyText(allChunksJoined, "All chunks copied")}
            >
              Copy all chunks
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
