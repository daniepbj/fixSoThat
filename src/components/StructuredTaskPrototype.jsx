import { useEffect, useRef, useState } from "react"
import SectionMoveControls from "./SectionMoveControls"
import { parseStepRaw, genStepId, formatStepRaw } from "../utils/stepUtils"
import { useMainTask } from "../context/MainTaskContext"
import { fmtTimerDisplay } from "../utils/timeUtils"

function normalizeInput(value) {
  return value.trim()
}

const PART_KEYS = ["goal", "steps", "proof", "priority"]

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
  const [liveTimerQueue, setLiveTimerQueue] = useState([])
  const [partOrder, setPartOrder] = useState(PART_KEYS)
  const [loadMessage, setLoadMessage] = useState("")
  const stepInputRefs = useRef({})

  useEffect(() => {
    function readActiveTimerTask() {
      try {
        const tasks = JSON.parse(
          window.localStorage.getItem("fst_active") || "[]",
        )
        setLiveTimerQueue(tasks)
        setLiveTimerTask(tasks[0] ?? null)
      } catch {
        setLiveTimerQueue([])
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

  function movePart(part, direction) {
    setPartOrder((prev) => {
      const idx = prev.indexOf(part)
      if (idx < 0) return prev
      const target = direction === "up" ? idx - 1 : idx + 1
      if (target < 0 || target >= prev.length) return prev
      const copy = [...prev]
      ;[copy[idx], copy[target]] = [copy[target], copy[idx]]
      return copy
    })
  }

  function getPartQueueEntries(part) {
    const scopedQueue = (liveTimerQueue || []).filter(
      (item) => item?.sourceMainTaskId === queueTaskId,
    )
    if (part === "goal") {
      return scopedQueue.filter((item) => item?.sourceStepId === goalQueueStepId)
    }
    if (part === "steps") {
      const ids = new Set(queueStepIds || [])
      return scopedQueue.filter((item) => ids.has(item?.sourceStepId))
    }
    if (part === "proof") {
      return scopedQueue.filter((item) => item?.sourceStepId === proofQueueStepId)
    }
    if (part === "priority") {
      return scopedQueue.filter(
        (item) => item?.sourceStepId === priorityQueueStepId,
      )
    }
    return []
  }

  function getPartLiveData(part) {
    const entries = getPartQueueEntries(part)
    if (!entries.length) return null

    const active = liveTimerTask && entries.find((item) => item?.id === liveTimerTask.id)
    const picked = active || entries[0]
    const totalSeconds = Math.max(
      1,
      (Number(picked?.estimatedMinutes) || 1) * 60,
    )
    const remaining = Math.max(0, Number(picked?.remainingSeconds) || 0)
    const ratio = Math.max(0, Math.min(1, remaining / totalSeconds))
    return {
      ratio,
      remaining,
      color: active ? "#34d195" : picked?.color || "#6c63ff",
      isActive: Boolean(active),
    }
  }

  function renderPartProgress(part) {
    const live = getPartLiveData(part)
    if (!live) return null
    return (
      <div className="prototype-part-progress" aria-hidden="true">
        <div className="prototype-part-progress__bar">
          <div
            className={`prototype-part-progress__fill ${live.isActive ? "prototype-part-progress__fill--head" : ""}`}
            style={{ width: `${live.ratio * 100}%`, background: live.color }}
          />
        </div>
        <span className="prototype-part-progress__time">
          {fmtTimerDisplay(live.remaining)} left
        </span>
      </div>
    )
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

  function renderPartControls(part) {
    const idx = partOrder.indexOf(part)
    return (
      <span className="task-builder-part-controls">
        <button
          type="button"
          className="task-part-sort-btn"
          title="Move part up"
          onClick={() => movePart(part, "up")}
          disabled={idx <= 0}
        >
          ↑
        </button>
        <button
          type="button"
          className="task-part-sort-btn"
          title="Move part down"
          onClick={() => movePart(part, "down")}
          disabled={idx < 0 || idx >= partOrder.length - 1}
        >
          ↓
        </button>
        <button
          type="button"
          className={`task-part-done-btn ${isPartCompleted(part) ? "task-part-done-btn--active" : ""}`}
          onClick={() => markPartDone(part)}
        >
          {isPartCompleted(part) ? "Done ✓" : "Done"}
        </button>
      </span>
    )
  }

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
            {partOrder.map((part) => {
              if (part === "goal") {
                return (
                  <div className="task-builder-part-block" key="goal">
                    <label className="task-builder-label" htmlFor="prototype-goal-input">
                      <span className="task-builder-label-row">
                        <span>Fixa sa att jag ...</span>
                        {renderPartControls("goal")}
                      </span>
                    </label>
                    {renderPartProgress("goal")}
                    <textarea
                      id="prototype-goal-input"
                      className={`task-builder-input task-builder-textarea ${focusGoal ? "task-builder-focus-target task-builder-focus-target--active task-builder-input--countdown-active" : ""}`}
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      placeholder="laddat mobilen stadat usbn"
                      rows={2}
                    />
                  </div>
                )
              }

              if (part === "steps") {
                return (
                  <fieldset
                    className={`task-builder-steps-section ${focusSteps ? "task-builder-focus-target task-builder-focus-target--active task-builder-steps-section--active" : ""}`}
                    key="steps"
                  >
                    <div className="task-builder-part-row" role="heading" aria-level={3}>
                      <span className="task-builder-legend">Steps</span>
                      {renderPartControls("steps")}
                    </div>
                    {renderPartProgress("steps")}
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
                              onChange={(e) =>
                                updateStepRaw(step.id, e.target.value)
                              }
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
                )
              }

              if (part === "proof") {
                return (
                  <div className="task-builder-part-block" key="proof">
                    <label className="task-builder-label" htmlFor="prototype-proof-input">
                      <span className="task-builder-label-row">
                        <span>Proof</span>
                        {renderPartControls("proof")}
                      </span>
                    </label>
                    {renderPartProgress("proof")}
                    <textarea
                      id="prototype-proof-input"
                      className={`task-builder-input task-builder-textarea ${focusProof ? "task-builder-focus-target task-builder-focus-target--active task-builder-input--countdown-active" : ""}`}
                      value={proof}
                      onChange={(e) => setProof(e.target.value)}
                      placeholder="Proof att jag gjorde det jag sa: ..."
                      rows={2}
                    />
                  </div>
                )
              }

              if (part === "priority") {
                return (
                  <div className="task-builder-part-block" key="priority">
                    <label className="task-builder-label" htmlFor="prototype-priority-input">
                      <span className="task-builder-label-row">
                        <span>Priority</span>
                        {renderPartControls("priority")}
                      </span>
                    </label>
                    {renderPartProgress("priority")}
                    <input
                      id="prototype-priority-input"
                      className={`task-builder-input ${focusPriority ? "task-builder-focus-target task-builder-focus-target--active task-builder-input--countdown-active" : ""}`}
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      placeholder="High / Medium / Low"
                    />
                  </div>
                )
              }

              return null
            })}

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
