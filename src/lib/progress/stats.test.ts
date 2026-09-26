import { describe, expect, it } from 'vitest'
import type { AnswerRow } from '../db/types'
import { avgLatency, listeningBySpeed, minutesByDay, weakTags } from './stats'
import { addDays } from './streak'

const T = '2026-09-27'
const a = (x: Partial<AnswerRow>): AnswerRow => ({ at: 1, kind: 'listen', source: 'session', track: 'air', item: 'l', expected: '', given: '', correct: true, ...x })

describe('статистика', () => {
  it('минуты и минуты речи по дням, пропуски — нули', () => {
    const m = minutesByDay([{ date: T, seconds: 1800, signal: 0, spokenSeconds: 270, spokenCount: 9, newItems: 0 }], T)
    expect(m).toHaveLength(14)
    expect(m.at(-1)).toEqual({ date: T, minutes: 30, spokenMinutes: 4.5 })
    expect(m.at(-2)).toEqual({ date: addDays(T, -1), minutes: 0, spokenMinutes: 0 })
  })

  it('комфортная скорость — самая высокая с 5+ ответами и 70%+', () => {
    const answers = [
      ...Array.from({ length: 6 }, () => a({ speed: 1 })),
      ...Array.from({ length: 5 }, (_, i) => a({ speed: 1.25, correct: i < 2 })),
      a({ speed: 1.3, source: 'game' }),
      a({ speed: 0.75, source: 'intake', correct: false }),
    ]
    const r = listeningBySpeed(answers)
    expect(r.comfort).toBe(1)
    expect(r.buckets.find((b) => b.speed === 1.25)).toMatchObject({ correct: 3, total: 6 })
    expect(r.buckets.find((b) => b.speed === 0.75)!.total).toBe(0)
  })

  it('время до начала ответа и слабые явления', () => {
    expect(avgLatency([a({ track: 'call', latencyMs: 2000 }), a({ track: 'call', latencyMs: 4000 }), a({})])).toBe(3000)
    const w = weakTags([...Array.from({ length: 4 }, (_, i) => a({ tag: 'air-assim', correct: i === 0 })), ...Array.from({ length: 4 }, () => a({ tag: 'air-weak' }))])
    expect(w).toEqual([{ tag: 'air-assim', errorRate: 0.75, total: 4 }])
  })
})
