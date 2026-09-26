/*
  Достижения. Названия и описания — в ru.ts (achievements).
  Проверяются после упражнения, игры или теста; новые возвращаются для показа в итогах.
*/
import { db } from '../db/db'
import { computeStreak, localDate } from './streak'

export type AchievementId =
  | 'first-contact'
  | 'first-words'
  | 'no-problem'
  | 'no-pause'
  | 'night'
  | 'air-3'
  | 'air-7'
  | 'talk-10min'
  | 'fast-ear'
  | 'chunks-25'
  | 'static-100'
  | 'module-first'
  | 'talk-60min'

type Check = () => Promise<boolean>

async function streakDays(): Promise<number> {
  const days = await db.days.toArray()
  return computeStreak(new Map(days.map((d) => [d.date, d.seconds])), localDate()).days
}

const CHECKS: Record<AchievementId, Check> = {
  'first-contact': async () => (await db.intake.count()) > 0,
  'first-words': async () => (await db.answers.filter((a) => (a.speechMs ?? 0) > 3000).count()) > 0,
  night: async () => {
    const h = new Date().getHours()
    return h >= 23 || h < 4
  },
  'air-3': async () => (await streakDays()) >= 3,
  'air-7': async () => (await streakDays()) >= 7,
  'talk-10min': async () => (await db.days.toArray()).reduce((s, d) => s + d.spokenSeconds, 0) >= 600,
  'no-problem': async () => (await db.sessions.filter((s) => !!s.finishedAt && s.segments.some((x) => x.status === 'done')).count()) > 0,
  // Быстрый ответ начат вовремя и сказан без долгих пауз
  'no-pause': async () => (await db.answers.where('kind').equals('quick').filter((a) => a.correct && (a.latencyMs ?? 99_999) <= 5000).count()) > 0,
  'fast-ear': async () => (await db.answers.where('kind').equals('listen').filter((a) => a.correct && (a.speed ?? 0) >= 1.25).count()) >= 10,
  'chunks-25': async () => (await db.cards.where('kind').equals(1).filter((c) => c.itemId.startsWith('c-')).count()) >= 25,
  'static-100': async () => ((await db.gameRecords.get('static'))?.best ?? 0) >= 100,
  'module-first': async () => (await db.moduleProgress.filter((m) => !!m.completedAt).count()) > 0,
  'talk-60min': async () => (await db.days.toArray()).reduce((s, d) => s + d.spokenSeconds, 0) >= 3600,
}

export const ACHIEVEMENT_IDS = Object.keys(CHECKS) as AchievementId[]

/** Проверить все ещё не полученные достижения; вернуть новые. */
export async function evaluateAchievements(): Promise<AchievementId[]> {
  const have = new Set((await db.achievements.toArray()).map((a) => a.id))
  const fresh: AchievementId[] = []
  for (const id of ACHIEVEMENT_IDS) {
    if (have.has(id)) continue
    try {
      if (await CHECKS[id]()) fresh.push(id)
    } catch (e) {
      console.error('achievement', id, e)
    }
  }
  if (fresh.length) await db.achievements.bulkPut(fresh.map((id) => ({ id, unlockedAt: Date.now() })))
  return fresh
}
