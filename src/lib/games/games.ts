/*
  Мини-игры (ТЗ §7.2): короткие, с личным рекордом и комбо.
  «Помехи» — быстрая фраза, что сказали? Скорость растёт с серией.
  «Быстрый ответ» — вопрос, 5 секунд на начало, очки за вовремя начатый ответ и речь без долгих пауз.
  «Скорочтение» — технический абзац, найти предложение с ответом, пока идёт таймер.
*/
import { content } from '../../content'
import type { MinimalPair, VoiceId } from '../../content/types'
import type { Progress } from '../course/progress'
import { db } from '../db/db'
import { rng, shuffle } from '../intake/plan'
import { localDate } from '../progress/streak'

export type GameId = 'static' | 'quick' | 'speedread' | 'twins' | 'ff'
export const GAME_IDS: GameId[] = ['static', 'quick', 'speedread', 'twins', 'ff']
/** Игры на время (60 с): «Помехи», «Близнецы», «Ложные друзья». */
export const TIMED_SECONDS = 60
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

/* ——— Близнецы и Ложные друзья ——— */

const STD_VOICES: VoiceId[] = ['us-f', 'us-m', 'gb-f', 'gb-m']

/**
  Голос в «Близнецах»: пока серия короткая — привычный (по настройкам); с серии 4 — любой
  из четырёх (американский и британский, мужской и женский): тот же звук разными голосами сложнее.
*/
export function twinsVoice(streak: number, base: VoiceId, random: () => number): VoiceId {
  return streak < 4 ? base : STD_VOICES[Math.floor(random() * STD_VOICES.length)]!
}

/** Раунд «Близнецов»: пара и какое из двух слов прозвучит; та же пара два раза подряд не выпадает. */
export function twinsRound(random: () => number, after?: string): { pair: MinimalPair; pick: 0 | 1 } {
  const pool = content.pairs.filter((p) => p.id !== after)
  return { pair: pool[Math.floor(random() * pool.length)]!, pick: random() < 0.5 ? 0 : 1 }
}

/* ——— Скорочтение ——— */

export const SPEEDREAD_ROUNDS = 6

/** Раунд «Скорочтения»: вопрос и абзац(ы) текста, где спрятан ответ. */
export type SpeedreadItem = { id: string; text: string; q: string; key: string; paragraphs: string[] }

/**
  Раунды: вопросы «найди ответ» из текстов Техдока. На первом уровне — один абзац с ответом,
  дальше — абзац с ответом и соседний: искать приходится в большем тексте.
*/
export function speedreadRounds(seed: number, n = SPEEDREAD_ROUNDS): SpeedreadItem[] {
  const all: SpeedreadItem[] = []
  for (const t of content.texts.filter((x) => !x.module.startsWith('boss')))
    t.find.forEach((f, i) => {
      const p = t.paragraphs.findIndex((x) => x.toLowerCase().includes(f.key.toLowerCase()))
      if (p < 0) return
      const other = p + 1 < t.paragraphs.length ? p + 1 : p - 1
      const paragraphs = t.level === 1 || other < 0 ? [t.paragraphs[p]!] : [t.paragraphs[Math.min(p, other)]!, t.paragraphs[Math.max(p, other)]!]
      all.push({ id: `${t.id}#${i}`, text: t.id, q: f.q, key: f.key, paragraphs })
    })
  // Не больше одного вопроса на текст за игру
  const seen = new Set<string>()
  return shuffle(all, rng(seed))
    .filter((x) => !seen.has(x.text) && seen.add(x.text))
    .slice(0, n)
}

/** Время на раунд: 40 секунд, с каждым верным подряд на 4 меньше, не меньше 15. */
export function speedreadSeconds(streak: number): number {
  return Math.max(15, 40 - 4 * streak)
}

/** Очки: 10 за верный ответ плюс по 2 за каждую оставшуюся секунду, умножить на комбо. */
export function speedreadPoints(left: number, multiplier: number): number {
  return (10 + 2 * left) * multiplier
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
