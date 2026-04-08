/**
 * Parse a raw step string like "Diska tallrikar 10" into {text, minutes}.
 * The TRAILING integer (if present) is the time in minutes.
 */
export function parseStepRaw(raw) {
    const trimmed = (raw || "").trim()
    const match = trimmed.match(/^(.*?)\s+(\d+)\s*$/)
    if (match) {
        return { text: match[1].trim(), minutes: parseInt(match[2], 10) }
    }
    return { text: trimmed, minutes: 0 }
}

/**
 * Format step back to raw string: "Diska tallrikar 10"
 */
export function formatStepRaw(text, minutes) {
    const t = (text || "").trim()
    const m = parseInt(minutes, 10) || 0
    if (!t) return ""
    return m > 0 ? `${t} ${m}` : t
}

/**
 * Parse a block of text (multi-line) into step objects.
 * Each non-empty line becomes one step.
 */
export function parseStepBlock(block) {
    return block
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((raw) => ({ id: genStepId(), raw }))
}

export function genStepId() {
    return `s-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Sort steps respecting linkedAfter ordering constraints.
 * A step with linkedAfter must appear directly after its parent step.
 */
export function sortStepsWithLinks(steps, options = {}) {
    if (!steps || steps.length === 0) return []
    const includeCompleted = Boolean(options.includeCompleted)
    const workingSet = includeCompleted ? steps : steps.filter(s => !s.completed)
    if (workingSet.length === 0) return []

    // Start with stable order-based sort
    const working = [...workingSet].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    // Enforce linkedAfter constraints iteratively (bounded to prevent loops)
    let maxPasses = working.length + 1
    let changed = true
    while (changed && maxPasses-- > 0) {
        changed = false
        for (let i = 0; i < working.length; i++) {
            const step = working[i]
            if (!step.linkedAfter) continue
            const parentIdx = working.findIndex(s => s.id === step.linkedAfter)
            if (parentIdx < 0) continue
            if (parentIdx + 1 !== i) {
                working.splice(i, 1)
                const np = working.findIndex(s => s.id === step.linkedAfter)
                if (np >= 0) working.splice(np + 1, 0, step)
                else working.push(step)
                changed = true
                break
            }
        }
    }
    return working
}
