import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { AppDB } from './db'
import { CURRENT_SCHEMA_VERSION, SCHEMA_VERSIONS } from './schema'

/*
  Данные, какими их записывала каждая историческая версия схемы.
  Добавляешь версию схемы — добавь сюда её фикстуру и ожидания после миграции.
*/
const FIXTURES: Record<number, Record<string, unknown[]>> = {
  1: {
    settings: [{ id: 'main', sessionMinutes: 45, theme: 'dark', variant: 'gb' }],
    meta: [{ key: 'firstLaunchAt', value: 1_700_000_000_000 }],
    cards: [
      {
        id: 'c-clarify:1',
        itemId: 'c-clarify',
        kind: 1,
        due: 1_700_000_000_000,
        stability: 2.3,
        difficulty: 5.1,
        elapsedDays: 0,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        state: 1,
      },
    ],
    reviews: [{ id: 1, cardId: 'c-clarify:1', at: 1_700_000_000_000, rating: 3, durationMs: 2400 }],
    days: [{ date: '2026-09-26', seconds: 1800, signal: 120, spokenSeconds: 240, spokenCount: 12, newItems: 8 }],
    achievements: [{ id: 'no-problem', unlockedAt: 1_700_000_000_000 }],
    gameRecords: [{ game: 'static', best: 42, weekBest: 30, weekStart: '2026-09-21' }],
    answers: [
      { id: 1, at: 1_700_000_000_000, kind: 'listen', source: 'intake', track: 'air', item: 'il-01', expected: 'a', given: 'b', correct: false, speed: 1, accent: 'gb' },
    ],
    intake: [{ id: 1, at: 1_700_000_000_000, cefr: 'B1', tracks: { air: 40, call: 30, doc: 60, mail: 50, clean: 45 }, result: { version: 1 } }],
    moduleProgress: [{ moduleId: 'air-1', startedAt: 1, done: ['x'] }],
  },
}

let counter = 0
const names: string[] = []
function freshName(): string {
  const name = `test-migrations-${counter++}`
  names.push(name)
  return name
}

afterEach(async () => {
  for (const n of names.splice(0)) await Dexie.delete(n)
})

describe('миграции схемы', () => {
  it('для каждой версии схемы есть фикстура', () => {
    for (const v of SCHEMA_VERSIONS) expect(FIXTURES[v.version], `фикстура для v${v.version}`).toBeDefined()
  })

  it('версии идут по возрастанию без повторов', () => {
    const versions = SCHEMA_VERSIONS.map((v) => v.version)
    expect(versions).toEqual([...versions].sort((a, b) => a - b))
    expect(new Set(versions).size).toBe(versions.length)
  })

  for (const v of SCHEMA_VERSIONS) {
    it(`данные версии ${v.version} переживают обновление до версии ${CURRENT_SCHEMA_VERSION}`, async () => {
      const name = freshName()
      const old = new Dexie(name)
      for (const h of SCHEMA_VERSIONS.filter((x) => x.version <= v.version)) {
        const ver = old.version(h.version).stores(h.stores)
        if (h.upgrade) ver.upgrade(h.upgrade)
      }
      await old.open()
      const fixture = FIXTURES[v.version]!
      for (const [table, rows] of Object.entries(fixture)) await old.table(table).bulkPut(rows)
      old.close()

      const current = new AppDB(name)
      await current.open()
      expect(current.verno).toBe(CURRENT_SCHEMA_VERSION)
      for (const [table, rows] of Object.entries(fixture)) {
        expect(await current.table(table).count(), `таблица ${table}`).toBe(rows.length)
      }
      expect((await current.settings.get('main'))?.sessionMinutes).toBe(45)
      expect(await current.getMeta('firstLaunchAt')).toBe(1_700_000_000_000)
      expect((await current.intake.toArray())[0]?.cefr).toBe('B1')
      current.close()
    })
  }
})
