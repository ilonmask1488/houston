/*
  «Слова дня»: каждый день в повторение сами добавляются несколько новых слов —
  технические термины (со звуком) и частые слова чуть выше оценки словаря из вводного теста.
  Без этого курс учил только ~150 фраз, а словарь на 4000 слов лежал без дела.
*/
import type { DictWord } from '../../content/types'
import { db, type AppDB } from '../db/db'
import { dictWords, loadDictionary } from '../dict/dict'
import { localDate } from '../progress/streak'
import { addWordCards } from './cards'

export const DAILY_TECH = 3
export const DAILY_GENERAL = 3

/** Кандидаты на сегодня: термины по кругу тем, общие — по частотности от уровня ученика. */
export function pickDailyWords(words: DictWord[], have: Set<string>, vocabSize: number, day: number, tech = DAILY_TECH, general = DAILY_GENERAL): DictWord[] {
  const terms = words.filter((w) => w.band === 'tech' && !have.has(w.id))
  const topics = [...new Set(terms.map((w) => w.topic ?? ''))].sort()
  const topic = topics[day % Math.max(1, topics.length)]
  const ofTopic = terms.filter((w) => (w.topic ?? '') === topic)
  const techPick = [...ofTopic, ...terms.filter((w) => (w.topic ?? '') !== topic)].slice(0, tech)
  // Общие слова: ранг NGSL от 80% оценки словаря — то, что рядом с границей знания, а не «the» и не редкость
  const from = Math.max(300, Math.round(vocabSize * 0.8))
  const generalPool = words
    .filter((w) => w.band !== 'tech' && w.rank !== undefined && w.rank >= from && !have.has(w.id))
    .sort((a, b) => a.rank! - b.rank!)
  // Частотный список кончился (большой словарь) — академические слова NAWL, по дню вперемешку
  const academic = words.filter((w) => w.band === 'nawl' && !have.has(w.id))
  const shift = academic.length ? (day * 37) % academic.length : 0
  const fallback = [...academic.slice(shift), ...academic.slice(0, shift)]
  return [...techPick, ...[...generalPool, ...fallback].slice(0, general)]
}

/** Добавить «слова дня», если сегодня ещё не добавляли. Возвращает число новых слов. */
export async function addDailyWords(vocabSize: number, database: AppDB = db, date = localDate()): Promise<number> {
  if ((await database.getMeta<string>('dailyWordsDate')) === date) return 0
  await loadDictionary()
  const have = new Set((await database.cards.toArray()).map((c) => c.itemId))
  const day = Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000)
  const words = pickDailyWords(dictWords, have, vocabSize, day)
  for (const w of words) await addWordCards(w.id, database)
  await database.setMeta('dailyWordsDate', date)
  return words.length
}
