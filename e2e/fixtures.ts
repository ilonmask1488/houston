/*
  Общий test для e2e: однократные объяснения («Новое упражнение: …») и обучение интерфейсу
  («Как устроен Houston», «Что изменилось») всплывают поверх экрана — закрываем их автоматически,
  где бы они ни появились. Проверка самих объяснений и обучения — в ux.spec.ts (coachmarks: false).
*/
import { test as base } from '@playwright/test'

export { expect } from '@playwright/test'
export type { Page } from '@playwright/test'

export const test = base.extend<{ coachmarks: boolean }>({
  coachmarks: [true, { option: true }],
  page: async ({ page, coachmarks }, provide) => {
    if (coachmarks) {
      const sheet = page.getByRole('dialog', { name: /^Новое упражнение/ })
      await page.addLocatorHandler(sheet, async () => {
        await sheet.getByRole('button', { name: 'Понятно' }).click({ timeout: 3000 }).catch(() => {})
      })
      const tour = page.getByRole('dialog', { name: 'Как устроен Houston' })
      await page.addLocatorHandler(tour, async () => {
        await tour.getByRole('button', { name: 'Пропустить' }).click({ timeout: 3000 }).catch(() => {})
      })
      const changed = page.getByRole('dialog', { name: 'Что изменилось' })
      await page.addLocatorHandler(changed, async () => {
        await changed.getByRole('button', { name: 'Понятно' }).click({ timeout: 3000 }).catch(() => {})
      })
    }
    await provide(page)
  },
})
