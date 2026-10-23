/* Сегодняшний сеанс: собрать план по прогрессу или обновить уже начатый. */
import { loadProgress } from '../course/progress'
import { db } from '../db/db'
import type { SessionRow } from '../db/types'
import { lastIntake } from '../intake/store'
import { localDate } from '../progress/streak'
import { reviewQueue } from '../srs/cards'
import { addDailyWords } from '../srs/daily'
import { readyStories } from '../story/store'
import { currentSpeed, planSegments, refreshSegments, trackAccuracy } from './session'

export async function getTodaySession(minutes: number): Promise<SessionRow> {
  const date = localDate()
  const intake = await lastIntake()
  const progress = await loadProgress()
  // «Слова дня» — после вводного теста (по нему ясен уровень словаря); ошибка словаря не ломает занятие
  // Со следующего дня после теста: день теста и так насыщенный, а в плане первого дня повторения ещё нет
  if (intake && localDate(new Date(intake.at)) < date) await addDailyWords(intake.result.vocabSize).catch((e) => console.error(e))
  const queue = await reviewQueue(200)
  const speed = await currentSpeed(intake)
  const stories = (await readyStories()).map((x) => ({ id: x.id, trained: x.trained }))
  const recent = await db.answers.where('at').above(Date.now() - 14 * 86_400_000).toArray()
  const accuracy = trackAccuracy(recent)
  const fresh = planSegments({ minutes, date, due: queue.cards, progress, intake, speed, stories, accuracy })
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
