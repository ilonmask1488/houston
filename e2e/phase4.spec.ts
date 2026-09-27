import { expect, test } from './fixtures.ts'
import { runSegment } from './run.ts'

test('Телеграмма: регистр, «слишком по-русски», письмо из блоков или своё письмо', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('./#/run/module/mail-structure')
  await expect(page.getByRole('heading', { name: 'Структура письма' })).toBeVisible()
  await runSegment(page)
  await page.goto('./#/dictionary')
  await page.getByRole('radio', { name: 'Письма' }).click()
  await expect(page.getByText('Just following up on my email from Monday.')).toBeVisible()
  await page.getByLabel(/Поиск: «напомнить»/).fill('напомн')
  await expect(page.getByText('Напомнить', { exact: true })).toBeVisible()
  await expect(page.getByText('Попросить', { exact: true })).toHaveCount(0)
})

test('босс Телеграммы: регистр, своё письмо, чек-лист, «Проверить с Claude»', async ({ page }) => {
  await page.goto('./#/tracks')
  await page.getByRole('link', { name: /Письмо «сложному» заказчику/ }).click()
  for (let i = 0; i < 2; i++) {
    await page.getByRole('group', { name: 'Выбери вариант' }).getByRole('button').first().click()
    await page.getByRole('button', { name: 'Дальше' }).click()
  }
  await expect(page.getByText('Входящее письмо')).toBeVisible()
  await page.getByLabel(/Твоё письмо/).fill('Dear Grace,\n\nThank you for your email, and I understand your frustration. We will deliver the report by 14 March.\n\nKind regards,\nIvan')
  await page.getByRole('button', { name: 'Сравнить с образцом' }).click()
  await expect(page.getByText('Образец', { exact: true }).first()).toBeVisible()
  for (const box of await page.getByRole('checkbox').all()) await box.check()
  await page.getByRole('button', { name: 'Проверить с Claude' }).click()
  await expect(page.getByText(/Промпт скопирован|Скопировать не получилось/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Дальше' }).click()
  await expect(page.getByRole('heading', { name: /^Готово/ })).toBeVisible()
  await page.goto('./#/achievements')
  await expect(page.locator('li[data-got]', { hasText: 'Дипломат' })).toBeVisible()
  await expect(page.locator('li[data-got]', { hasText: 'Первая телеграмма' })).toBeVisible()
})

test('Чистый сигнал: пары на слух и вслух, фразы, ложные друзья; ударение', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('./#/run/module/clean-th')
  await expect(page.getByRole('heading', { name: 'th' })).toBeVisible()
  await runSegment(page)
  await page.goto('./#/run/module/clean-stress')
  await runSegment(page)
  await page.goto('./#/stats')
  await expect(page.getByText(/Произношение: пары на слух/)).toBeVisible()
})

test('игры «Близнецы» и «Ложные друзья»: короткий раунд, рекорд', async ({ page }) => {
  test.setTimeout(120_000)
  for (const [id, group] of [
    ['twins', 'Какое слово прозвучало'],
    ['ff', 'Варианты перевода'],
  ] as const) {
    await page.goto(`./#/game/${id}?seconds=6`)
    await page.getByRole('button', { name: 'Старт' }).click()
    for (let i = 0; i < 20; i++) {
      if (await page.getByRole('heading', { name: 'Раунд окончен' }).isVisible().catch(() => false)) break
      await page.getByRole('group', { name: group }).getByRole('button').first().click({ timeout: 1000 }).catch(() => {})
      await page.waitForTimeout(400)
    }
    await expect(page.getByRole('heading', { name: 'Раунд окончен' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Рекорд: \d+/)).toBeVisible()
  }
})

test('боссы Эфира и Техдока проходятся; эпизоды 4–6 в сюжете', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('./#/more')
  await expect(page.getByRole('link', { name: /Эпизод 6: Презентация результатов/ })).toBeVisible()
  await page.goto('./#/tracks')
  await page.locator('a[href="#/boss/doc"]').click()
  await runSegment(page)
  await page.goto('./#/boss/air')
  await runSegment(page)
})
