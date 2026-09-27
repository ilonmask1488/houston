import { expect, test } from './fixtures.ts'

test('iPhone: подсказка «Установи на главный экран», закрывается и не возвращается', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone', 'только iOS')
  await page.goto('./')
  const banner = page.getByRole('status').filter({ hasText: 'Установи на главный экран' })
  await expect(banner).toBeVisible()
  await banner.getByRole('button', { name: 'Закрыть' }).click()
  await expect(banner).toBeHidden()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Начать вводный тест' })).toBeVisible()
  await expect(banner).toBeHidden()
})

test('проверка звука и микрофона: голоса звучат, запись показывает результат', async ({ page }, info) => {
  await page.goto('./#/check')
  await page.getByRole('button', { name: 'Послушать' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-audio', /playing|ended/, { timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'Слышу', exact: true })).toBeVisible()
  if (info.project.name !== 'android') return
  await page.getByRole('button', { name: 'Записать' }).click()
  await page.getByRole('button', { name: 'Понятно, записать' }).click()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Стоп' }).click()
  await expect(page.getByRole('button', { name: 'Послушать себя' })).toBeVisible()
})
