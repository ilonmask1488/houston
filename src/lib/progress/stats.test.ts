import { describe, expect, it } from 'vitest'
import type { AnswerRow } from '../db/types'
import { avgLatency, listeningBySpeed, minutesByDay, pairsByModule, readingStats, weakTags, wordsByBand } from './stats'
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

describe('чтение', () => {
  it('скорость — медиана последних текстов, короткие замеры не считаются', () => {
    const r = (words: number, sec: number) => a({ kind: 'read', track: 'doc', expected: String(words), given: String(sec) })
    const s = readingStats([r(200, 60), r(200, 120), r(200, 80), r(200, 5)])
    expect(s.wpm).toBe(150)
    expect(s.texts).toBe(3)
  })

  it('поиск ответа: доля и среднее время верных', () => {
    const f = (correct: boolean, ms: number) => a({ kind: 'find', track: 'doc', correct, latencyMs: ms })
    expect(readingStats([f(true, 10_000), f(true, 20_000), f(false, 40_000)])).toMatchObject({ found: 2, findTotal: 3, findMs: 15_000 })
    expect(readingStats([]).wpm).toBeNull()
  })

  it('слова по полосам частотности, свои — отдельно', () => {
    const bands: Record<string, string> = { 'w-test': 'ngsl1', 'w-strain': 'tech', 'w-yield': 'nawl' }
    expect(wordsByBand(['w-strain', 'w-test', 'u-foo', 'w-yield', 'w-test'], (id) => bands[id])).toEqual([
      { band: 'ngsl1', n: 1 },
      { band: 'nawl', n: 1 },
      { band: 'tech', n: 1 },
      { band: 'own', n: 1 },
    ])
  })
})

describe('произношение', () => {
  it('пары на слух по модулям: от 3 ответов, худшие — первыми', () => {
    const p = (tag: string, correct: boolean) => a({ kind: 'pair', track: 'clean', tag, correct })
    const r = pairsByModule([p('clean-th', false), p('clean-th', false), p('clean-th', true), p('clean-wv', true), p('clean-wv', true), p('clean-wv', true), p('clean-h', false)])
    expect(r.map((x) => x.tag)).toEqual(['clean-th', 'clean-wv'])
    expect(r[0]).toMatchObject({ correct: 1, total: 3 })
  })
})