/*
  Общий test для e2e: однократные объяснения упражнений («Новое упражнение: …») всплывают поверх экрана
  при первой встрече — закрываем их автоматически, где бы они ни появились. Проверка самих объяснений — в ux.spec.ts.
*/
import { test as base } from '@playwright/test'

export { expect } from '@playwright/test'
export type { Page } from '@playwright/test'

export const test = base.extend<{ coachmarks: boolean }>({
  coachmarks: [true, { option: true }],
  page: async ({ page, coachmarks }, use) => {
    if (coachmarks) {
      const sheet = page.getByRole('dialog', { name: /^Новое упражнение/ })
      await page.addLocatorHandler(sheet, async () => {
        await sheet.getByRole('button', { name: 'Понятно' }).click()
      })
    }
    await use(page)
  },
})
