/*
  Карточки в базе: создание, очередь на повторение, ответ.
  Чанк после изучения даёт карточки 1 (текст → значение) и 3 (на слух → значение);
  фраза Эфира, которую не поймал, — карточку 3: слабые места возвращаются чаще.
*/
import { chunkById, phraseById } from '../../content'
import { dictById, dictionaryLoaded, loadDictionary } from '../dict/dict'
import { db, type AppDB } from '../db/db'
import type { CardRow } from '../db/types'
import { cardId, newCard, review, unlocksAfter, type CardKind, type Grade14 } from './srs'

/** Больше этого — не заваливаем, а берём самые срочные и честно говорим об этом. */
export const DUE_OVERLOAD = 150
/** Открытые позже типы карточек появляются не сразу, а к следующему занятию. */
export const UNLOCK_DELAY_MS = 12 * 60 * 60 * 1000

const userWordIds = new Set<string>()

/** Слова (словарь и свои) проверяются по загруженным источникам — см. prepareItems. */
export function itemExists(itemId: string): boolean {
  if (itemId.startsWith('w-')) return !dictionaryLoaded() || dictById.has(itemId)
  if (itemId.startsWith('u-')) return userWordIds.has(itemId)
  return chunkById.has(itemId) || phraseById.has(itemId)
}

/** Загрузить словарь и список своих слов, если в карточках есть слова. */
export async function prepareItems(database: AppDB = db): Promise<void> {
  const hasWords = (await database.cards.filter((c) => c.itemId.startsWith('w-') || c.itemId.startsWith('u-')).count()) > 0
  if (!hasWords) return
  await loadDictionary()
  userWordIds.clear()
  for (const w of await database.userWords.toArray()) userWordIds.add(w.id)
}

/** Слово в карточки: «слово → значение»; у технического термина со звуком — ещё «на слух». */
export async function addWordCards(itemId: string, database: AppDB = db, now = Date.now()): Promise<number> {
  let n = 0
  await database.transaction('rw', database.cards, async () => {
    if (await ensure(database, itemId, 1, now)) n++
    const w = dictById.get(itemId)
    if (w?.voices?.length && (await ensure(database, itemId, 3, now, UNLOCK_DELAY_MS))) n++
  })
  if (itemId.startsWith('u-')) userWordIds.add(itemId)
  return n
}

async function ensure(database: AppDB, itemId: string, kind: CardKind, now: number, delay = 0): Promise<boolean> {
  const id = cardId(itemId, kind)
  if (await database.cards.get(id)) return false
  await database.cards.put({ ...newCard(itemId, kind, now), due: now + delay })
  return true
}

/** Чанк изучен: карточки «текст → значение» сразу и «на слух» к следующему дню. */
export async function addChunkCards(chunkId: string, database: AppDB = db, now = Date.now()): Promise<number> {
  let n = 0
  await database.transaction('rw', database.cards, async () => {
    if (await ensure(database, chunkId, 1, now)) n++
    if (await ensure(database, chunkId, 3, now, UNLOCK_DELAY_MS)) n++
  })
  return n
}

/** Фразу не поймал на слух — она вернётся карточкой «на слух → понять». */
export async function addPhraseCard(phraseId: string, database: AppDB = db, now = Date.now()): Promise<boolean> {
  return ensure(database, phraseId, 3, now, 60 * 60 * 1000)
}

export type ReviewQueue = { cards: CardRow[]; totalDue: number; capped: boolean }

/** Очередь на сегодня: сначала самые просроченные, типы вперемешку. */
export async function reviewQueue(limit: number, database: AppDB = db, now = Date.now()): Promise<ReviewQueue> {
  await prepareItems(database)
  const due = await database.cards.where('due').belowOrEqual(now).toArray()
  const live = due.filter((c) => itemExists(c.itemId)).sort((a, b) => a.due - b.due)
  const picked = live.slice(0, limit)
  return { cards: mixKinds(picked), totalDue: live.length, capped: live.length > limit }
}

/** Перемешать по типам: не больше 3 карточек одного типа подряд, где это возможно. */
export function mixKinds(cards: CardRow[]): CardRow[] {
  const queues = new Map<number, CardRow[]>()
  for (const c of cards) queues.set(c.kind, [...(queues.get(c.kind) ?? []), c])
  const out: CardRow[] = []
  let last = -1
  let run = 0
  while (out.length < cards.length) {
    const options = [...queues.entries()].filter(([, q]) => q.length).sort((a, b) => b[1].length - a[1].length)
    const pick = options.find(([k]) => k !== last || run < 3) ?? options[0]!
    const c = pick[1].shift()!
    run = c.kind === last ? run + 1 : 1
    last = c.kind
    out.push(c)
  }
  return out
}

/** Ответ: обновить карточку, записать в журнал, открыть следующие типы. */
export async function answerCard(id: string, grade: Grade14, durationMs: number, retention: number, database: AppDB = db, now = Date.now()): Promise<CardKind[]> {
  const opened: CardKind[] = []
  await database.transaction('rw', database.cards, database.reviews, async () => {
    const row = await database.cards.get(id)
    if (!row) return
    await database.cards.put(review(row, grade, now, retention))
    await database.reviews.add({ cardId: id, at: now, rating: grade, durationMs, stateBefore: row.state, kind: row.kind })
    for (const kind of unlocksAfter(row, grade)) if (await ensure(database, row.itemId, kind, now, UNLOCK_DELAY_MS)) opened.push(kind)
  })
  return opened
}

/** Удержание: доля «вспомнил» среди повторений зрелых карточек. */
export async function retentionStats(database: AppDB = db, sinceMs = 30 * 24 * 60 * 60 * 1000, now = Date.now()) {
  const logs = await database.reviews.where('at').above(now - sinceMs).toArray()
  const mature = logs.filter((l) => l.stateBefore === 2)
  const ok = mature.filter((l) => l.rating >= 2).length
  return { reviews: logs.length, mature: mature.length, retention: mature.length ? ok / mature.length : null }
}
