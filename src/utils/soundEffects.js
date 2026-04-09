const BASE = import.meta.env.BASE_URL ?? "/"

// Preload all sound files into Audio elements so playback is instant
const preloaded = {}
const FILES = ["ButtonClick.wav", "complete.wav", "delete.wav", "Power UP_1.wav"]

if (typeof window !== "undefined") {
  FILES.forEach((f) => {
    const a = new Audio(`${BASE}sounds/${f}`)
    a.preload = "auto"
    a.load()
    preloaded[f] = a
  })
}

function playFile(file, volume = 1) {
  const src = preloaded[file]
  if (!src) return
  // Clone so rapid clicks can overlap and there's no reset delay
  const a = src.cloneNode()
  a.volume = Math.max(0, Math.min(1, Number(volume) || 0))
  a.play().catch(() => {})
}

export function playClickSound(volume = 1) {
  playFile("ButtonClick.wav", volume)
}

export function playCompletionSound(volume = 1) {
  playFile("complete.wav", volume)
}

export function playDeleteSound(volume = 1) {
  playFile("delete.wav", volume)
}

export function playPowerUpSound(volume = 1) {
  return new Promise((resolve) => {
    const src = preloaded["Power UP_1.wav"]
    if (!src) { resolve(); return }
    const a = src.cloneNode()
    a.volume = Math.max(0, Math.min(1, Number(volume) || 0))
    a.onended = resolve
    a.onerror = resolve
    a.play().catch(resolve)
  })
}
