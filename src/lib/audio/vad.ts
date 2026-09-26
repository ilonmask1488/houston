/*
  Детектор речи по уровню громкости (VAD). Из кадров «время → уровень, дБ» получаем:
  когда начал говорить, сколько говорил и сколько было длинных пауз.
  Порог адаптивный: шум первых 300 мс + 12 дБ, но не тише −50 дБ.
  Это не распознавание — только «звучит голос или нет», поэтому работает офлайн и на любом устройстве.
*/

export type Frame = { t: number; db: number }

export type SpeechStats = {
  /** когда начал говорить, мс от начала записи; нет — голоса не было */
  startMs?: number
  /** сколько звучал голос, мс (короткие паузы до 300 мс внутри слов считаются речью) */
  speechMs: number
  /** паузы длиннее 2 секунд между кусками речи */
  longPauses: number
  /** самая длинная пауза внутри ответа, мс */
  maxPauseMs: number
}

export const LONG_PAUSE_MS = 2000
const BRIDGE_MS = 300
const MIN_SPEECH_MS = 150

export function threshold(frames: Frame[]): number {
  const head = frames.filter((f) => f.t < 300)
  const floor = head.length ? head.reduce((s, f) => s + f.db, 0) / head.length : -60
  return Math.max(-50, floor + 12)
}

export function analyzeFrames(frames: Frame[], thr = threshold(frames)): SpeechStats {
  if (frames.length < 2) return { speechMs: 0, longPauses: 0, maxPauseMs: 0 }
  // Куски, где громкость выше порога.
  const segs: [number, number][] = []
  let start: number | null = null
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!
    const loud = f.db >= thr
    if (loud && start === null) start = f.t
    if (!loud && start !== null) {
      segs.push([start, f.t])
      start = null
    }
  }
  if (start !== null) segs.push([start, frames[frames.length - 1]!.t])
  // Склеить куски с короткими паузами внутри слов, выбросить щелчки короче 150 мс.
  const merged: [number, number][] = []
  for (const s of segs) {
    const last = merged[merged.length - 1]
    if (last && s[0] - last[1] <= BRIDGE_MS) last[1] = s[1]
    else merged.push([s[0], s[1]])
  }
  const speech = merged.filter(([a, b]) => b - a >= MIN_SPEECH_MS)
  if (!speech.length) return { speechMs: 0, longPauses: 0, maxPauseMs: 0 }
  let longPauses = 0
  let maxPauseMs = 0
  for (let i = 1; i < speech.length; i++) {
    const gap = speech[i]![0] - speech[i - 1]![1]
    maxPauseMs = Math.max(maxPauseMs, gap)
    if (gap > LONG_PAUSE_MS) longPauses++
  }
  return {
    startMs: speech[0]![0],
    speechMs: speech.reduce((s, [a, b]) => s + (b - a), 0),
    longPauses,
    maxPauseMs,
  }
}

/** Оценка по распознаванию, когда записи нет: начало — первое слово, пауза — промежуток между кусками текста. */
export function statsFromText(startMs: number | undefined, textTimes: number[]): SpeechStats {
  if (startMs === undefined || !textTimes.length) return { speechMs: 0, longPauses: 0, maxPauseMs: 0 }
  let longPauses = 0
  let maxPauseMs = 0
  for (let i = 1; i < textTimes.length; i++) {
    const gap = textTimes[i]! - textTimes[i - 1]!
    maxPauseMs = Math.max(maxPauseMs, gap)
    // промежуточные результаты приходят примерно раз в полсекунды, пока человек говорит
    if (gap > LONG_PAUSE_MS + 500) longPauses++
  }
  return { startMs, speechMs: Math.max(0, textTimes[textTimes.length - 1]! - startMs), longPauses, maxPauseMs }
}
