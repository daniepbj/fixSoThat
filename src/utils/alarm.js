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
    scheduleBeep(ctx, t,        880, 0.18)
    scheduleBeep(ctx, t + 0.22, 1100, 0.18)
    scheduleBeep(ctx, t + 0.44, 880,  0.28)
  } catch (e) {
    console.warn('Alarm audio error:', e)
  }
}
