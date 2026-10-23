import { describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { rng } from '../intake/plan'
import { Deck, lastWrong, loadDeck } from './deck'

const pool = Array.from({ length: 20 }, (_, i) => ({ id: `x${i}` }))

describe('колода мини-игры', () => {
  it('не повторяет задание, пока не пройдёт три четверти пула', () => {
    const d = new Deck('t', pool)
    const r = rng(1)
    const first = Array.from({ length: 15 }, () => d.draw(r).id)
    expect(new Set(first).size).toBe(15)
  })

  it('exclude не выпадает даже в маленьком пуле', () => {
    const d = new Deck('t', pool.slice(0, 2))
    const r = rng(2)
    for (let i = 0; i < 20; i++) expect(d.draw(r, 'x0').id).toBe('x1')
  })

  it('ошибки возвращаются чаще: при равных условиях их доля заметно выше', () => {
    const r = rng(3)
    let hits = 0
    for (let n = 0; n < 200; n++) {
      const d = new Deck('t', pool, [], new Set(['x7']))
      if (d.draw(r).id === 'x7') hits++
    }
    // без веса было бы ~1/20 = 10 из 200
    expect(hits).toBeGreaterThan(40)
  })

  it('верный ответ снимает задание из ошибок', () => {
    const d = new Deck('t', pool, [], new Set(['x1']))
    d.result('x1', true)
    d.result('x2', false)
    expect([...d.mistakes]).toEqual(['x2'])
  })

  it('последний ответ решает: ошибся, потом ответил верно — уже не ошибка', () => {
    const w = lastWrong([
      { item: 'a', correct: false, at: 1 },
      { item: 'a', correct: true, at: 2 },
      { item: 'b', correct: true, at: 1 },
      { item: 'b', correct: false, at: 3 },
    ])
    expect([...w]).toEqual(['b'])
  })

  it('показанное сохраняется между раундами; ошибки читаются из ответов', async () => {
    await db.open()
    const d = await loadDeck('test-deck', pool, ['listen'])
    const r = rng(4)
    const shown = Array.from({ length: 10 }, () => d.draw(r).id)
    await d.save()
    await db.answers.add({ at: Date.now(), kind: 'listen', source: 'game', item: 'x19', expected: '', given: '', correct: false })
    const again = await loadDeck('test-deck', pool, ['listen'])
    expect(again.mistakes.has('x19')).toBe(true)
    const next = Array.from({ length: 5 }, () => again.draw(r).id)
    for (const id of next) expect(shown).not.toContain(id)
  })

  it('битая строка в базе не ломает игру', async () => {
    await db.open()
    await db.setMeta('deck:broken', '{not json')
    const d = await loadDeck('broken', pool, ['listen'])
    expect(pool.map((x) => x.id)).toContain(d.draw(rng(5)).id)
  })
})
