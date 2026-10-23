import { describe, expect, it } from 'vitest'
import type { DictWord } from '../../content/types'
import { db } from '../db/db'
import { addDailyWords, pickDailyWords } from './daily'

const w = (id: string, band: DictWord['band'], extra: Partial<DictWord> = {}): DictWord => ({ id, text: id, ru: id, band, reviewed: false, ...extra })

describe('слова дня', () => {
  const words = [
    w('w-t1', 'tech', { topic: 'mat' }),
    w('w-t2', 'tech', { topic: 'space' }),
    w('w-t3', 'tech', { topic: 'space' }),
    w('w-t4', 'tech', { topic: 'mat' }),
    w('w-g100', 'ngsl1', { rank: 100 }),
    w('w-g900', 'ngsl2', { rank: 900 }),
    w('w-g1000', 'ngsl2', { rank: 1000 }),
    w('w-g1200', 'ngsl3', { rank: 1200 }),
    w('w-n1', 'nawl'),
  ]

  it('термины и общие слова рядом с уровнем, без уже выученных', () => {
    const got = pickDailyWords(words, new Set(['w-g1000']), 1000, 0, 2, 2).map((x) => x.id)
    expect(got.filter((id) => id.startsWith('w-t'))).toHaveLength(2)
    // от 80% словаря: 900 и 1200, а 100 — слишком просто, 1000 уже в карточках
    expect(got.filter((id) => id.startsWith('w-g'))).toEqual(['w-g900', 'w-g1200'])
  })

  it('кончились частые — берёт академические', () => {
    const got = pickDailyWords(words, new Set(), 5000, 0, 0, 1).map((x) => x.id)
    expect(got).toEqual(['w-n1'])
  })

  it('добавляет один раз в день', async () => {
    await db.open()
    const first = await addDailyWords(1500, db, '2026-10-01')
    expect(first).toBeGreaterThan(0)
    expect(await addDailyWords(1500, db, '2026-10-01')).toBe(0)
    expect(await addDailyWords(1500, db, '2026-10-02')).toBeGreaterThan(0)
  })
})
