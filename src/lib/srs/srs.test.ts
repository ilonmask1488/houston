import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { AppDB } from '../db/db'
import type { CardRow } from '../db/types'
import { loadDictionary } from '../dict/dict'
import { addChunkCards, addPhraseCard, addWordCards, answerCard, mixKinds, retentionStats, reviewQueue, UNLOCK_DELAY_MS } from './cards'
await loadDictionary()
import { formatInterval, newCard, parseCardId, previewIntervals, review } from './srs'

const DAY = 24 * 60 * 60 * 1000
const T0 = Date.UTC(2026, 8, 27, 9)

let n = 0
const opened: AppDB[] = []
function freshDb(): AppDB {
  const d = new AppDB(`test-srs-${n++}`)
  opened.push(d)
  return d
}
afterEach(async () => {
  for (const d of opened.splice(0)) {
    d.close()
    await Dexie.delete(d.name)
  }
})

describe('FSRS-обёртка', () => {
  it('«Хорошо» откладывает дальше, чем «Снова»', () => {
    const c = newCard('c-intro-01', 1, T0)
    expect(c.due).toBe(T0)
    expect(review(c, 3, T0).due).toBeGreaterThan(review(c, 1, T0).due)
  })

  it('интервалы растут: Снова < Трудно ≤ Хорошо < Легко', () => {
    let c = newCard('c-intro-01', 1, T0)
    c = review(c, 3, T0)
    c = review(c, 3, c.due)
    const p = previewIntervals(c, c.due)
    expect(p[1]).toBeLessThan(p[3])
    expect(p[2]).toBeLessThanOrEqual(p[3])
    expect(p[3]).toBeLessThan(p[4])
  })

  it('в базе — только числа (бэкап без потерь)', () => {
    const c = review(newCard('c-intro-01', 1, T0), 3, T0)
    expect(JSON.parse(JSON.stringify(c))).toEqual(c)
  })

  it('разбор id карточки и подписи интервалов', () => {
    expect(parseCardId('c-intro-01:2')).toEqual({ itemId: 'c-intro-01', kind: 2 })
    expect(formatInterval(5 * 60_000)).toBe('5 мин')
    expect(formatInterval(3 * DAY)).toBe('3 д')
    expect(formatInterval(90 * DAY)).toBe('3 мес')
  })
})

describe('карточки в базе', () => {
  it('изученный чанк даёт карточки 1 и 3 (на слух — к следующему дню), без дублей', async () => {
    const d = freshDb()
    expect(await addChunkCards('c-intro-01', d, T0)).toBe(2)
    expect(await addChunkCards('c-intro-01', d, T0)).toBe(0)
    expect((await d.cards.get('c-intro-01:3'))!.due).toBe(T0 + UNLOCK_DELAY_MS)
  })

  it('после «понял значение» открывается «скажи вслух»', async () => {
    const d = freshDb()
    await addChunkCards('c-intro-01', d, T0)
    expect(await answerCard('c-intro-01:1', 1, 3000, 0.9, d, T0)).toEqual([])
    expect(await answerCard('c-intro-01:1', 3, 3000, 0.9, d, T0 + 60_000)).toEqual([2])
    expect(await d.cards.get('c-intro-01:2')).toBeDefined()
    expect(await d.reviews.count()).toBe(2)
  })

  it('непойманная фраза возвращается карточкой на слух; очередь — только существующее', async () => {
    const d = freshDb()
    expect(await addPhraseCard('l-weak-01', d, T0)).toBe(true)
    await d.cards.put(newCard('c-deleted-99', 1, T0))
    const q = await reviewQueue(50, d, T0 + DAY)
    expect(q.cards.map((c) => c.id)).toEqual(['l-weak-01:3'])
    expect(q.totalDue).toBe(1)
  })

  it('слово из словаря и своё слово: карточки, «скажи сам» после «понял», очередь их видит', async () => {
    const d = freshDb()
    expect(await addWordCards('w-nozzle', d, T0)).toBe(2) // технический термин со звуком: 1 и 3
    expect(await addWordCards('w-take', d, T0)).toBe(1) // общее слово без звука: только 1
    await d.userWords.put({ id: 'u-outgas', text: 'outgas', ru: 'газовыделение', createdAt: T0 })
    await d.cards.put(newCard('u-outgas', 1, T0))
    expect(await answerCard('w-take:1', 3, 1000, 0.9, d, T0)).toEqual([2])
    const q = await reviewQueue(50, d, T0 + DAY)
    expect(q.cards.map((c) => c.itemId)).toEqual(expect.arrayContaining(['w-nozzle', 'u-outgas', 'w-take']))
  })

  it('типы в очереди перемешаны: не больше 3 одного типа подряд', () => {
    const mk = (i: number, kind: 1 | 2 | 3): CardRow => ({ ...newCard(`c-${i}`, kind, T0) })
    const mixed = mixKinds([...Array.from({ length: 6 }, (_, i) => mk(i, 1)), mk(10, 2), mk(11, 3)])
    let run = 1
    let max = 1
    for (let i = 1; i < mixed.length; i++) {
      run = mixed[i]!.kind === mixed[i - 1]!.kind ? run + 1 : 1
      max = Math.max(max, run)
    }
    expect(max).toBeLessThanOrEqual(3)
  })

  it('удержание считается по зрелым карточкам', async () => {
    const d = freshDb()
    await d.reviews.bulkAdd([
      { cardId: 'a', at: T0, rating: 3, durationMs: 1, stateBefore: 2 },
      { cardId: 'b', at: T0, rating: 1, durationMs: 1, stateBefore: 2 },
      { cardId: 'c', at: T0, rating: 1, durationMs: 1, stateBefore: 0 },
    ])
    expect(await retentionStats(d, 10 * DAY, T0 + 1)).toMatchObject({ reviews: 3, mature: 2, retention: 0.5 })
  })
})
