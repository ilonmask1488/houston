/*
  Кривая основного тона (ТЗ §7.4): pitchy по кадрам 40 мс с шагом 10 мс,
  перевод в полутоны относительно медианы говорящего — мужской и женский голос становятся сравнимы.
  Это подсказка для глаз, а не оценка: ни чисел «правильно/неправильно», ни баллов.
*/
import { PitchDetector } from 'pitchy'

export type PitchPoint = { t: number; hz: number }
/** Точка графика: x — доля от озвученного участка (0…1), y — полутоны от медианы; null — разрыв линии. */
export type CurvePoint = { x: number; st: number } | null

const MIN_HZ = 65
const MAX_HZ = 600
/** Подобрано на наших образцах: 0.8 теряет больше половины кадров у низких мужских голосов. */
const CLARITY = 0.6
/** Разрыв линии, если пауза дольше этого (с). */
const GAP_S = 0.12

/** Сырые точки: время и частота озвученных кадров. */
export function extractPitch(samples: Float32Array, sampleRate: number): PitchPoint[] {
  const win = 2 ** Math.ceil(Math.log2(sampleRate * 0.04))
  const hop = Math.round(sampleRate * 0.01)
  if (samples.length < win) return []
  const detector = PitchDetector.forFloat32Array(win)
  detector.minVolumeDecibels = -60

  // Порог громкости — от самого громкого кадра: тихие хвосты и дыхание не в счёт.
  const rms: number[] = []
  for (let i = 0; i + win <= samples.length; i += hop) {
    let sum = 0
    for (let j = i; j < i + win; j++) sum += samples[j]! * samples[j]!
    rms.push(Math.sqrt(sum / win))
  }
  const loud = Math.max(...rms) * 0.05

  const raw: PitchPoint[] = []
  for (let k = 0, i = 0; i + win <= samples.length; k++, i += hop) {
    if (rms[k]! < loud) continue
    const [hz, clarity] = detector.findPitch(samples.subarray(i, i + win), sampleRate)
    if (clarity >= CLARITY && hz >= MIN_HZ && hz <= MAX_HZ) raw.push({ t: (i + win / 2) / sampleRate, hz })
  }
  return dropOctaveJumps(raw)
}

/** Скачки на октаву — типичная ошибка автокорреляции: выбрасываем точки далеко от соседей. */
function dropOctaveJumps(points: PitchPoint[]): PitchPoint[] {
  return points.filter((p, i) => {
    const near = points.slice(Math.max(0, i - 3), i + 4).map((q) => q.hz)
    const med = median(near)
    return Math.abs(semitones(p.hz, med)) < 6
  })
}

export function semitones(hz: number, ref: number): number {
  return 12 * Math.log2(hz / ref)
}

export function median(values: number[]): number {
  if (!values.length) return NaN
  const s = [...values].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/** Кривая для графика: время растянуто на озвученный участок, высота — полутоны от медианы. */
export function toCurve(points: PitchPoint[]): CurvePoint[] {
  if (points.length < 3) return []
  const ref = median(points.map((p) => p.hz))
  const t0 = points[0]!.t
  const span = Math.max(points[points.length - 1]!.t - t0, 1e-3)
  const out: CurvePoint[] = []
  points.forEach((p, i) => {
    if (i > 0 && p.t - points[i - 1]!.t > GAP_S) out.push(null)
    out.push({ x: (p.t - t0) / span, st: semitones(p.hz, ref) })
  })
  return smooth(out)
}

/** Сглаживание скользящим средним по 3 точкам внутри каждого отрезка. */
function smooth(curve: CurvePoint[]): CurvePoint[] {
  return curve.map((p, i) => {
    if (!p) return p
    const a = curve[i - 1]
    const b = curve[i + 1]
    const ns = [a?.st, p.st, b?.st].filter((v): v is number => v !== undefined)
    return { x: p.x, st: ns.reduce((s, v) => s + v, 0) / ns.length }
  })
}

/** Ошибка разбора с понятной причиной: что именно не раскодировалось и код браузера. */
export class DecodeError extends Error {
  readonly what: 'sample' | 'mine'
  readonly code: string
  constructor(what: 'sample' | 'mine', code: string) {
    super(`${what}: ${code}`)
    this.what = what
    this.code = code
  }
}

type OfflineCtor = new (channels: number, length: number, sampleRate: number) => OfflineAudioContext

/**
  Раскодировать звук (образец или запись) в моно-отсчёты.
  OfflineAudioContext не трогает динамик и микрофон: на iPhone обычный AudioContext делит аудиосессию
  с записью и распознаванием и после них может отказывать. Нет Offline — запасной обычный.
*/
export async function decodeAudio(url: string): Promise<{ samples: Float32Array; sampleRate: number }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  if (!buf.byteLength) throw new Error('empty')
  const w = window as unknown as { OfflineAudioContext?: OfflineCtor; webkitOfflineAudioContext?: OfflineCtor; webkitAudioContext?: typeof AudioContext }
  const Offline = w.OfflineAudioContext ?? w.webkitOfflineAudioContext
  const ctx: BaseAudioContext = Offline ? new Offline(1, 1, 44100) : new (window.AudioContext ?? w.webkitAudioContext!)()
  try {
    const audio = await new Promise<AudioBuffer>((resolve, reject) => {
      // Старый Safari знает только форму с колбэками.
      const r = ctx.decodeAudioData(buf, resolve, (e) => reject(e ?? new Error('decode'))) as Promise<AudioBuffer> | undefined
      r?.then(resolve, reject)
    })
    const ch = audio.getChannelData(0)
    return { samples: new Float32Array(ch), sampleRate: audio.sampleRate }
  } finally {
    if ('close' in ctx) void (ctx as AudioContext).close().catch(() => {})
  }
}

function codeOf(e: unknown): string {
  if (e instanceof DOMException || e instanceof Error) return e.name === 'Error' ? e.message : e.name
  return String(e)
}

/** Кривые образца и записи — по очереди, чтобы не держать два разбора звука сразу. */
export async function curvesOf(sampleUrl: string, mineUrl: string): Promise<{ sample: CurvePoint[]; mine: CurvePoint[] }> {
  const one = async (url: string, what: 'sample' | 'mine') => {
    try {
      const { samples, sampleRate } = await decodeAudio(url)
      return toCurve(extractPitch(samples, sampleRate))
    } catch (e) {
      console.error(`pitch ${what}`, e)
      throw new DecodeError(what, codeOf(e))
    }
  }
  const sample = await one(sampleUrl, 'sample')
  const mine = await one(mineUrl, 'mine')
  return { sample, mine }
}
