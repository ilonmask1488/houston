/* Свои слова (которых нет в словаре) и добавление слов в карточки. */
import { db } from '../db/db'
import { addWordCards } from '../srs/cards'
import { norm } from './dict'

export function userWordId(text: string): string {
  return `u-${norm(text).replace(/[^a-z0-9]+/g, '-')}`
}

export async function saveUserWord(text: string, ru: string, context?: string): Promise<string> {
  const id = userWordId(text)
  await db.userWords.put({ id, text: norm(text), ru: ru.trim(), context, createdAt: Date.now() })
  await addWordCards(id)
  return id
}

export async function inCards(itemId: string): Promise<boolean> {
  return !!(await db.cards.get(`${itemId}:1`))
}
