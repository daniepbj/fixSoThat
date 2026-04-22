import { useEffect, useRef, useState } from "react"
import SectionMoveControls from "./SectionMoveControls"
import { parseStepRaw, genStepId, formatStepRaw } from "../utils/stepUtils"
import { useMainTask } from "../context/MainTaskContext"

function normalizeInput(value) {
  return value.trim()
}

function buildPrototypeOutput({ goal, steps, proof, priority }) {
  const trimmedGoal = normalizeInput(goal)
  const trimmedProof = normalizeInput(proof)
  const trimmedPriority = normalizeInput(priority)
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

  lines.push(trimmedProof ? `Proof: ${trimmedProof}` : "Proof:")
  lines.push(trimmedPriority ? `Priority: ${trimmedPriority}` : "Priority:")

  return lines.join("\n")
}

export default function StructuredTaskPrototype({
  sectionControls,
  sectionCollapsed,
  onToggleSectionCollapsed,
}) {
  const { addMainTaskAndActivate, updateMainTask, mainTasks, setStepCompleted } =
    useMainTask()
  const [goal, setGoal] = useState("")
  const [steps, setSteps] = useState([{ id: genStepId(), raw: "" }])
  const [proof, setProof] = useState("")
  const [priority, setPriority] = useState("")
  const [generatedText, setGeneratedText] = useState("")
  const [queueTaskId, setQueueTaskId] = useState("")
  const [goalQueueStepId, setGoalQueueStepId] = useState("")
  const [queueStepIds, setQueueStepIds] = useState([])
  const [proofQueueStepId, setProofQueueStepId] = useState("")
  const [priorityQueueStepId, setPriorityQueueStepId] = useState("")
  const [liveTimerTask, setLiveTimerTask] = useState(null)
  const [loadMessage, setLoadMessage] = useState("")
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

  function syncPrototypeTask(taskId) {
    if (!taskId) return

    const stepRawById = new Map(
      (steps || [])
        .map((step) => {
          const parsed = parseStepRaw(String(step.raw || "").trim())
          if (!parsed.text) return null
          return [step.id, formatStepRaw(parsed.text, Math.max(1, parsed.minutes || 1))]
        })
        .filter(Boolean),
    )

    const task = mainTasks.find((t) => t.id === taskId)
    const nextTaskSteps = (task?.steps || []).map((step) =>
      stepRawById.has(step.id)
        ? { ...step, raw: stepRawById.get(step.id) }
        : step,
    )

    updateMainTask(taskId, {
      title: normalizeInput(goal) || "Fixa prototype",
      steps: nextTaskSteps,
      proof: normalizeInput(proof),
      priority: normalizeInput(priority),
      status: "active",
    })
  }

  function createQueueTask() {
    const trimmedGoal = normalizeInput(goal)
    const validSteps = (steps || [])
      .map((s) => ({ id: s.id, ...parseStepRaw(String(s?.raw || "").trim()) }))
      .filter((s) => s.text)

    const nextGoalStepId = genStepId()
    const nextProofStepId = genStepId()
    const nextPriorityStepId = genStepId()
    const nextStepIds = []
    const stagedSteps = [
      {
        id: nextGoalStepId,
        raw: formatStepRaw("Fill out: Fixa sa att jag ...", 1),
      },
    ]

    if (validSteps.length > 0) {
      validSteps.forEach((step) => {
        nextStepIds.push(step.id)
        stagedSteps.push({
          id: step.id,
          raw: formatStepRaw(step.text, Math.max(1, step.minutes || 1)),
        })
      })
    } else {
      const firstStepId = genStepId()
      nextStepIds.push(firstStepId)
      stagedSteps.push({
        id: firstStepId,
        raw: formatStepRaw("Plan your first step", 5),
      })
    }

    stagedSteps.push({
      id: nextProofStepId,
      raw: formatStepRaw("Fill out proof", 1),
    })

    stagedSteps.push({
      id: nextPriorityStepId,
      raw: formatStepRaw("Set priority", 1),
    })

    const createdTask = addMainTaskAndActivate({
      title: trimmedGoal || "Fixa prototype",
      now: "",
      steps: stagedSteps,
      proof: normalizeInput(proof),
      priority: normalizeInput(priority),
    })

    if (createdTask?.id) {
      window.localStorage.setItem("fst_autostart_main_task", createdTask.id)
      setQueueTaskId(createdTask.id)
      setGoalQueueStepId(nextGoalStepId)
      setQueueStepIds(nextStepIds)
      setProofQueueStepId(nextProofStepId)
      setPriorityQueueStepId(nextPriorityStepId)
      return createdTask.id
    }

    return ""
  }

  function ensureQueueTask() {
    const exists = Boolean(queueTaskId) && mainTasks.some((t) => t.id === queueTaskId)
    if (exists) {
      syncPrototypeTask(queueTaskId)
      return queueTaskId
    }
    return createQueueTask()
  }

  function pickStepIdToComplete(taskId, candidateIds) {
    const task = mainTasks.find((t) => t.id === taskId)
    if (!task) return ""
    const candidates = (candidateIds || [])
      .map((id) => (task.steps || []).find((step) => step.id === id))
      .filter(Boolean)
    if (!candidates.length) return ""

    const liveId = liveTimerTask?.sourceStepId
    if (liveId && candidates.some((step) => step.id === liveId)) {
      return liveId
    }

    return (candidates.find((step) => !step.completed) || candidates[0])?.id || ""
  }

  function markPartDone(part) {
    const taskId = ensureQueueTask()
    if (!taskId) return

    let targetId = ""
    if (part === "goal") targetId = goalQueueStepId
    if (part === "proof") targetId = proofQueueStepId
    if (part === "priority") targetId = priorityQueueStepId
    if (part === "steps") targetId = pickStepIdToComplete(taskId, queueStepIds)

    if (targetId) setStepCompleted(taskId, targetId, true)
    setLoadMessage("Marked done ✓")
    window.setTimeout(() => setLoadMessage(""), 1700)
  }

  function handleStartInTimer() {
    createQueueTask()

    setLoadMessage("Started in timer ▶")
    window.setTimeout(() => setLoadMessage(""), 2500)
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
    ensureQueueTask()
    const nextOutput = buildPrototypeOutput({ goal, steps, proof, priority })
    setGeneratedText(nextOutput)
  }

  const queueTask = mainTasks.find((t) => t.id === queueTaskId)
  const isPartCompleted = (part) => {
    if (!queueTask) return false
    if (part === "goal") {
      return Boolean((queueTask.steps || []).find((s) => s.id === goalQueueStepId)?.completed)
    }
    if (part === "proof") {
      return Boolean((queueTask.steps || []).find((s) => s.id === proofQueueStepId)?.completed)
    }
    if (part === "priority") {
      return Boolean((queueTask.steps || []).find((s) => s.id === priorityQueueStepId)?.completed)
    }
    if (part === "steps") {
      const matches = (queueTask.steps || []).filter((s) => queueStepIds.includes(s.id))
      return matches.length > 0 && matches.every((step) => step.completed)
    }
    return false
  }

  const queueActive =
    Boolean(liveTimerTask?.sourceMainTaskId) &&
    liveTimerTask.sourceMainTaskId === queueTaskId
  const liveGlowColor = liveTimerTask?.color ?? "#6c63ff"
  const activeSourceStepId = liveTimerTask?.sourceStepId
  const focusGoal = queueActive && activeSourceStepId === goalQueueStepId
  const focusProof = queueActive && activeSourceStepId === proofQueueStepId
  const focusPriority = queueActive && activeSourceStepId === priorityQueueStepId
  const focusSteps = queueActive && queueStepIds.includes(activeSourceStepId)

  return (
    <section
      className={`task-builder-card${queueActive ? " task-builder-card--timer-active" : ""}`}
      style={{ "--timer-glow-color": liveGlowColor }}
      aria-label="Fixa prototype flow"
    >
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
              <span className="task-builder-label-row">
                <span>Fixa sa att jag ...</span>
                <button
                  type="button"
                  className={`task-part-done-btn ${isPartCompleted("goal") ? "task-part-done-btn--active" : ""}`}
                  onClick={() => markPartDone("goal")}
                >
                  {isPartCompleted("goal") ? "Done ✓" : "Done"}
                </button>
              </span>
            </label>
            <textarea
              id="prototype-goal-input"
              className={`task-builder-input task-builder-textarea ${focusGoal ? "task-builder-focus-target task-builder-focus-target--active" : ""}`}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="laddat mobilen stadat usbn"
              rows={2}
            />

            <fieldset
              className={`task-builder-steps-section ${focusSteps ? "task-builder-focus-target task-builder-focus-target--active" : ""}`}
            >
              <legend className="task-builder-legend">
                <span className="task-builder-label-row">
                  <span>Steps</span>
                  <button
                    type="button"
                    className={`task-part-done-btn ${isPartCompleted("steps") ? "task-part-done-btn--active" : ""}`}
                    onClick={() => markPartDone("steps")}
                  >
                    {isPartCompleted("steps") ? "Done ✓" : "Done"}
                  </button>
                </span>
              </legend>
              <div className="task-step-list">
                {steps.map((step, idx) => {
                  const parsed = parseStepRaw(step.raw)
                  return (
                    <div className="task-step-row" key={step.id}>
                      <div className="task-step-number">{idx + 1}</div>
                      <input
                        ref={(el) => {
                          if (el) stepInputRefs.current[step.id] = el
                        }}
                        type="text"
                        className="task-step-input"
                        value={step.raw}
                        onChange={(e) => updateStepRaw(step.id, e.target.value)}
                        onKeyDown={(e) => handleStepKeyDown(e, step.id)}
                        placeholder="Step name 5"
                      />

                      {parsed.minutes > 0 && (
                        <span className="task-step-time-badge">
                          {parsed.minutes}m
                        </span>
                      )}
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

            <label className="task-builder-label" htmlFor="prototype-proof-input">
              <span className="task-builder-label-row">
                <span>Proof</span>
                <button
                  type="button"
                  className={`task-part-done-btn ${isPartCompleted("proof") ? "task-part-done-btn--active" : ""}`}
                  onClick={() => markPartDone("proof")}
                >
                  {isPartCompleted("proof") ? "Done ✓" : "Done"}
                </button>
              </span>
            </label>
            <textarea
              id="prototype-proof-input"
              className={`task-builder-input task-builder-textarea ${focusProof ? "task-builder-focus-target task-builder-focus-target--active" : ""}`}
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              placeholder="Proof att jag gjorde det jag sa: ..."
              rows={2}
            />

            <label className="task-builder-label" htmlFor="prototype-priority-input">
              <span className="task-builder-label-row">
                <span>Priority</span>
                <button
                  type="button"
                  className={`task-part-done-btn ${isPartCompleted("priority") ? "task-part-done-btn--active" : ""}`}
                  onClick={() => markPartDone("priority")}
                >
                  {isPartCompleted("priority") ? "Done ✓" : "Done"}
                </button>
              </span>
            </label>
            <input
              id="prototype-priority-input"
              className={`task-builder-input ${focusPriority ? "task-builder-focus-target task-builder-focus-target--active" : ""}`}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              placeholder="High / Medium / Low"
            />

            <button
              type="submit"
              className="task-builder-generate task-builder-generate--big"
            >
              Done and Generate
            </button>
          </form>

          {loadMessage && <p className="task-builder-load-message">{loadMessage}</p>}

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
