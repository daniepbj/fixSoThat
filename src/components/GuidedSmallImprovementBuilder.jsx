import { useMemo, useState, useEffect, useRef } from "react"
import { useMainTask } from "../context/MainTaskContext"
import { useLocalStorage } from "../hooks/useLocalStorage"
import { genStepId, formatStepRaw } from "../utils/stepUtils"
import { fmtTimerDisplay, getHourRingProgress } from "../utils/timeUtils"

const STAGES = ["Area", "Target", "Proof", "Brainstorm", "Order", "Save"]
const MAX_AREAS = 3
const TIME_CHIPS = [3, 5, 10]
const AREA_PLACEHOLDERS = ["cleaning", "school project", "website"]

function genProofId() {
  return `proof-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function makeStep() {
  return { id: genStepId(), text: "", minutes: 0 }
}

function makeProof() {
  return { id: genProofId(), text: "" }
}

function makeArea() {
  return {
    id: genStepId(),
    name: "",
    minutes: "5",
    chipValue: "5",
  }
}

function parseAreaInput(raw, currentMinutes = "5") {
  const text = String(raw || "")
  const trimmed = text.trim()
  if (!trimmed)
    return { name: "", minutes: currentMinutes, chipValue: "custom" }
  const match = trimmed.match(/^(.+?)\s+(\d+)$/)
  if (!match)
    return { name: text, minutes: currentMinutes, chipValue: "custom" }
  const name = match[1].trim()
  const mins = String(Math.max(1, parseInt(match[2], 10) || 1))
  const chipValue = TIME_CHIPS.includes(Number(mins)) ? mins : "custom"
  return { name, minutes: mins, chipValue }
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
  const {
    addMainTask,
    addMainTaskAndActivate,
    mainTasks,
    activeMainTaskId,
    setStepCompleted,
  } = useMainTask()
  const [builderVisualStyle] = useLocalStorage(
    "fst_builder_visual_style",
    "calm",
  )

  // Live timer state — poll localStorage every second so this works even
  // though the builder lives outside TimerProvider.
  const [liveTimerTask, setLiveTimerTask] = useState(null)
  const [liveTimerRunning, setLiveTimerRunning] = useState(false)
  useEffect(() => {
    function read() {
      try {
        const tasks = JSON.parse(
          window.localStorage.getItem("fst_active") || "[]",
        )
        const running = JSON.parse(
          window.localStorage.getItem("fst_running") || "false",
        )
        setLiveTimerTask(tasks[0] ?? null)
        setLiveTimerRunning(Boolean(running))
      } catch {}
    }
    read()
    const id = setInterval(read, 1000)
    return () => clearInterval(id)
  }, [])

  const [stage, setStage] = useState(0)
  const [areaIndex, setAreaIndex] = useState(0)
  // Per-area saved data: { [index]: { now, goodEnough, proofs, steps } }
  const [areaDataCache, setAreaDataCache] = useState({})
  const [areas, setAreas] = useState([makeArea()])
  const [now, setNow] = useState("")
  const [goodEnough, setGoodEnough] = useState("")
  const [proofs, setProofs] = useState([makeProof()])
  const [steps, setSteps] = useState([makeStep()])
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [builderQueueTaskId, setBuilderQueueTaskId] = useState("")
  const [stageStepIds, setStageStepIds] = useState({ 0: [], 1: [], 2: [] })
  const [lastStageStepIds, setLastStageStepIds] = useState({})
  const areaInputRefs = useRef({})

  const plannedTotal = useMemo(() => {
    return steps.reduce((sum, step) => sum + (step.minutes || 0), 0)
  }, [steps])

  const normalizedAreas = areas.map((a) => {
    const parsed = parseAreaInput(a.name, a.minutes)
    return {
      ...a,
      parsedName: parsed.name.trim(),
      parsedMinutes: parsePositiveInt(parsed.minutes, 0),
    }
  })
  const filledAreas = normalizedAreas.filter((a) => a.parsedName)
  const trimmedAreas = filledAreas.map((a) => a.parsedName)
  const trimmedArea = trimmedAreas.join(" / ")

  // Per-area context used by stages 1–4
  const currentAreaEntry = filledAreas[areaIndex] || normalizedAreas[areaIndex]
  const currentAreaName = currentAreaEntry?.parsedName || "this area"
  const currentAreaMaxMinutes = currentAreaEntry?.parsedMinutes || 0
  const areaLabel =
    filledAreas.length > 1
      ? `${currentAreaName} (${areaIndex + 1} of ${filledAreas.length})`
      : currentAreaName
  const areaExamples = useMemo(
    () => inferAreaExamples(currentAreaName),
    [currentAreaName],
  )

  const maxTotal = filledAreas
    .map((a) => a.parsedMinutes)
    .reduce((sum, mins) => sum + mins, 0)
  const overBudget =
    currentAreaMaxMinutes > 0 && plannedTotal > currentAreaMaxMinutes
  const validProofs = proofs.filter((p) => p.text.trim().length > 0)
  const liveRemaining = liveTimerTask?.remainingSeconds ?? 0
  const liveProgress = getHourRingProgress(liveRemaining)
  const liveRingR = 10
  const liveAlarm = Boolean(liveTimerTask && liveRemaining <= 0)

  // Play is always available: if details are missing, queue a starter task
  // that begins by filling in the area.
  const canPlay = true

  function syncStageQueueStep(stageIndex, completed) {
    const ids = stageStepIds[stageIndex] || []
    if (!ids.length) return
    const taskId = builderQueueTaskId || activeMainTaskId
    if (!taskId) return
    const task = mainTasks.find((t) => t.id === taskId)
    if (!task) return
    const candidates = ids
      .map((id) => (task.steps || []).find((step) => step.id === id))
      .filter(Boolean)
    if (!candidates.length) return
    let picked = null
    const liveIsCandidate =
      liveTimerTask?.sourceMainTaskId === taskId &&
      ids.includes(liveTimerTask?.sourceStepId)
    if (liveIsCandidate) {
      picked = candidates.find((step) => step.id === liveTimerTask.sourceStepId)
    }
    if (!picked) {
      if (!completed && lastStageStepIds[stageIndex]) {
        picked = candidates.find(
          (step) => step.id === lastStageStepIds[stageIndex],
        )
      }
      if (!picked) {
        picked = completed
          ? candidates.find((step) => !step.completed) || candidates[0]
          : candidates.find((step) => step.completed) || candidates[0]
      }
    }
    if (!picked) return
    setStepCompleted(task.id, picked.id, completed)
    if (completed) {
      setLastStageStepIds((prev) => ({ ...prev, [stageIndex]: picked.id }))
    }
  }

  function updateArea(id, patch) {
    setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }

  function handleAreaNameChange(id, value) {
    setAreas((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a
        const parsed = parseAreaInput(value, a.minutes)
        return {
          ...a,
          name: value,
          minutes: parsed.minutes,
          chipValue: parsed.chipValue,
        }
      }),
    )
  }

  function addArea(focusNew = false) {
    const created = makeArea()
    setAreas((prev) => (prev.length >= MAX_AREAS ? prev : [...prev, created]))
    if (focusNew) {
      window.setTimeout(() => {
        const ref = areaInputRefs.current[created.id]
        if (ref) ref.focus()
      }, 0)
    }
  }

  function removeArea(id) {
    setAreas((prev) => {
      const next = prev.filter((a) => a.id !== id)
      return next.length ? next : [makeArea()]
    })
  }

  function handleAreaNameKeyDown(e, idx) {
    if (e.key !== "Enter") return
    e.preventDefault()
    const next = areas[idx + 1]
    if (next) {
      const ref = areaInputRefs.current[next.id]
      if (ref) ref.focus()
      return
    }
    if (areas.length < MAX_AREAS) addArea(true)
  }

  // Save current area data to cache then load a different area index.
  function advanceArea() {
    const nextIdx = areaIndex + 1
    const cached = areaDataCache[nextIdx]
    setAreaDataCache((prev) => ({
      ...prev,
      [areaIndex]: { now, goodEnough, proofs, steps },
    }))
    setNow(cached?.now ?? "")
    setGoodEnough(cached?.goodEnough ?? "")
    setProofs(cached?.proofs ?? [makeProof()])
    setSteps(cached?.steps ?? [makeStep()])
    setAreaIndex(nextIdx)
    setStage(1)
  }

  function retreatArea() {
    const prevIdx = areaIndex - 1
    const cached = areaDataCache[prevIdx]
    setAreaDataCache((prev) => ({
      ...prev,
      [areaIndex]: { now, goodEnough, proofs, steps },
    }))
    setNow(cached?.now ?? "")
    setGoodEnough(cached?.goodEnough ?? "")
    setProofs(cached?.proofs ?? [makeProof()])
    setSteps(cached?.steps ?? [makeStep()])
    setAreaIndex(prevIdx)
    setStage(4)
  }

  // Collect the per-area data snapshot for queue building / save.
  // Each area has its own now/goodEnough/proofs/steps stored in cache;
  // the currently-active area is in the live state variables.
  function collectAllAreaData() {
    return filledAreas.map((area, i) => {
      if (i === areaIndex) {
        return { area, now, goodEnough, proofs, steps }
      }
      const cached = areaDataCache[i] || {}
      return {
        area,
        now: cached.now ?? "",
        goodEnough: cached.goodEnough ?? "",
        proofs: cached.proofs ?? [],
        steps: cached.steps ?? [],
      }
    })
  }

  function handleStartInTimer() {
    if (!canPlay) return
    const allAreaData = collectAllAreaData()
    const stagedSteps = []
    const nextStageStepIds = { 0: [], 1: [], 2: [] }

    function pushStep(raw, minutes, stageTag = null) {
      const id = genStepId()
      stagedSteps.push({ id, raw: formatStepRaw(raw, minutes) })
      if (stageTag != null) nextStageStepIds[stageTag].push(id)
    }

    if (allAreaData.length === 0) {
      // Nothing filled — queue starter prompts
      pushStep("Fill out area 1", 1, 0)
      pushStep("Fill out target", 1, 1)
      pushStep("Add one proof checkpoint", 1, 2)
      pushStep("Plan your first step", 5)
    } else {
      allAreaData.forEach(
        ({ area, goodEnough: ge, proofs: ap, steps: as }, i) => {
          const areaNum = i + 1
          const mins = Math.max(1, area.parsedMinutes || 1)
          pushStep(`Area ${areaNum}: ${area.parsedName}`, mins, 0)

          if (ge.trim()) {
            pushStep(`Target ${areaNum}: ${ge.trim()}`, 1, 1)
          } else {
            pushStep(`Fill out target for area ${areaNum}`, 1, 1)
          }

          const validAreaProofs = (ap || []).filter((p) => p.text?.trim())
          if (validAreaProofs.length > 0) {
            validAreaProofs.forEach((p) =>
              pushStep(`Proof ${areaNum}: ${p.text.trim()}`, 1, 2),
            )
          } else {
            pushStep(`Add proof for area ${areaNum}`, 1, 2)
          }

          const validAreaSteps = (as || []).filter((s) => s.text?.trim())
          if (validAreaSteps.length > 0) {
            validAreaSteps.forEach((s) =>
              pushStep(s.text, Math.max(1, parsePositiveInt(s.minutes, 1))),
            )
          } else {
            pushStep(`Plan steps for area ${areaNum}: ${area.parsedName}`, mins)
          }
        },
      )
    }

    const titleParts = allAreaData.map((d) => d.area.parsedName).filter(Boolean)
    const fallbackTitle =
      titleParts.join(" / ") ||
      goodEnough.trim() ||
      now.trim() ||
      "small improvement"
    const firstGe = allAreaData[0]?.goodEnough?.trim() || ""

    const createdTask = addMainTaskAndActivate({
      title:
        fallbackTitle +
        (firstGe && firstGe !== fallbackTitle ? `: ${firstGe}` : ""),
      now: (allAreaData[0]?.now || now).trim(),
      steps: stagedSteps,
      proof: allAreaData
        .map((d) =>
          (d.proofs || [])
            .filter((p) => p.text?.trim())
            .map((p) => p.text.trim())
            .join(", "),
        )
        .filter(Boolean)
        .join(" | "),
      priority: "",
    })
    if (createdTask?.id) {
      window.localStorage.setItem("fst_autostart_main_task", createdTask.id)
      setBuilderQueueTaskId(createdTask.id)
      setStageStepIds(nextStageStepIds)
      setLastStageStepIds({})
    }
    setMessage("Started in timer ▶")
    setTimeout(() => setMessage(""), 2500)
  }

  function resetForm() {
    setStage(0)
    setAreaIndex(0)
    setAreaDataCache({})
    setAreas([makeArea()])
    setNow("")
    setGoodEnough("")
    setProofs([makeProof()])
    setSteps([makeStep()])
    setError("")
    setMessage("")
    setBuilderQueueTaskId("")
    setStageStepIds({ 0: [], 1: [], 2: [] })
    setLastStageStepIds({})
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
      if (!trimmedAreas.length) {
        return "Pick an area."
      }
      for (const a of normalizedAreas) {
        if (!a.parsedName) continue
        if (!a.parsedMinutes) {
          return `"${a.parsedName}" needs a positive time cap.`
        }
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
    // Pre-seed the first proof input from "good enough" so Stage 2 is a
    // confirmation step rather than a repeat of Stage 1.
    if (stage === 1 && proofs.length === 1 && proofs[0].text.trim() === "") {
      setProofs([{ ...proofs[0], text: goodEnough.trim() }])
    }
    syncStageQueueStep(stage, true)
    // Signal TimerApp to dismiss any active alarm so the user isn't stuck
    // on the alarm screen when pressing Next after a stage timer runs out.
    // (Builder lives outside TimerProvider so we use a localStorage signal.)
    try {
      window.localStorage.setItem("fst_stop_alarm", "1")
    } catch {}
    // After completing the Order stage for the current area, loop back to
    // Target for the next area if one exists.
    if (stage === 4 && areaIndex < filledAreas.length - 1) {
      advanceArea()
    } else {
      setStage((prev) => Math.min(prev + 1, STAGES.length - 1))
    }
  }

  function goBack() {
    // At Target stage with earlier areas: go back to that area's Order stage.
    if (stage === 1 && areaIndex > 0) {
      retreatArea()
      setError("")
      return
    }
    syncStageQueueStep(stage - 1, false)
    setError("")
    setStage((prev) => Math.max(prev - 1, 0))
  }

  function handleSaveToList() {
    const err = validateStage(4)
    if (err) {
      setError(err)
      return
    }

    const allAreaData = collectAllAreaData()
    const allSteps = allAreaData.flatMap(({ area, steps: as }, i) => {
      const validAs = (as || []).filter((s) => s.text.trim().length > 0)
      return validAs.map((s) => ({ raw: formatStepRaw(s.text, s.minutes) }))
    })
    const proofText = allAreaData
      .flatMap((d) =>
        (d.proofs || []).filter((p) => p.text.trim()).map((p) => p.text.trim()),
      )
      .join("\n")
    const titleParts = allAreaData.map((d) => d.area.parsedName).filter(Boolean)
    const firstGe = allAreaData[0]?.goodEnough?.trim() || ""

    addMainTask({
      title: titleParts.join(" / ") + (firstGe ? `: ${firstGe}` : ""),
      now: (allAreaData[0]?.now || now).trim(),
      steps: allSteps,
      proof: proofText,
      priority: "",
    })

    setMessage("Saved to task list ✓")
    setTimeout(() => setMessage(""), 2200)
    resetForm()
  }

  return (
    <section
      className={`gsi-card gcb--${builderVisualStyle === "minimal" ? "minimal" : builderVisualStyle === "match" ? "match" : "calm"}${liveTimerRunning ? " gsi-card--timer-active" : ""}`}
      style={{ "--timer-glow-color": liveTimerTask?.color ?? "#6c63ff" }}
      aria-label="Guided small improvement builder"
    >
      <div className="gsi-header">
        <div className="gsi-header__text">
          <p className="gsi-hero-kicker">Experimental Builder</p>
          <h2 className="gsi-title">Build a small improvement</h2>
        </div>
        <button
          type="button"
          className={`gsi-play-btn${canPlay ? " gsi-play-btn--ready" : ""}`}
          onClick={handleStartInTimer}
          disabled={!canPlay}
          title="Start in timer queue"
          aria-label="Start session in timer"
        >
          ▶
        </button>
      </div>

      <div className="gsi-progress-bar">
        {STAGES.map((name, i) => (
          <div
            key={name}
            className={`gsi-progress-dot ${i === stage ? "gsi-progress-dot--active" : ""} ${i < stage ? "gsi-progress-dot--done" : ""}`}
          >
            <span
              className={`gsi-progress-num ${i === stage && liveTimerTask ? "gsi-progress-num--timer" : ""} ${i === stage && liveAlarm ? "gsi-progress-num--alarm" : ""}`}
            >
              {i === stage && liveTimerTask && (
                <svg
                  className="gsi-progress-mini-ring"
                  viewBox="0 0 28 28"
                  aria-hidden="true"
                  style={{
                    transform: "rotate(90deg) scaleX(-1)",
                    transformOrigin: "center",
                  }}
                >
                  <circle
                    className="gsi-progress-mini-ring__track"
                    cx="14"
                    cy="14"
                    r={liveRingR}
                  />
                  <circle
                    className="gsi-progress-mini-ring__progress"
                    cx="14"
                    cy="14"
                    r={liveRingR}
                    pathLength={1}
                    strokeDasharray={`${liveProgress} 1`}
                    style={{ stroke: liveTimerTask.color ?? "#6c63ff" }}
                  />
                </svg>
              )}
              <span className="gsi-progress-num__value">
                {i === stage && liveTimerTask
                  ? fmtTimerDisplay(liveRemaining)
                  : i + 1}
              </span>
            </span>
            <span className="gsi-progress-label">{name}</span>
          </div>
        ))}
      </div>

      <div className="gsi-content">
        {/* STAGE 0: Area + Time */}
        {stage === 0 && (
          <div className="gsi-stage">
            <div className="gsi-stage-body gcb-cat-list">
              <div className="gsi-area-stage-head">
                <span className="gsi-area-stage-head__label">
                  Areas and max time
                </span>
                <span className="gsi-area-stage-head__max">
                  Max {maxTotal || 0}m
                </span>
              </div>
              {areas.map((a, i) => (
                <div className="gcb-cat-card" key={a.id}>
                  <button
                    type="button"
                    className="gcb-card-remove"
                    onClick={() => removeArea(a.id)}
                    aria-label="Remove area"
                  >
                    ×
                  </button>
                  <label
                    className="gcb-cat-prompt"
                    htmlFor={`gsi-area-${a.id}`}
                  >
                    {i === 0
                      ? "What do I want to work on right now?"
                      : "Another area?"}
                  </label>
                  <span className="gcb-cat-helper">
                    One area. Small is enough.
                  </span>
                  <div className="gsi-area-row">
                    <input
                      ref={(el) => {
                        if (el) areaInputRefs.current[a.id] = el
                      }}
                      id={`gsi-area-${a.id}`}
                      className="gcb-input gcb-input--name"
                      value={a.name}
                      onChange={(e) =>
                        handleAreaNameChange(a.id, e.target.value)
                      }
                      onKeyDown={(e) => handleAreaNameKeyDown(e, i)}
                      placeholder={`${AREA_PLACEHOLDERS[i % AREA_PLACEHOLDERS.length]} 5`}
                    />
                    <div className="gsi-area-inline-time">
                      <span className="gsi-area-inline-time__label">Max</span>
                      <input
                        className="gcb-input gcb-input--mins"
                        type="number"
                        min="1"
                        value={a.minutes}
                        onChange={(e) =>
                          updateArea(a.id, {
                            minutes: e.target.value,
                            chipValue: "custom",
                          })
                        }
                        placeholder="min"
                        aria-label={`Time cap for area ${i + 1}`}
                      />
                      <span className="gsi-area-inline-time__unit">m</span>
                    </div>
                  </div>
                  <fieldset className="gcb-time-chips">
                    <legend className="gcb-time-chips-legend">Time cap</legend>
                    {TIME_CHIPS.map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        className={`gcb-time-chip${a.chipValue === String(mins) ? " gcb-time-chip--selected" : ""}`}
                        aria-pressed={a.chipValue === String(mins)}
                        onClick={() =>
                          updateArea(a.id, {
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
                      className={`gcb-time-chip${a.chipValue === "custom" ? " gcb-time-chip--selected" : ""}`}
                      aria-pressed={a.chipValue === "custom"}
                      onClick={() => updateArea(a.id, { chipValue: "custom" })}
                    >
                      Custom
                    </button>
                    {a.chipValue === "custom" && (
                      <input
                        className="gcb-input gcb-input--mins"
                        type="number"
                        min="1"
                        value={a.minutes}
                        onChange={(e) =>
                          updateArea(a.id, { minutes: e.target.value })
                        }
                        placeholder="min"
                        aria-label="Custom minutes"
                      />
                    )}
                  </fieldset>
                </div>
              ))}
              {areas.length < MAX_AREAS && (
                <button type="button" className="gcb-add-btn" onClick={addArea}>
                  + Add another area
                </button>
              )}
            </div>
          </div>
        )}

        {/* STAGE 1: Now + Good Enough */}
        {stage === 1 && (
          <div className="gsi-stage">
            <StageSummary
              lines={[
                { label: "Area", value: areaLabel },
                {
                  label: "Time",
                  value: `${currentAreaMaxMinutes || 0} min max`,
                },
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
                  {plannedTotal} / {currentAreaMaxMinutes || 0} min
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
                  <p>{trimmedArea || areaLabel}</p>
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
