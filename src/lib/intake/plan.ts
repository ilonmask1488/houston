/*
  План вводного теста: какие слова спросить, в каком порядке, и шаги теста.
  Слова берутся случайно из пула каждой полосы — повторный тест через 2 месяца спросит другие.
*/
import type { BandId, IntakeContent } from '../../content/types'
import type { IntakeDraft, IntakeStep } from './score'

export const WORDS_PER_BAND = 8
export const PSEUDO_PER_BAND = 2
/** Повторный тест — не раньше чем через 60 дней. */
export const RETAKE_DAYS = 60

/** Детерминированный генератор (mulberry32) — план можно воспроизвести в тестах. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(arr: T[], random: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export function vocabPlan(c: IntakeContent, seed: number): IntakeDraft['vocabPlan'] {
  const random = rng(seed)
  const pseudo = shuffle(c.pseudo, random)
  const plan: IntakeDraft['vocabPlan'] = []
  c.bands.forEach((b, i) => {
    const words = shuffle(
      c.words.filter((w) => w.band === b.id),
      random,
    ).slice(0, WORDS_PER_BAND)
    const fakes = pseudo.slice(i * PSEUDO_PER_BAND, (i + 1) * PSEUDO_PER_BAND)
    const block = shuffle([...words.map((w) => ({ w: w.w, band: b.id as BandId | 'pseudo' })), ...fakes.map((w) => ({ w, band: 'pseudo' as const }))], random)
    plan.push(...block.map((x) => ({ ...x, after: b.id })))
  })
  return plan
}

export function newDraft(c: IntakeContent, now = Date.now()): IntakeDraft {
  return {
    version: 1,
    startedAt: now,
    step: 'intro',
    vocabPlan: vocabPlan(c, now),
    vocab: [],
    skipped: [],
    listening: [],
    pairs: [],
    reading: [],
    speaking: [],
  }
}

export const STEPS: IntakeStep[] = ['intro', 'vocab', 'listening', 'pairs', 'reading', 'speaking', 'done']

export function nextStep(step: IntakeStep): IntakeStep {
  return STEPS[Math.min(STEPS.length - 1, STEPS.indexOf(step) + 1)]!
}

/** Проверять ли перевод у этого «знаю»: каждое второе «знаю» в полосе (первое — всегда). */
export function shouldVerify(d: IntakeDraft, band: BandId | 'pseudo'): boolean {
  if (band === 'pseudo') return false
  const yesInBand = d.vocab.filter((a) => a.band === band && a.yes).length
  return yesInBand % 2 === 0
}

/** Варианты перевода для проверки: верный + 3 из той же полосы (или соседних). */
export function translationOptions(c: IntakeContent, word: string, random: () => number): { options: string[]; answer: number } {
  const w = c.words.find((x) => x.w === word)
  if (!w) return { options: [], answer: -1 }
  const same = c.words.filter((x) => x.band === w.band && x.w !== word)
  const others = shuffle(same, random)
    .slice(0, 3)
    .map((x) => x.ru)
  const options = shuffle([w.ru, ...others], random)
  return { options, answer: options.indexOf(w.ru) }
}

/** Когда можно пройти тест снова. */
export function retakeAt(lastAt: number): number {
  return lastAt + RETAKE_DAYS * 24 * 60 * 60 * 1000
}
