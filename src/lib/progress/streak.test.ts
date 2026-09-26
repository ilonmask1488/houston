import { describe, expect, it } from 'vitest'
import { addDays, AIR_DAY_SECONDS, computeStreak } from './streak'

const T = '2026-09-26'
const full = AIR_DAY_SECONDS
const days = (entries: [number, number][]) => new Map(entries.map(([offset, s]) => [addDays(T, -offset), s]))

describe('дни в эфире', () => {
  it('день засчитывается от 10 минут', () => {
    expect(computeStreak(days([[0, full - 1]]), T).days).toBe(0)
    expect(computeStreak(days([[0, full]]), T).days).toBe(1)
  })

  it('незакрытое «сегодня» не обрывает серию', () => {
    expect(computeStreak(days([[1, full], [2, full], [3, full]]), T)).toMatchObject({ days: 3, todayCounted: false })
  })

  it('один пропуск в неделю закрывается резервным каналом', () => {
    expect(computeStreak(days([[0, full], [1, full], [3, full], [4, full]]), T)).toMatchObject({ days: 4, reserveUsed: true })
  })

  it('два пропуска за неделю обрывают серию', () => {
    expect(computeStreak(days([[0, full], [2, full], [4, full], [5, full]]), T).days).toBe(2)
  })

  it('пропуски с разницей в неделю оба закрываются', () => {
    const e: [number, number][] = []
    for (let i = 0; i <= 16; i++) if (i !== 2 && i !== 10) e.push([i, full])
    expect(computeStreak(days(e), T).days).toBe(15)
  })

  it('addDays переходит через месяц и год', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
})
