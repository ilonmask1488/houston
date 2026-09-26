/*
  Короткие звуки отклика — синтезируются Web Audio, без файлов.
  Выключаются в настройках (sfx), вибрация — отдельно (vibration, только Android).
*/
import { loadSettings } from '../settings/settings'

type Sfx = 'correct' | 'wrong' | 'combo' | 'launch' | 'tap'

let ctx: AudioContext | null = null
let enabled = { sfx: true, vibration: true }

/** Обновляется из App при изменении настроек. */
export function configureFeedback(s: { sfx: boolean; vibration: boolean }): void {
  enabled = s
}

void loadSettings()
  .then((s) => configureFeedback(s))
  .catch(() => {})

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/**
  Радиошум для игры «Помехи»: белый шум через полосовой фильтр (как в эфире), тихо.
  Возвращает функцию «выключить». При выключенных эффектах — ничего не играет.
*/
export function startStatic(volume: number): () => void {
  if (!enabled.sfx) return () => {}
  const c = audioCtx()
  if (!c) return () => {}
  const len = c.sampleRate * 2
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  src.loop = true
  const band = c.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 1800
  band.Q.value = 0.7
  const g = c.createGain()
  g.gain.setValueAtTime(0, c.currentTime)
  g.gain.linearRampToValueAtTime(volume, c.currentTime + 0.15)
  src.connect(band).connect(g).connect(c.destination)
  src.start()
  return () => {
    try {
      g.gain.linearRampToValueAtTime(0, c.currentTime + 0.15)
      src.stop(c.currentTime + 0.2)
    } catch {
      /* уже остановлен */
    }
  }
}

function tone(c: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.12) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, c.currentTime + start)
  g.gain.setValueAtTime(0, c.currentTime + start)
  g.gain.linearRampToValueAtTime(vol, c.currentTime + start + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur)
  o.connect(g).connect(c.destination)
  o.start(c.currentTime + start)
  o.stop(c.currentTime + start + dur + 0.02)
}

export function sfx(kind: Sfx): void {
  if (enabled.vibration && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    const pattern: Record<Sfx, number | number[]> = {
      correct: 15,
      wrong: [30, 40, 30],
      combo: [15, 30, 15, 30, 15],
      launch: [40, 60, 80],
      tap: 8,
    }
    try {
      navigator.vibrate(pattern[kind])
    } catch {
      /* не поддерживается */
    }
  }
  if (!enabled.sfx) return
  const c = audioCtx()
  if (!c) return
  switch (kind) {
    case 'correct':
      tone(c, 660, 0, 0.12)
      tone(c, 990, 0.08, 0.18)
      break
    case 'wrong':
      tone(c, 220, 0, 0.18, 'triangle', 0.1)
      break
    case 'combo':
      ;[660, 830, 990, 1320].forEach((f, i) => tone(c, f, i * 0.06, 0.14))
      break
    case 'launch':
      for (let i = 0; i < 10; i++) tone(c, 180 + i * 70, i * 0.07, 0.2, 'sawtooth', 0.05)
      break
    case 'tap':
      tone(c, 880, 0, 0.05, 'sine', 0.05)
      break
  }
}
