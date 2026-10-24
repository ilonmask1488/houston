import { expect, test } from './fixtures.ts'

test.describe('специальность', () => {
  test.use({ field: null })

  test('первый запуск: выбор специальности → машиностроение со своим стилем и текстами', async ({ page }) => {
    await page.goto('./')
    const picker = page.getByRole('dialog', { name: 'Какая у тебя специальность?' })
    await expect(picker).toBeVisible()
    await picker.getByRole('button', { name: /Машиностроение/ }).click()
    // перезапуск со стилем «Torque»
    await expect(page.getByText(/TORQUE/)).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('html')).toHaveAttribute('data-field', 'mech')
    await expect(picker).toHaveCount(0)
    // библиотека: машиностроительные тексты есть, космических нет
    await page.goto('./#/library')
    await expect(page.getByRole('link', { name: /How a lathe turns a shaft/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /CubeSat|satellite|rocket/i })).toHaveCount(0)
    // настройки: можно вернуть космос
    await page.goto('./#/settings')
    await page.getByRole('radio', { name: 'Ракетно-космическая техника' }).click()
    await expect(page.locator('html')).not.toHaveAttribute('data-field', 'mech', { timeout: 15_000 })
  })

  test('первый запуск: космос — привычный Houston', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('dialog', { name: 'Какая у тебя специальность?' }).getByRole('button', { name: /Ракетно-космическая/ }).click()
    await expect(page.getByRole('dialog', { name: 'Какая у тебя специальность?' })).toHaveCount(0)
    await expect(page.getByText(/HOUSTON/)).toBeVisible()
  })
})
