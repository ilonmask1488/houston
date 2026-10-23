/*
  «Колода» мини-игры: задания не повторяются, пока не показана большая часть пула,
  а те, на которых недавно ошибся, возвращаются чаще. Что показано — в meta (`deck:<игра>`),
  поэтому повторы не начинаются заново в каждом раунде; ошибки — из таблицы answers.
*/
import { db, type AppDB } from '../db/db'
import type { AnswerRow } from '../db/types'

/** Сколько последних показов помнить: не больше 400, чтобы строка в meta не разрасталась. */
const MEMORY = 400
/** Доля пула, которая должна пройти, прежде чем задание снова может выпасть. */
const WINDOW = 0.75
/** Вероятность взять задание с недавней ошибкой, если такие есть среди непоказанных. */
const MISTAKE_SHARE = 0.35

export class Deck<T extends { id: string }> {
  readonly game: string
  readonly pool: T[]
  readonly mistakes: Set<string>
  private seen: string[]
  private readonly key: `deck:${string}`
  private readonly database: AppDB
  constructor(game: string, pool: T[], seen: string[] = [], mistakes: Set<string> = new Set(), database: AppDB = db) {
    this.game = game
    this.pool = pool
    this.mistakes = mistakes
    this.database = database
    const ids = new Set(pool.map((x) => x.id))
    this.seen = seen.filter((id) => ids.has(id))
    this.key = `deck:${game}`
  }

  /** Следующее задание: не из недавних; иногда — из ошибок. `exclude` никогда не выпадает (если есть выбор). */
  draw(random: () => number, exclude?: string): T {
    if (!this.pool.length) throw new Error(`пустая колода ${this.game}`)
    const window = Math.floor(this.pool.length * WINDOW)
    const recent = new Set(this.seen.slice(-window))
    if (exclude) recent.add(exclude)
    let cand = this.pool.filter((x) => !recent.has(x.id))
    if (!cand.length) cand = this.pool.filter((x) => x.id !== exclude)
    if (!cand.length) cand = this.pool
    const missed = cand.filter((x) => this.mistakes.has(x.id))
    const from = missed.length && random() < MISTAKE_SHARE ? missed : cand
    const item = from[Math.floor(random() * from.length)]!
    this.seen.push(item.id)
    if (this.seen.length > MEMORY) this.seen = this.seen.slice(-MEMORY)
    return item
  }

  /** Ответ дан: верный убирает задание из ошибок, неверный — добавляет. */
  result(id: string, correct: boolean): void {
    if (correct) this.mistakes.delete(id)
    else this.mistakes.add(id)
  }

  save(): Promise<void> {
    return this.database.setMeta(this.key, JSON.stringify(this.seen))
  }
}

/** Задания, на которых последний ответ за `days` дней был неверным. */
export function lastWrong(answers: Pick<AnswerRow, 'item' | 'correct' | 'at'>[]): Set<string> {
  const last = new Map<string, { at: number; correct: boolean }>()
  for (const a of answers) {
    const cur = last.get(a.item)
    if (!cur || a.at >= cur.at) last.set(a.item, { at: a.at, correct: a.correct })
  }
  return new Set([...last].filter(([, v]) => !v.correct).map(([id]) => id))
}

/** Колода из базы: что показано и где ошибался (ответы этого вида за 30 дней). */
export async function loadDeck<T extends { id: string }>(
  game: string,
  pool: T[],
  answerKinds: string[],
  database: AppDB = db,
  now = Date.now(),
): Promise<Deck<T>> {
  let seen: string[] = []
  try {
    const raw = await database.getMeta<string>(`deck:${game}`)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) seen = parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    seen = []
  }
  const ids = new Set(pool.map((x) => x.id))
  const answers = await database.answers
    .where('at')
    .above(now - 30 * 86_400_000)
    .filter((a) => answerKinds.includes(a.kind) && ids.has(a.item))
    .toArray()
  return new Deck(game, pool, seen, lastWrong(answers), database)
}
