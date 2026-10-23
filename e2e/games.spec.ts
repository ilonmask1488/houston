import { expect, test } from './fixtures.ts'
import { seedIntake } from './helpers.ts'

// Каждая мини-игра открывается, даёт варианты и после ответа показывает разбор, без ошибок на странице.
for (const id of ['static', 'numbers', 'terms', 'twins', 'grammar', 'ff', 'speedread']) {
  test(`игра ${id}: старт, ответ, без ошибок`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await seedIntake(page)
    await page.goto(`./#/game/${id}?seconds=20`)
    await page.getByRole('button', { name: 'Старт' }).click()
    const opts = page.locator('[role=group] button')
    await expect(opts.first()).toBeVisible({ timeout: 10_000 })
    await opts.first().click()
    await expect(opts.first()).toHaveAttribute('data-state', /right|wrong/)
    expect(errors).toEqual([])
  })
}

test('«Тренировка»: восемь игр в списке', async ({ page }) => {
  await seedIntake(page)
  await page.goto('./#/more')
  for (const name of ['Помехи', 'Цифры на слух', 'Термин на слух', 'Близнецы', 'Грамматика', 'Ложные друзья', 'Скорочтение', 'Быстрый ответ'])
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible()
})
