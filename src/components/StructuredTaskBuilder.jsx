import { useState, useRef, useEffect } from "react"
import { useMainTask } from "../context/MainTaskContext"
import SectionMoveControls from "./SectionMoveControls"
import { parseStepRaw, genStepId, formatStepRaw } from "../utils/stepUtils"

const MAX_CHUNK_SIZE = 250
const SETTINGS_KEY = "fst_settings"

function normalizeInput(value) {
  return value.trim()
}

function shouldInsertSpaceOnStepMerge() {
  try {
    const settings = JSON.parse(
      window.localStorage.getItem(SETTINGS_KEY) || "{}",
    )
    return Boolean(settings.insertSpaceOnStepMerge)
  } catch {
    return false
  }
}

function mergeStepRaw(prevRaw, currRaw, insertSpace) {
  if (!insertSpace) return `${prevRaw}${currRaw}`
  if (!prevRaw || !currRaw) return `${prevRaw}${currRaw}`
  if (/\s$/.test(prevRaw) || /^\s/.test(currRaw)) {
    return `${prevRaw}${currRaw}`
  }
  return `${prevRaw} ${currRaw}`
}

/**
 * Build formatted preview text. Steps use "raw" format, parsed on the fly.
 */
function buildFormattedTask({ goal, steps, proof }) {
  const trimmedGoal = normalizeInput(goal)
  const trimmedProof = normalizeInput(proof)
  const validSteps = steps
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
    .map((s) => ({ ...s, raw: normalizeInput(s.raw) }))
    .filter((s) => s.raw.length > 0)
    .map((s) => ({ ...s, ...parseStepRaw(s.raw) }))

  const lines = []
  const totalTime = validSteps.reduce((sum, s) => sum + (s.minutes || 0), 0)
  const goalLine = trimmedGoal
    ? `${trimmedGoal}${totalTime > 0 ? ` ${totalTime}` : ""}`
    : ""
  if (goalLine) lines.push(goalLine)

  validSteps.forEach((step) => {
    const stepLine =
      step.minutes > 0 ? `${step.text} ${step.minutes}` : step.text
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
    .map((s) => ({ ...s, raw: normalizeInput(s.raw) }))
    .filter((s) => s.raw.length > 0)
    .map((s) => ({ ...s, ...parseStepRaw(s.raw) }))

  const goalPart = trimmedGoal
    ? `Fixa så att jag ${trimmedGoal}`
    : "Fixa så att jag"

  const contentLines = []
  validSteps.forEach((step, index) => {
    const time = step.minutes > 0 ? ` ${step.minutes}` : ""
    contentLines.push(`${index + 1}. ${step.text}${time}`)
  })
  if (trimmedProof) {
    contentLines.push(`Proof att jag gjorde det jag sa: ${trimmedProof}`)
  }

  if (contentLines.length === 0) {
    return [`* (1/1) ${goalPart}`]
  }

  const headerReserve = `* (99/99) ${goalPart}\n`.length

  const chunkGroups = []
  let currentLines = []
  let currentLen = headerReserve

  for (const line of contentLines) {
    const lineLen = line.length + 1
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

export default function StructuredTaskBuilder({
  sectionControls,
  sectionCollapsed,
  onToggleSectionCollapsed,
}) {
  const { addMainTask, addMainTaskAndActivate } = useMainTask()

  const [goal, setGoal] = useState("")
  const [steps, setSteps] = useState([{ id: genStepId(), raw: "" }])
  const [proof, setProof] = useState("")
  const [priority, setPriority] = useState("")
  const [generatedText, setGeneratedText] = useState("")
  const [llamaText, setLlamaText] = useState("")
  const [todoChunks, setTodoChunks] = useState([])
  const [todoChecks, setTodoChecks] = useState([])
  const [llamaPasted, setLlamaPasted] = useState(false)
  const [copyMessage, setCopyMessage] = useState("")
  const [loadMessage, setLoadMessage] = useState("")
  const [clearAfterLoad, setClearAfterLoad] = useState(true)
  const [draggedStepId, setDraggedStepId] = useState("")
  const [builderQueueTaskId, setBuilderQueueTaskId] = useState("")
  const [goalQueueStepId, setGoalQueueStepId] = useState("")
  const [proofQueueStepId, setProofQueueStepId] = useState("")
  const [liveTimerTask, setLiveTimerTask] = useState(null)
  const stepInputRefs = useRef({})

  useEffect(() => {
    function readActiveTimerTask() {
      try {
        const tasks = JSON.parse(
          window.localStorage.getItem("fst_active") || "[]",
        )
        setLiveTimerTask(tasks[0] ?? null)
      } catch {
        setLiveTimerTask(null)
      }
    }

    readActiveTimerTask()
    const id = setInterval(readActiveTimerTask, 1000)
    return () => clearInterval(id)
  }, [])

  function resetStructuredWriterForm() {
    setGoal("")
    setSteps([{ id: genStepId(), raw: "" }])
    setProof("")
    setPriority("")
    setGeneratedText("")
    setLlamaText("")
    setTodoChunks([])
    setTodoChecks([])
    setLlamaPasted(false)
    setCopyMessage("")
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

  function addStep() {
    const newStep = { id: genStepId(), raw: "" }
    setSteps((prev) => [...prev, newStep])
    window.setTimeout(() => {
      const ref = stepInputRefs.current[newStep.id]
      if (ref) ref.focus()
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

  function handleStepDragStart(id, event) {
    setDraggedStepId(id)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", id)
  }

  function handleStepDragOver(targetId, event) {
    const sourceId = draggedStepId || event.dataTransfer.getData("text/plain")
    if (!sourceId || sourceId === targetId) return
    event.preventDefault()
  }

  function handleStepDrop(targetId, event) {
    event.preventDefault()
    const sourceId = draggedStepId || event.dataTransfer.getData("text/plain")
    if (!sourceId || sourceId === targetId) return

    setSteps((prev) => {
      const fromIndex = prev.findIndex((step) => step.id === sourceId)
      const toIndex = prev.findIndex((step) => step.id === targetId)
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev
      const copy = [...prev]
      const [moved] = copy.splice(fromIndex, 1)
      copy.splice(toIndex, 0, moved)
      return copy
    })

    setDraggedStepId("")
  }

  function clearStepDrag() {
    setDraggedStepId("")
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
        const insertSpace = shouldInsertSpaceOnStepMerge()
        const mergedRaw = mergeStepRaw(prevStep.raw, step.raw, insertSpace)
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

  function handleLoadIntoTasks() {
    try {
      const validSteps = (steps || [])
        .map((s) => ({ raw: String(s?.raw || "").trim() }))
        .filter((s) => s.raw.length > 0)

      addMainTask({
        title: String(goal || "").trim(),
        steps: validSteps,
        proof: String(proof || "").trim(),
        priority: String(priority || "").trim(),
      })
      setLoadMessage("Loaded into task list ↓")
      if (clearAfterLoad) {
        resetStructuredWriterForm()
      }
    } catch {
      setLoadMessage("Could not load task. Please try again.")
    }
    setTimeout(() => setLoadMessage(""), 2200)
  }

  function handleStartInTimer() {
    const trimmedGoal = String(goal || "").trim()
    const trimmedProof = String(proof || "").trim()
    const validSteps = (steps || [])
      .map((s) => ({ ...parseStepRaw(String(s?.raw || "").trim()) }))
      .filter((s) => s.text)

    const goalStepId = genStepId()
    const proofStepId = genStepId()
    const stagedSteps = [
      {
        id: goalStepId,
        raw: formatStepRaw("Fill out: Fixa så att jag ...", 1),
      },
    ]

    if (validSteps.length > 0) {
      validSteps.forEach((step) => {
        stagedSteps.push({
          id: genStepId(),
          raw: formatStepRaw(step.text, Math.max(1, step.minutes || 1)),
        })
      })
    } else {
      stagedSteps.push({
        id: genStepId(),
        raw: formatStepRaw("Plan your first step", 5),
      })
    }

    stagedSteps.push({
      id: proofStepId,
      raw: formatStepRaw("Fill out proof", 1),
    })

    const createdTask = addMainTaskAndActivate({
      title: trimmedGoal || "Fixa så att jag",
      now: "",
      steps: stagedSteps,
      proof: trimmedProof,
      priority: String(priority || "").trim(),
    })

    if (createdTask?.id) {
      window.localStorage.setItem("fst_autostart_main_task", createdTask.id)
      setBuilderQueueTaskId(createdTask.id)
      setGoalQueueStepId(goalStepId)
      setProofQueueStepId(proofStepId)
    }

    setLoadMessage("Started in timer ▶")
    setTimeout(() => setLoadMessage(""), 2500)
  }

  function toggleTodoCheck(index) {
    setTodoChecks((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }

  const hasContent = goal.trim() || steps.some((s) => s.raw.trim())
  const queueActive =
    Boolean(liveTimerTask?.sourceMainTaskId) &&
    liveTimerTask.sourceMainTaskId === builderQueueTaskId
  const liveGlowColor = liveTimerTask?.color ?? "#6c63ff"
  const focusGoal =
    queueActive && liveTimerTask?.sourceStepId === goalQueueStepId
  const focusProof =
    queueActive && liveTimerTask?.sourceStepId === proofQueueStepId
  const focusSteps = queueActive && !focusGoal && !focusProof

  // Debug: log focus state
  if (queueActive) {
    console.log("Builder queue active:", {
      queueActive,
      activeStepId: liveTimerTask?.sourceStepId,
      goalQueueStepId,
      proofQueueStepId,
      focusGoal,
      focusProof,
      focusSteps,
    })
  }

  return (
    <section
      className={`task-builder-card${queueActive ? " task-builder-card--timer-active" : ""}`}
      style={{ "--timer-glow-color": liveGlowColor }}
      aria-label="Fixa så att jag flow"
    >
      <div className="task-builder-header">
        <div className="task-builder-header-text">
          <button
            type="button"
            className="section-collapse-toggle"
            onClick={onToggleSectionCollapsed}
          >
            Fixa så att jag
            <span className="section-collapse-arrow">
              {sectionCollapsed ? "▸" : "▾"}
            </span>
          </button>
        </div>
        <div className="task-builder-header-actions">
          {sectionControls && <SectionMoveControls {...sectionControls} />}
          <button
            type="button"
            className="task-builder-play-btn"
            onClick={handleStartInTimer}
            title="Start in timer queue"
            aria-label="Start in timer"
          >
            ▶
          </button>
        </div>
      </div>
      {!sectionCollapsed && (
        <>
          <p className="task-builder-help">
            Type your goal and steps. Use <code>step name 5</code> format for
            integer minutes. Press <kbd>Enter</kbd> to split or add steps fast;
            paste multiple lines at once.
          </p>

          <form className="task-builder-form" onSubmit={handleGenerate}>
            <label className="task-builder-label" htmlFor="goal-input">
              Fixa så att jag …
            </label>
            <textarea
              id="goal-input"
              className={`task-builder-input task-builder-textarea ${focusGoal ? "task-builder-focus-target task-builder-focus-target--active" : ""}`}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="ätit mat"
              rows={2}
            />

            <fieldset
              className={`task-builder-steps-section ${focusSteps ? "task-builder-focus-target task-builder-focus-target--active" : ""}`}
            >
              <legend className="task-builder-legend">Steps</legend>
              <p className="task-builder-hint">
                Format: <code>Diska 10</code> · Paste a block of lines to fill
                all at once.
              </p>

              <div className="task-step-list">
                {steps.map((step, idx) => {
                  const parsed = parseStepRaw(step.raw)
                  return (
                    <div
                      className={`task-step-row ${draggedStepId === step.id ? "task-step-row--dragging" : ""}`}
                      key={step.id}
                      onDragOver={(e) => handleStepDragOver(step.id, e)}
                      onDrop={(e) => handleStepDrop(step.id, e)}
                    >
                      <div className="task-step-number">{idx + 1}</div>
                      <button
                        type="button"
                        className="task-step-drag-btn"
                        draggable
                        onDragStart={(e) => handleStepDragStart(step.id, e)}
                        onDragEnd={clearStepDrag}
                        title="Drag to reorder steps"
                      >
                        ⋮⋮
                      </button>

                      <input
                        ref={(el) => {
                          if (el) stepInputRefs.current[step.id] = el
                        }}
                        type="text"
                        className="task-step-input"
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
                  )
                })}
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
              className={`task-builder-input task-builder-textarea ${focusProof ? "task-builder-focus-target task-builder-focus-target--active" : ""}`}
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              placeholder="Proof att jag gjorde det jag sa: ..."
              rows={2}
            />

            <label className="task-builder-label" htmlFor="priority-input">
              Priority
            </label>
            <input
              id="priority-input"
              className="task-builder-input"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              placeholder="High / Medium / Low"
            />

            <div className="task-builder-actions">
              <button className="task-builder-generate" type="submit">
                Generate output
              </button>
              <button
                type="button"
                className="task-builder-load-btn"
                onClick={handleLoadIntoTasks}
                disabled={!hasContent}
                title="Add this task to the internal task list below"
              >
                Load into task list ↓
              </button>
              <label className="task-check-label task-builder-clear-after-load">
                <input
                  type="checkbox"
                  checked={clearAfterLoad}
                  onChange={(e) => setClearAfterLoad(e.target.checked)}
                />
                Clear form after loading
              </label>
            </div>
          </form>

          {loadMessage && (
            <p className="task-builder-load-message">{loadMessage}</p>
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
                  Paste these chunks into Microsoft To Do as steps, in order.
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
                  Copy this text for Llama. Each item is formatted as{" "}
                  <code>taskname minutes</code> for easy parsing.
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
        </>
      )}
    </section>
  )
}
