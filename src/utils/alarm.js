// Web Audio API alarm sounds — no external audio files required
let audioCtx = null

function getCtx() {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return audioCtx
}

function scheduleBeep(ctx, startTime, freq, duration, volume = 0.45) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'triangle'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.05)
}

/**
 * Play a short 3-note alert pattern once.
 * Safe to call repeatedly; resumes a suspended AudioContext automatically.
 */
export function playAlarmOnce() {
  try {
    const ctx = getCtx()
    if (ctx.state === 'suspended') ctx.resume()
    const t = ctx.currentTime
    scheduleBeep(ctx, t, 880, 0.18)
    scheduleBeep(ctx, t + 0.22, 1100, 0.18)
    scheduleBeep(ctx, t + 0.44, 880, 0.28)
  } catch (e) {
    console.warn('Alarm audio error:', e)
  }
}

/* ── Beach loop (Web Audio API — same context as alarm, no autoplay issues) ── */

const BASE = import.meta.env.BASE_URL ?? '/'
let beachBuffer = null
let beachSource = null
let beachGain = null

// Preload beach.mp3 at module load
if (typeof window !== 'undefined') {
  fetch(`${BASE}sounds/beach.mp3`)
    .then(r => r.arrayBuffer())
    .then(buf => getCtx().decodeAudioData(buf))
    .then(decoded => { beachBuffer = decoded })
    .catch(e => console.warn('Beach audio preload failed:', e))
}

export function startBeachLoop(volume = 0.5) {
  try {
    stopBeachLoop()
    if (!beachBuffer) return
    const ctx = getCtx()
    if (ctx.state === 'suspended') ctx.resume()
    beachSource = ctx.createBufferSource()
    beachSource.buffer = beachBuffer
    beachSource.loop = true
    beachGain = ctx.createGain()
    beachGain.gain.value = volume
    beachSource.connect(beachGain)
    beachGain.connect(ctx.destination)
    beachSource.start(0)
  } catch (e) {
    console.warn('Beach audio start error:', e)
  }
}

export function stopBeachLoop() {
  if (beachSource) {
    try { beachSource.stop() } catch (_) { }
    beachSource = null
  }
  beachGain = null
}
