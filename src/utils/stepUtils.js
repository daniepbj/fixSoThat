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

export function parseRawStep(raw) {
    const trimmed = String(raw || "").trim()
    const parsed = parseStepRaw(trimmed)
    return {
        id: genStepId(),
        text: parsed.text,
        minutes: parsed.minutes > 0 ? parsed.minutes : undefined,
        completed: false,
    }
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

export function formatStepsForPreview(steps) {
    if (!Array.isArray(steps) || steps.length === 0) return ""
    return steps
        .map((step) => {
            const text = String(step?.text || "").trim()
            const prefix = step?.completed ? "[x]" : "[ ]"
            const minutes = Number(step?.minutes)
            const suffix = Number.isFinite(minutes) && minutes > 0 ? ` (${minutes}m)` : ""
            return `${prefix} ${text}${suffix}`.trim()
        })
        .join("\n")
}

export function orderSteps(steps, orderIds = []) {
    if (!Array.isArray(steps) || steps.length === 0) return []

    const orderIndex = new Map(
        (Array.isArray(orderIds) ? orderIds : []).map((id, index) => [id, index]),
    )

    const ordered = []
    const unordered = []

    for (const step of steps) {
        if (orderIndex.has(step.id)) {
            ordered.push(step)
        } else {
            unordered.push(step)
        }
    }

    ordered.sort((left, right) => orderIndex.get(left.id) - orderIndex.get(right.id))
    return [...ordered, ...unordered]
}

/**
 * Parse a block of text (multi-line) into step objects (flat, no nesting).
 * Each non-empty line becomes one step.
 */
export function parseStepBlock(block) {
    return block
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((raw) => ({ id: genStepId(), raw }))
}

function stripStepPrefix(text) {
    return text
        .replace(/^\s*[-*]\s+/, "")
        .replace(/^\s*\d+[.)]\s+/, "")
        .trim()
}

/**
 * Parse a step block into a nested tree using indentation.
 * Two leading spaces equals one nesting level. Tabs are treated as two spaces.
 * Returns an array of embedded-tree nodes (used for initial parse before flattening).
 */
export function parseStepBlockTree(block) {
    const lines = String(block || "")
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((line) => ({
            raw: line,
            expanded: line.replace(/\t/g, "  "),
        }))
        .filter(({ expanded }) => expanded.trim().length > 0)

    if (!lines.length) return []

    const roots = []
    const stack = [{ depth: -1, children: roots }]

    for (const line of lines) {
        const indentMatch = line.expanded.match(/^\s*/)
        const indent = indentMatch ? indentMatch[0].length : 0
        const requestedDepth = Math.floor(indent / 2)
        const maxNextDepth = stack[stack.length - 1].depth + 1
        const depth = Math.max(0, Math.min(requestedDepth, maxNextDepth))
        const cleaned = stripStepPrefix(line.expanded)
        if (!cleaned) continue

        while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
            stack.pop()
        }

        const parent = stack[stack.length - 1]
        const node = {
            id: genStepId(),
            raw: cleaned,
            substeps: [],
        }
        parent.children.push(node)
        stack.push({ depth, children: node.substeps })
    }

    return roots
}

export function genStepId() {
    return `s-${Math.random().toString(36).slice(2, 9)}`
}

// ── Flat model utilities ─────────────────────────────────────────────────────

/**
 * Flatten an embedded-tree (old format with substeps arrays) into a flat array
 * with parentId references. Preserves existing IDs.
 */
export function flattenTreeToSteps(embeddedSteps, parentId = null) {
    const result = []
    const visit = (nodes, pid) => {
        const list = Array.isArray(nodes) ? nodes : []
        list.forEach((node, i) => {
            const step = {
                id: node.id || genStepId(),
                raw: node.raw || "",
                completed: Boolean(node.completed),
                parentId: pid,
                order: typeof node.order === "number" ? node.order : i,
                tries: Math.max(0, Number(node.tries) || 0),
            }
            result.push(step)
            const children = Array.isArray(node.substeps) ? node.substeps
                : Array.isArray(node.children) ? node.children
                    : []
            if (children.length) visit(children, step.id)
        })
    }
    visit(embeddedSteps, parentId)
    return result
}

/**
 * Return direct children of parentId (null = root), sorted by order.
 */
export function getChildren(flatSteps, parentId) {
    return (flatSteps || [])
        .filter((s) => (s.parentId ?? null) === (parentId ?? null))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/**
 * Return all descendants of stepId (all depths).
 */
export function getDescendants(flatSteps, stepId) {
    const result = []
    const queue = [stepId]
    while (queue.length) {
        const pid = queue.shift()
        const children = (flatSteps || []).filter((s) => s.parentId === pid)
        for (const c of children) {
            result.push(c)
            queue.push(c.id)
        }
    }
    return result
}

/**
 * Compute the depth of a step (0 = root).
 */
export function getDepth(flatSteps, stepId) {
    let depth = 0
    let current = (flatSteps || []).find((s) => s.id === stepId)
    while (current && current.parentId != null) {
        depth++
        current = (flatSteps || []).find((s) => s.id === current.parentId)
    }
    return depth
}

/**
 * Build a render tree: array of { ...step, children: [...] } nodes
 * for display purposes only. Does NOT mutate input.
 */
export function buildRenderTree(flatSteps, parentId = null) {
    const children = getChildren(flatSteps, parentId)
    return children.map((step) => ({
        ...step,
        children: buildRenderTree(flatSteps, step.id),
    }))
}

/**
 * Sort a flat array of SIBLING steps (same parentId) by order.
 * Kept for backward-compat import in TimerApp.
 */
export function sortStepsByOrder(steps) {
    return [...(steps || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/**
 * Thin wrapper kept for backward-compat (TimerApp imports this).
 * Now just sorts by order — linkedAfter system has been removed.
 */
export function sortStepsWithLinks(steps, options = {}) {
    if (!steps || steps.length === 0) return []
    const includeCompleted = Boolean(options.includeCompleted)
    const workingSet = includeCompleted ? steps : steps.filter((s) => !s.completed)
    return sortStepsByOrder(workingSet)
}
