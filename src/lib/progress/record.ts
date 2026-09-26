/*
  Запись ответов, времени и сигнала в базу. Всё, что «считается прогрессом», проходит здесь.
*/
import { db } from '../db/db'
import type { AnswerRow } from '../db/types'
import { localDate } from './streak'

export async function recordAnswer(a: Omit<AnswerRow, 'id' | 'at'>): Promise<void> {
  await db.answers.add({ ...a, at: Date.now() })
}

/** Добавить время, сигнал и речь к сегодняшнему дню. */
export async function addToday(p: { seconds?: number; signal?: number; spokenMs?: number; spoken?: number; newItems?: number }): Promise<void> {
  const date = localDate()
  await db.transaction('rw', db.days, async () => {
    const d = (await db.days.get(date)) ?? { date, seconds: 0, signal: 0, spokenSeconds: 0, spokenCount: 0, newItems: 0 }
    d.seconds += Math.round(p.seconds ?? 0)
    d.signal += Math.round(p.signal ?? 0)
    d.spokenSeconds += Math.round((p.spokenMs ?? 0) / 1000)
    d.spokenCount += p.spoken ?? 0
    d.newItems += p.newItems ?? 0
    await db.days.put(d)
  })
}
