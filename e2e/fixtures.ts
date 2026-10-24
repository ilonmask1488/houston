/*
  Общий test для e2e: однократные объяснения («Новое упражнение: …») и обучение интерфейсу
  («Как устроен Houston», «Что изменилось») всплывают поверх экрана — закрываем их автоматически,
  где бы они ни появились. Проверка самих объяснений и обучения — в ux.spec.ts (coachmarks: false).
*/
import { test as base } from '@playwright/test'

export { expect } from '@playwright/test'
export type { Page } from '@playwright/test'

export const test = base.extend<{ coachmarks: boolean; field: 'space' | 'mech' | null }>({
  coachmarks: [true, { option: true }],
  // Специальность выбрана заранее (как у того, кто уже пользуется приложением). null — первый запуск с выбором.
  field: [(process.env.E2E_FIELD as 'space' | 'mech' | undefined) ?? 'space', { option: true }],
  page: async ({ page, coachmarks, field }, provide) => {
    if (field) await page.addInitScript((f) => localStorage.setItem('houston:field', f), field)
    if (coachmarks) {
      const sheet = page.getByRole('dialog', { name: /^Новое упражнение/ })
      await page.addLocatorHandler(sheet, async () => {
        await sheet.getByRole('button', { name: 'Понятно' }).click({ timeout: 3000 }).catch(() => {})
      })
      const tour = page.getByRole('dialog', { name: /^Как устроен / })
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
