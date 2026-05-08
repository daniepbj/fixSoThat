import { Temporal as PolyfillTemporal } from "@js-temporal/polyfill"

// Single source of truth: use native Temporal if available, otherwise the polyfill
const T =
    typeof globalThis.Temporal !== "undefined"
        ? globalThis.Temporal
        : PolyfillTemporal

const LS_TZ_KEY = "fst_timezone_override"
export const MIN_TIMER_SECONDS = 60
export const MAX_TIMER_SECONDS = 3600

export function clampTimerDuration(seconds, { allowZero = true } = {}) {
    const numericSeconds = Number(seconds)
    if (!Number.isFinite(numericSeconds)) {
        return allowZero ? 0 : MIN_TIMER_SECONDS
    }
    const roundedSeconds = Math.round(numericSeconds)
    if (allowZero && roundedSeconds <= 0) return 0
    return Math.min(MAX_TIMER_SECONDS, Math.max(MIN_TIMER_SECONDS, roundedSeconds))
}

/**
 * Set a manual timezone override (persisted to localStorage).
 * Pass "" or null to clear and use auto-detect.
 */
export function setTimezoneOverride(ianaId) {
    if (ianaId) {
        // Validate it's a real timezone by trying to use it
        try { T.Now.instant().toZonedDateTimeISO(ianaId) } catch { return }
        localStorage.setItem(LS_TZ_KEY, ianaId)
    } else {
        localStorage.removeItem(LS_TZ_KEY)
    }
}

/**
 * Get the current timezone override, or "" if auto-detect.
 */
export function getTimezoneOverride() {
    return localStorage.getItem(LS_TZ_KEY) || ""
}

function tz() {
    const override = localStorage.getItem(LS_TZ_KEY)
    if (override) {
        try { T.Now.instant().toZonedDateTimeISO(override); return override } catch { /* ignore bad override */ }
    }
    return T.Now.timeZoneId()
}

function now() {
    // Always use the real instant, but project into the user's chosen timezone
    return T.Now.instant().toZonedDateTimeISO(tz())
}

/**
 * Current time as an ISO-8601 string (always UTC, unambiguous).
 */
export function nowISO() {
    return T.Now.instant().toString()
}

/**
 * Seconds elapsed since a given ISO instant string.
 * Returns 0 if the string is invalid or in the future.
 */
export function secondsSince(isoInstant) {
    if (!isoInstant) return 0
    try {
        const start = T.Instant.from(isoInstant)
        const elapsed = T.Now.instant().since(start)
        const secs = elapsed.total("seconds")
        return Math.max(0, Math.floor(secs))
    } catch {
        return 0
    }
}

/**
 * Current local time as "HH:mm".
 */
export function currentTimeLocal() {
    return now().toPlainTime().toString({ smallestUnit: "minute" })
}

/**
 * The IANA timezone currently in effect (override or auto-detected).
 */
export function getTimezone() {
    return tz()
}

/**
 * The browser's auto-detected timezone (ignoring any override).
 */
export function getAutoTimezone() {
    return T.Now.timeZoneId()
}

/**
 * Get the projected end time as a local time string (HH:mm) for the user's timezone.
 */
export function projectedEndTimeLocal(remainingSeconds) {
    if (!Number.isFinite(remainingSeconds) || remainingSeconds < 0) return "—"
    const end = now().add({ seconds: Math.round(remainingSeconds) })
    return end.toPlainTime().toString({ smallestUnit: "minute" })
}

/**
 * Format a duration in seconds as "m:ss" or "h:mm:ss".
 */
export function fmtDuration(seconds) {
    const s = Math.max(0, Math.round(seconds))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0)
        return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    return `${m}:${String(sec).padStart(2, "0")}`
}

/**
 * Format a duration in seconds as human-friendly "Xh Ym".
 */
export function fmtDurationHuman(seconds) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
}

/**
 * Format a timer display as "MM:SS" (zero-padded).
 */
export function fmtTimerDisplay(seconds) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function formatTimeDisplay(seconds) {
    return fmtDuration(seconds)
}

export function parseTimeInput(input) {
    const trimmed = String(input || "").trim()
    if (!trimmed) return 0

    const parts = trimmed.split(":").map((part) => part.trim())
    if (parts.length < 1 || parts.length > 3) return 0
    if (parts.some((part) => part === "" || !/^\d+$/.test(part))) return 0

    if (parts.length === 1) {
        return Math.max(0, Number(parts[0]) * 60)
    }

    if (parts.length === 2) {
        const [minutes, secondsPart] = parts.map(Number)
        return Math.max(0, minutes * 60 + secondsPart)
    }

    const [hours, minutes, secondsPart] = parts.map(Number)
    return Math.max(0, hours * 3600 + minutes * 60 + secondsPart)
}

export function calculateRemaining(durationSeconds, elapsedSeconds) {
    const duration = Math.max(0, Math.round(Number(durationSeconds) || 0))
    const elapsed = Math.max(0, Math.round(Number(elapsedSeconds) || 0))
    return Math.max(0, duration - elapsed)
}

export function adjustTime(currentSeconds, deltaSeconds) {
    const current = Math.round(Number(currentSeconds) || 0)
    const delta = Math.round(Number(deltaSeconds) || 0)
    return clampTimerDuration(current + delta, { allowZero: false })
}

/**
 * Normalize remaining time against a fixed 60-minute ring scale.
 * One full circle always represents 60 minutes, regardless of task length.
 */
export function getHourRingProgress(remainingSeconds) {
    const total = 60 * 60
    const remaining = Number.isFinite(remainingSeconds) ? remainingSeconds : 0
    return Math.max(0, Math.min(1, remaining / total))
}

/**
 * Format an ISO string as local "HH:mm".
 */
export function fmtLocalTime(isoString) {
    if (!isoString) return "—"
    try {
        const instant = T.Instant.from(isoString)
        const zdt = instant.toZonedDateTimeISO(tz())
        return zdt.toPlainTime().toString({ smallestUnit: "minute" })
    } catch {
        return "—"
    }
}

/**
 * Format an ISO string as a local date (e.g. "4/10/2026").
 */
export function fmtLocalDate(isoString) {
    if (!isoString) return ""
    try {
        const instant = T.Instant.from(isoString)
        const zdt = instant.toZonedDateTimeISO(tz())
        const pd = zdt.toPlainDate()
        return `${pd.month}/${pd.day}/${pd.year}`
    } catch {
        return ""
    }
}

/**
 * Format an ISO string as "MMM d, HH:mm" (e.g. "Apr 10, 21:30").
 */
export function fmtLocalDateTime(isoString) {
    if (!isoString) return ""
    try {
        const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        const instant = T.Instant.from(isoString)
        const zdt = instant.toZonedDateTimeISO(tz())
        const pd = zdt.toPlainDate()
        const pt = zdt.toPlainTime().toString({ smallestUnit: "minute" })
        return `${MONTHS[pd.month - 1]} ${pd.day}, ${pt}`
    } catch {
        return ""
    }
}

/**
 * Check if an ISO string represents a date that is today in the user's timezone.
 */
export function isToday(isoString) {
    if (!isoString) return false
    try {
        const instant = T.Instant.from(isoString)
        const zdt = instant.toZonedDateTimeISO(tz())
        const todayDate = now().toPlainDate()
        return T.PlainDate.compare(zdt.toPlainDate(), todayDate) === 0
    } catch {
        return false
    }
}
