/* Сегодняшний сеанс: собрать план по прогрессу или обновить уже начатый. */
import { loadProgress } from '../course/progress'
import { db } from '../db/db'
import type { SessionRow } from '../db/types'
import { lastIntake } from '../intake/store'
import { localDate } from '../progress/streak'
import { reviewQueue } from '../srs/cards'
import { currentSpeed, planSegments, refreshSegments } from './session'

export async function getTodaySession(minutes: number): Promise<SessionRow> {
  const date = localDate()
  const intake = await lastIntake()
  const progress = await loadProgress()
  const queue = await reviewQueue(200)
  const speed = await currentSpeed(intake)
  const fresh = planSegments({ minutes, date, due: queue.cards, progress, intake, speed })
  const existing = await db.sessions.get(date)
  if (existing) {
    const segments = refreshSegments(existing.segments, fresh)
    if (JSON.stringify(segments) !== JSON.stringify(existing.segments)) {
      const row = { ...existing, segments, finishedAt: segments.every((s) => s.status !== 'pending') ? existing.finishedAt : undefined }
      await db.sessions.put(row)
      return row
    }
    return existing
  }
  const row: SessionRow = { date, segments: fresh, startedAt: Date.now(), seconds: 0, signal: 0, correct: 0, total: 0, spokenMs: 0 }
  await db.sessions.put(row)
  return row
}
