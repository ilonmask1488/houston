import { expect, test } from './fixtures.ts'
import { seedIntake } from './helpers.ts'

// Игры на время: короткий раунд доигрывается до итогов (отвечаем первым вариантом, после ошибки — «Дальше»).
for (const id of ['static', 'numbers', 'terms', 'twins', 'ff']) {
  test(`игра ${id}: раунд до итогов, без ошибок страницы`, async ({ page }) => {
    test.setTimeout(90_000)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await seedIntake(page)
    await page.goto(`./#/game/${id}?seconds=4`)
    await page.getByRole('button', { name: 'Старт' }).click()
    const over = page.getByRole('heading', { name: 'Раунд окончен' })
    await expect(page.locator('[role=group] button').first()).toBeVisible({ timeout: 15_000 })
    for (let i = 0; i < 120 && !(await over.isVisible().catch(() => false)); i++) {
      const next = page.getByRole('button', { name: 'Дальше', exact: true })
      if (await next.isVisible().catch(() => false)) await next.click({ timeout: 1000 }).catch(() => {})
      const opt = page.locator('[role=group] button:not([disabled])').first()
      if (await opt.isVisible().catch(() => false)) await opt.click({ timeout: 1000 }).catch(() => {})
      await page.waitForTimeout(250)
    }
    await expect(over).toBeVisible({ timeout: 15_000 })
    expect(errors).toEqual([])
  })
}

// Игры без таймера на ответ: после выбора вариант подсвечен и ждёт «Дальше».
for (const id of ['grammar', 'speedread']) {
  test(`игра ${id}: старт, ответ подсвечен, без ошибок страницы`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await seedIntake(page)
    await page.goto(`./#/game/${id}`)
    await page.getByRole('button', { name: 'Старт' }).click()
    const opts = page.locator('[role=group] button')
    await expect(opts.first()).toBeVisible({ timeout: 15_000 })
    await opts.first().click()
    await expect(page.locator('[role=group] [data-state]').first()).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('«Тренировка»: восемь игр в списке', async ({ page }) => {
  await seedIntake(page)
  await page.goto('./#/more')
  for (const name of ['Помехи', 'Цифры на слух', 'Термин на слух', 'Близнецы', 'Грамматика', 'Ложные друзья', 'Скорочтение', 'Быстрый ответ'])
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible()
})
