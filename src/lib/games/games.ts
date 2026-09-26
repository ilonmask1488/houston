/*
  Мини-игры (ТЗ §7.2): короткие, с личным рекордом и комбо.
  «Помехи» — быстрая фраза, что сказали? Скорость растёт с серией.
  «Быстрый ответ» — вопрос, 5 секунд на начало, очки за вовремя начатый ответ и речь без долгих пауз.
*/
import { content } from '../../content'
import type { VoiceId } from '../../content/types'
import type { Progress } from '../course/progress'
import { db } from '../db/db'
import { rng, shuffle } from '../intake/plan'
import { localDate } from '../progress/streak'

export type GameId = 'static' | 'quick'
export const STATIC_SECONDS = 60
export const QUICK_ROUNDS = 3

export type StaticItem = { id: string; text: string; say?: string; options: string[]; voice: VoiceId }

/**
  Материал «Помех»: фразы, которые уже встречались (пройденные в модулях), и фразы вводного теста.
  Если набралось мало — добавляются фразы первого модуля Эфира (новые, но короткие).
*/
export function staticPool(progress: Progress): StaticItem[] {
  const seen = new Set([...progress.values()].flatMap((r) => r.done))
  const learned = content.phrases.filter((p) => seen.has(p.id) && !p.voices)
  const intake = content.intake.listening.map((l) => ({ id: l.id, text: l.text, say: l.say, options: l.options, voice: l.voice }))
  const pool: StaticItem[] = [...learned, ...intake]
  if (pool.length < 12) pool.push(...content.phrases.filter((p) => p.module === 'air-weak' && !seen.has(p.id)))
  return pool
}

/** Скорость «Помех»: от базовой, +0.05 за каждый верный подряд, не быстрее 1.5. */
export function staticSpeed(base: number, streak: number): number {
  return Math.min(1.5, Math.round((base + 0.05 * streak) * 100) / 100)
}

/** Громкость радиошума: чуть растёт с серией, но не мешает разобрать речь. */
export function staticNoise(streak: number): number {
  return Math.min(0.06, 0.015 + streak * 0.004)
}

export function comboPoints(multiplier: number): number {
  return 10 * multiplier
}

/** Очки за ответ в «Быстром ответе». Без записи — по самооценке (onTime, clean) и условной длительности. */
export function quickPoints(r: { onTime: boolean; speechMs: number; longPauses: number; measured: boolean }): { onTime: number; duration: number; clean: number; total: number } {
  const onTime = r.onTime ? 30 : 0
  const speech = r.measured ? r.speechMs : 20_000
  const duration = Math.min(40, Math.round((speech / 30_000) * 40))
  const clean = r.longPauses === 0 && speech >= 10_000 ? 20 : 0
  return { onTime, duration, clean, total: onTime + duration + clean }
}

export function quickQuestions(seed: number, n = QUICK_ROUNDS) {
  return shuffle(content.questions, rng(seed)).slice(0, n)
}

/** Сохранить рекорд (за всё время и за неделю). Возвращает, побит ли рекорд. */
export async function saveRecord(game: GameId, score: number): Promise<{ best: number; weekBest: number; isBest: boolean }> {
  const week = weekStart(localDate())
  return db.transaction('rw', db.gameRecords, async () => {
    const cur = (await db.gameRecords.get(game)) ?? { game, best: 0, weekBest: 0, weekStart: week }
    const weekBest = cur.weekStart === week ? cur.weekBest : 0
    const row = { game, best: Math.max(cur.best, score), weekBest: Math.max(weekBest, score), weekStart: week }
    await db.gameRecords.put(row)
    return { best: row.best, weekBest: row.weekBest, isBest: score > cur.best && score > 0 }
  })
}

/** Понедельник недели (YYYY-MM-DD). */
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
  return localDate(dt)
}

export function gameRandom(): () => number {
  return rng((Date.now() ^ (Math.random() * 1e9)) >>> 0)
}
