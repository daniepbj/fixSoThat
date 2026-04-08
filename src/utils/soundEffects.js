let audioCtx = null

function getAudioContext() {
    if (typeof window === "undefined") return null
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    if (!audioCtx) audioCtx = new Ctx()
    return audioCtx
}

function beep({ frequency = 420, duration = 0.07, gain = 0.04, type = "sine" }) {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(frequency, now)

    amp.gain.setValueAtTime(0.0001, now)
    amp.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), now + 0.01)
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    osc.connect(amp)
    amp.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + duration + 0.01)
}

export function playClickSound(volume = 1) {
    const safe = Math.max(0, Math.min(1, Number(volume) || 0))
    beep({ frequency: 520, duration: 0.05, gain: 0.02 + safe * 0.03, type: "triangle" })
}

export function playCompletionSound(volume = 1) {
    const safe = Math.max(0, Math.min(1, Number(volume) || 0))
    beep({ frequency: 660, duration: 0.06, gain: 0.02 + safe * 0.035, type: "sine" })
    setTimeout(() => {
        beep({ frequency: 880, duration: 0.1, gain: 0.02 + safe * 0.04, type: "sine" })
    }, 80)
}
