import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/db'
import type { SessionRow } from '../db/types'
import { updateSegment } from '../session/session'
import { addToday } from './record'
import { localDate } from './streak'
import { msToMidnight } from './useToday'

const at = (h: number, m: number, day = 23) => new Date(2026, 9, day, h, m)

afterEach(async () => {
  vi.useRealTimers()
  await db.sessions.clear()
  await db.days.clear()
})

describe('переход через полночь', () => {
  it('блок, начатый в 23:55 и законченный в 00:05, засчитывается дню начала', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(at(23, 55))
    const started = localDate()
    const row: SessionRow = {
      date: started,
      segments: [{ id: 's1', block: 'air', kind: 'steps', label: 'listen', minutes: 3, status: 'pending' }],
      startedAt: Date.now(),
      seconds: 0,
      signal: 0,
      correct: 0,
      total: 0,
      spokenMs: 0,
    }
    await db.sessions.put(row)
    vi.setSystemTime(at(0, 5, 24))
    expect(localDate()).not.toBe(started)
    await updateSegment('s1', { status: 'done' }, { seconds: 600, signal: 5, correct: 1, total: 1, spokenMs: 0 }, started)
    await addToday({ seconds: 600, date: started })
    const saved = await db.sessions.get(started)
    expect(saved?.segments[0]?.status).toBe('done')
    expect(saved?.seconds).toBe(600)
    expect((await db.days.get(started))?.seconds).toBe(600)
    expect(await db.days.get(localDate())).toBeUndefined()
  })

  it('без даты — сегодняшний день', async () => {
    await addToday({ seconds: 60 })
    expect((await db.days.get(localDate()))?.seconds).toBe(60)
  })

  it('таймер до полуночи', () => {
    expect(msToMidnight(at(23, 59))).toBe(61_000)
    expect(msToMidnight(at(0, 0))).toBe(24 * 3600_000 + 1000)
  })
})
