import { expect, type Page } from '@playwright/test'

/** Записать строки в таблицу IndexedDB напрямую — чтобы тест не проходил всё заново. */
export async function putRows(page: Page, table: string, rows: unknown[]): Promise<void> {
  await page.evaluate(
    async ({ table, rows }) => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('houston')
        req.onsuccess = () => {
          const tx = req.result.transaction(table, 'readwrite')
          for (const r of rows) tx.objectStore(table).put(r)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }
        req.onerror = () => reject(req.error)
      })
    },
    { table, rows },
  )
}

/** Нажимать «Знаю», пока не спросят перевод (псевдослово перевод не спрашивает — порядок слов случайный). */
export async function knowUntilVerify(page: Page): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await page.getByRole('button', { name: 'Знаю', exact: true }).click()
    if (await page.getByText(/^Что значит «/).isVisible({ timeout: 800 }).catch(() => false)) return
  }
  await expect(page.getByText(/^Что значит «/)).toBeVisible()
}

export const SAMPLE_TRACKS = { air: 38, call: 22, doc: 71, mail: 55, clean: 60 }

/** Готовый итог вводного теста (формат lib/intake/score.ts). */
export async function seedIntake(page: Page, at = Date.now()): Promise<void> {
  await page.goto('./')
  await expect(page.getByRole('button', { name: /вводный тест/ })).toBeVisible()
  await putRows(page, 'intake', [
    {
      id: 1,
      at,
      cefr: 'B1',
      tracks: SAMPLE_TRACKS,
      result: {
        version: 1,
        bands: [],
        falseAlarm: 0,
        verifyPass: 1,
        ngslKnown: 1900,
        vocabSize: 2300,
        listening: { score: 38, comfort: 1, byAccent: {} },
        pairs: { score: 67, weak: ['th'] },
        reading: { score: 71, wpm: 140 },
        speaking: { score: 22, avgLatencyMs: 3400, avgSpeechMs: 14000, measured: true },
        levels: { vocab: 2, listening: 1, reading: 3, speaking: 1 },
        cefr: 'B1',
        tracks: SAMPLE_TRACKS,
        weakTags: ['assimilation', 'th'],
      },
    },
  ])
  // Запись мимо Dexie живые запросы не видят — перезагружаем.
  await page.reload()
}
