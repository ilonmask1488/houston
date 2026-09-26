/* Твои ответы «Моего рассказа» в базе. */
import { db } from '../db/db'
import type { StoryRow } from '../db/types'
import { wordCount } from './text'

export const MIN_WORDS = 15

export async function saveStory(id: string, text: string, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.stories, async () => {
    const cur = await db.stories.get(id)
    await db.stories.put({ id, text, updatedAt: now, trained: cur?.trained ?? 0, lastTrainedAt: cur?.lastTrainedAt })
  })
}

export async function deleteStory(id: string): Promise<void> {
  await db.stories.delete(id)
}

export async function markTrained(id: string, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.stories, async () => {
    const cur = await db.stories.get(id)
    if (cur) await db.stories.put({ ...cur, trained: cur.trained + 1, lastTrainedAt: now })
  })
}

/** Ответы, готовые к тренировке (не короче 15 слов). */
export async function readyStories(): Promise<StoryRow[]> {
  return (await db.stories.toArray()).filter((s) => wordCount(s.text) >= MIN_WORDS)
}
