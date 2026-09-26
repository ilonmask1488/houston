/*
  Вводный тест: подсчёт профиля по трекам и ориентировочного уровня CEFR.
  Всё здесь — чистые функции над ответами (IntakeDraft), чтобы их можно было проверить тестами.
  Оценка намеренно грубая и честно так и подписана в интерфейсе.

  Словарь: формат «знаю / не знаю» с псевдословами (как в тестах Мира, X_Lex) + проверка части «знаю»
  выбором перевода. Доля «знаю» по полосе поправляется на ложные «знаю» у псевдослов:
  rate = (hit − fa) / (1 − fa).
*/
import type { BandId, IntakeBand, Module, TrackId } from '../../content/types'

export type Speed = 0.75 | 1 | 1.25
export const SPEEDS: Speed[] = [0.75, 1, 1.25]

export type VocabAnswer = { w: string; band: BandId | 'pseudo'; yes: boolean; verified?: boolean }
export type ListenAnswer = { id: string; speed: Speed; accent: string; tag: string; correct: boolean }
export type PairAnswer = { id: string; tag: string; correct: boolean }
export type ReadAnswer = { id: string; level: 1 | 2; correct: number; total: number; seconds: number; words: number }
export type SpeakAnswer = {
  id: string
  /** самооценка: 1 — не смог начать, 2 — с трудом, 3 — нормально, 4 — легко */
  self: 1 | 2 | 3 | 4
  latencyMs?: number
  speechMs?: number
  longPauses?: number
  words?: number
  transcript?: string
}

export type IntakeStep = 'intro' | 'vocab' | 'listening' | 'pairs' | 'reading' | 'speaking' | 'done'

export type IntakeDraft = {
  version: 1
  startedAt: number
  step: IntakeStep
  /** порядок слов теста словаря (реальные и псевдослова вперемешку по полосам) */
  vocabPlan: { w: string; band: BandId | 'pseudo'; after: BandId }[]
  vocab: VocabAnswer[]
  /** полосы, пропущенные из-за адаптивной остановки */
  skipped: BandId[]
  listening: ListenAnswer[]
  pairs: PairAnswer[]
  reading: ReadAnswer[]
  speaking: SpeakAnswer[]
}

export const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
export type Cefr = (typeof CEFR)[number]

export type BandResult = { band: BandId; asked: number; rate: number; known: number; skipped: boolean }

export type IntakeResult = {
  version: 1
  bands: BandResult[]
  falseAlarm: number
  verifyPass: number | null
  ngslKnown: number
  vocabSize: number
  listening: { score: number; comfort: Speed | null; byAccent: Record<string, { correct: number; total: number }> }
  pairs: { score: number; weak: string[] }
  reading: { score: number; wpm: number | null }
  speaking: { score: number; avgLatencyMs: number | null; avgSpeechMs: number | null; measured: boolean }
  levels: { vocab: number; listening: number; reading: number; speaking: number }
  cefr: Cefr
  tracks: Record<TrackId, number>
  /** явления связной речи и звуки, где были ошибки */
  weakTags: string[]
}

/* ——— Словарь ——— */

export function bandRates(
  answers: VocabAnswer[],
  bands: IntakeBand[],
  skipped: BandId[] = [],
): { bands: BandResult[]; falseAlarm: number; verifyPass: number | null } {
  const pseudo = answers.filter((a) => a.band === 'pseudo')
  const fa = pseudo.length ? pseudo.filter((a) => a.yes).length / pseudo.length : 0
  const checked = answers.filter((a) => a.band !== 'pseudo' && a.yes && a.verified !== undefined)
  const verifyPass = checked.length ? checked.filter((a) => a.verified).length / checked.length : null
  const pass = verifyPass ?? 1
  const out = bands.map((b): BandResult => {
    const own = answers.filter((a) => a.band === b.id)
    if (!own.length) return { band: b.id, asked: 0, rate: 0, known: 0, skipped: skipped.includes(b.id) }
    let hit = 0
    for (const a of own) {
      if (!a.yes) continue
      if (a.verified === true) hit += 1
      else if (a.verified === undefined) hit += pass
    }
    const raw = hit / own.length
    const rate = fa >= 1 ? 0 : Math.max(0, Math.min(1, (raw - fa) / (1 - fa)))
    return { band: b.id, asked: own.length, rate, known: Math.round(rate * b.size), skipped: false }
  })
  return { bands: out, falseAlarm: fa, verifyPass }
}

/** После полосы: стоит ли идти дальше (адаптивная остановка — не мучить словами, которых точно нет). */
export function continueAfterBand(result: BandResult, bandIndex: number): boolean {
  return bandIndex < 1 || result.rate >= 0.25
}

/* ——— Аудирование: «лестница» скоростей ——— */

/** Следующая скорость: верно — ступенью выше, ошибка — ниже. */
export function nextSpeed(current: Speed, correct: boolean): Speed {
  const i = SPEEDS.indexOf(current)
  return SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, i + (correct ? 1 : -1)))]!
}

const SPEED_WEIGHT: Record<Speed, number> = { 0.75: 0.55, 1: 1, 1.25: 1.3 }

export function listeningScore(answers: ListenAnswer[]): IntakeResult['listening'] {
  if (!answers.length) return { score: 0, comfort: null, byAccent: {} }
  const got = answers.reduce((s, a) => s + (a.correct ? SPEED_WEIGHT[a.speed] : 0), 0)
  const score = Math.round((100 * got) / (answers.length * SPEED_WEIGHT[1.25]))
  let comfort: Speed | null = null
  for (const sp of SPEEDS) {
    const at = answers.filter((a) => a.speed === sp)
    const ok = at.filter((a) => a.correct).length
    if (ok >= 1 && ok >= at.length - ok) comfort = sp
  }
  const byAccent: Record<string, { correct: number; total: number }> = {}
  for (const a of answers) {
    const c = (byAccent[a.accent] ??= { correct: 0, total: 0 })
    c.total++
    if (a.correct) c.correct++
  }
  return { score: Math.min(100, score), comfort, byAccent }
}

/* ——— Чтение и говорение ——— */

export function readingScore(answers: ReadAnswer[]): IntakeResult['reading'] {
  let score = 0
  for (const a of answers) score += (a.total ? a.correct / a.total : 0) * 50
  const words = answers.reduce((s, a) => s + a.words, 0)
  const secs = answers.reduce((s, a) => s + a.seconds, 0)
  return { score: Math.round(score), wpm: secs > 0 ? Math.round((words / secs) * 60) : null }
}

/** Нужен ли второй, более трудный текст: да, если первый понят хотя бы на 2 из 3. */
export function needsHarderText(first: ReadAnswer): boolean {
  return first.correct >= Math.ceil((first.total * 2) / 3)
}

const lin = (x: number, x0: number, x1: number) => Math.max(0, Math.min(1, (x - x0) / (x1 - x0)))

export function speakingScore(answers: SpeakAnswer[]): IntakeResult['speaking'] {
  if (!answers.length) return { score: 0, avgLatencyMs: null, avgSpeechMs: null, measured: false }
  const measured = answers.filter((a) => a.speechMs !== undefined)
  const per = answers.map((a) => {
    const self = (a.self - 1) / 3
    if (a.speechMs === undefined) return self
    const dur = lin(a.speechMs, 5_000, 30_000)
    const lat = a.latencyMs === undefined ? self : 1 - lin(a.latencyMs, 2_000, 8_000)
    return 0.5 * self + 0.25 * dur + 0.25 * lat
  })
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
  return {
    score: Math.round((100 * per.reduce((s, x) => s + x, 0)) / per.length),
    avgLatencyMs: avg(measured.filter((a) => a.latencyMs !== undefined).map((a) => a.latencyMs!)),
    avgSpeechMs: avg(measured.map((a) => a.speechMs!)),
    measured: measured.length > 0,
  }
}

/* ——— Итог ——— */

function levelBy(score: number, cuts: [number, number, number, number]): number {
  return cuts.findIndex((c) => score < c) === -1 ? 4 : cuts.findIndex((c) => score < c)
}

export function vocabLevel(ngslCoverage: number, nawlRate: number): number {
  const lv = levelBy(ngslCoverage * 100, [30, 50, 70, 85])
  return lv === 3 && nawlRate >= 0.6 ? 4 : lv
}

export function computeResult(d: IntakeDraft, bands: IntakeBand[]): IntakeResult {
  const v = bandRates(d.vocab, bands, d.skipped)
  const ngslSize = bands.filter((b) => b.source === 'ngsl').reduce((s, b) => s + b.size, 0)
  const ngslKnown = v.bands.filter((b) => b.band.startsWith('ngsl')).reduce((s, b) => s + b.known, 0)
  const rateOf = (id: BandId) => v.bands.find((b) => b.band === id)?.rate ?? 0
  const coverage = ngslSize ? ngslKnown / ngslSize : 0
  const listening = listeningScore(d.listening)
  const pairsScore = d.pairs.length ? Math.round((100 * d.pairs.filter((p) => p.correct).length) / d.pairs.length) : 0
  const reading = readingScore(d.reading)
  const speaking = speakingScore(d.speaking)

  const levels = {
    vocab: vocabLevel(coverage, rateOf('nawl')),
    listening: levelBy(listening.score, [25, 45, 65, 85]),
    reading: levelBy(reading.score, [20, 45, 70, 90]),
    speaking: levelBy(speaking.score, [25, 45, 65, 85]),
  }
  // Осторожно: среднее с округлением вниз — лучше недооценить и дать лёгкий старт.
  const mean = (levels.vocab + levels.listening + levels.reading + levels.speaking) / 4
  const cefr = CEFR[Math.max(0, Math.min(4, Math.floor(mean)))]!

  const tracks: Record<TrackId, number> = {
    air: listening.score,
    call: speaking.score,
    doc: Math.round(0.7 * reading.score + 30 * rateOf('nawl')),
    mail: Math.round(50 * coverage + 30 * rateOf('bsl') + 0.2 * reading.score),
    clean: Math.round(0.8 * pairsScore + 0.2 * speaking.score),
  }
  const weakTags = [...new Set([...d.listening.filter((a) => !a.correct).map((a) => a.tag), ...d.pairs.filter((p) => !p.correct).map((p) => p.tag)])]
  return {
    version: 1,
    bands: v.bands,
    falseAlarm: v.falseAlarm,
    verifyPass: v.verifyPass,
    ngslKnown,
    vocabSize: ngslKnown + v.bands.filter((b) => !b.band.startsWith('ngsl')).reduce((s, b) => s + b.known, 0),
    listening,
    pairs: { score: pairsScore, weak: [...new Set(d.pairs.filter((p) => !p.correct).map((p) => p.tag))] },
    reading,
    speaking,
    levels,
    cefr,
    tracks,
    weakTags,
  }
}

/** Уровень трека 1–5 по баллу 0–100. */
export function trackLevel(score: number): 1 | 2 | 3 | 4 | 5 {
  return (Math.min(4, Math.floor(Math.max(0, score) / 20)) + 1) as 1 | 2 | 3 | 4 | 5
}

/** Какой тег закрывает какой модуль: ошибка в теге тянет старт к этому модулю. */
export const TAG_MODULE: Record<string, string> = {
  weak: 'air-weak',
  linking: 'air-link',
  elision: 'air-elision',
  assimilation: 'air-assim',
  contraction: 'air-contract',
  th: 'clean-th',
  wv: 'clean-wv',
  vowels: 'clean-vowels',
  final: 'clean-final',
  ng: 'clean-ng',
}

/**
  Стартовый модуль трека: первый модуль уровня трека, но не дальше модуля,
  где в тесте была ошибка (слабое место лучше закрыть сразу).
*/
export function startModule(modules: Module[], score: number, weakTags: string[]): Module | undefined {
  const sorted = [...modules].sort((a, b) => a.order - b.order)
  const lv = trackLevel(score)
  const byLevel = sorted.find((m) => m.level >= lv) ?? sorted[sorted.length - 1]
  const weak = sorted.find((m) => weakTags.some((t) => TAG_MODULE[t] === m.id))
  if (weak && byLevel && weak.order < byLevel.order) return weak
  return byLevel
}
