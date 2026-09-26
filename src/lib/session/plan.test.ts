import { describe, expect, it } from 'vitest'
import { planSession } from './plan'

describe('раскладка сеанса', () => {
  it('30 минут — ровно как в ТЗ', () => {
    expect(planSession(30).map((b) => [b.id, b.minutes])).toEqual([
      ['warmup', 3],
      ['review', 7],
      ['air', 6],
      ['call', 8],
      ['rotation', 6],
    ])
  })

  it('сумма совпадает с длительностью, каждый блок ≥ 2 минут, говорение есть всегда', () => {
    for (const total of [20, 30, 45]) {
      const plan = planSession(total)
      expect(plan.reduce((s, b) => s + b.minutes, 0)).toBe(total)
      expect(plan.every((b) => b.minutes >= 2)).toBe(true)
      expect(plan.find((b) => b.id === 'call')!.minutes).toBeGreaterThanOrEqual(5)
    }
  })

  it('время начала блоков идёт подряд', () => {
    const plan = planSession(45)
    plan.forEach((b, i) => expect(b.startsAt).toBe(i ? plan[i - 1]!.startsAt + plan[i - 1]!.minutes : 0))
  })
})
