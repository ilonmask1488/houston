import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { moduleItems } from '../course/progress'
import { db } from '../db/db'
import { quickPoints, saveRecord, speedreadPoints, speedreadRounds, speedreadSeconds, staticNoise, staticPool, staticSpeed, twinsRound, twinsVoice, weekStart } from './games'
import { rng } from '../intake/plan'

describe('Помехи', () => {
  it('скорость растёт с серией и упирается в 1.5', () => {
    expect(staticSpeed(1, 0)).toBe(1)
    expect(staticSpeed(1, 4)).toBe(1.2)
    expect(staticSpeed(0.75, 100)).toBe(1.5)
  })

  it('шум чуть громче с серией, но с потолком', () => {
    expect(staticNoise(0)).toBeLessThan(staticNoise(5))
    expect(staticNoise(100)).toBe(0.06)
  })

  it('материал: пройденные фразы + фразы вводного теста; в начале — подмешиваются фразы первого модуля', () => {
    const empty = staticPool(new Map())
    expect(empty.some((p) => p.id.startsWith('il-'))).toBe(true)
    expect(empty.some((p) => p.id.startsWith('l-weak'))).toBe(true)
    const learned = staticPool(new Map([['air-link', { moduleId: 'air-link', startedAt: 1, done: moduleItems('air-link') }]]))
    expect(learned.some((p) => p.id.startsWith('l-link'))).toBe(true)
    for (const p of learned) expect(p.options).toContain(p.text)
  })
})

describe('Быстрый ответ', () => {
  it('очки: вовремя, длительность до 40, без пауз', () => {
    expect(quickPoints({ onTime: true, speechMs: 30_000, longPauses: 0, measured: true })).toEqual({ onTime: 30, duration: 40, clean: 20, total: 90 })
    expect(quickPoints({ onTime: false, speechMs: 6000, longPauses: 2, measured: true }).total).toBe(8)
    expect(quickPoints({ onTime: true, speechMs: 0, longPauses: 0, measured: false }).total).toBe(30 + 27 + 20)
  })
})

describe('рекорды', () => {
  it('рекорд за всё время и за неделю', async () => {
    await db.open()
    expect(await saveRecord('static', 50)).toMatchObject({ best: 50, isBest: true })
    expect(await saveRecord('static', 30)).toMatchObject({ best: 50, weekBest: 50, isBest: false })
    expect(weekStart('2026-09-27')).toBe('2026-09-21')
    db.close()
    await Dexie.delete(db.name)
  })
})

describe('Скорочтение', () => {
  it('шесть раундов из разных текстов, ответ всегда в показанном тексте', () => {
    const rounds = speedreadRounds(42)
    expect(rounds).toHaveLength(6)
    expect(new Set(rounds.map((r) => r.text)).size).toBe(6)
    for (const r of rounds) expect(r.paragraphs.join(' ').toLowerCase(), r.id).toContain(r.key.toLowerCase())
  })

  it('таймер короче с серией, но не меньше 15 секунд; очки за скорость и комбо', () => {
    expect(speedreadSeconds(0)).toBe(40)
    expect(speedreadSeconds(3)).toBe(28)
    expect(speedreadSeconds(20)).toBe(15)
    expect(speedreadPoints(0, 1)).toBe(10)
    expect(speedreadPoints(20, 2)).toBe(100)
  })
})

describe('Близнецы', () => {
  it('пара не повторяется два раза подряд, звучит одно из двух слов', () => {
    const r = rng(7)
    let prev: string | undefined
    for (let i = 0; i < 50; i++) {
      const { pair, pick } = twinsRound(r, prev)
      expect(pair.id).not.toBe(prev)
      expect([0, 1]).toContain(pick)
      prev = pair.id
    }
  })

  it('голос: сначала привычный, с серии 4 — разные', () => {
    const r = rng(1)
    expect(twinsVoice(0, 'us-f', r)).toBe('us-f')
    const voices = new Set(Array.from({ length: 40 }, () => twinsVoice(5, 'us-f', r)))
    expect(voices.size).toBeGreaterThan(1)
  })
})