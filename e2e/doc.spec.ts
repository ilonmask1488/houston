import { expect, test } from '@playwright/test'
import { runSegment } from './run.ts'

test('Техдок: прочитать текст, добавить слово в карточки, задания с пересказом вслух', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('./#/tracks')
  await page.getByRole('link', { name: /Библиотека текстов/ }).click()
  await expect(page.getByText(/Уровень 1/)).toBeVisible()
  await page.getByRole('link', { name: /How a Satellite Bus Works|satellite/i }).first().click()

  // Тап по слову: перевод из словаря → в карточки
  const word = page.locator('article').getByRole('button', { name: 'payload', exact: true }).first()
  await word.click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByText('полезная нагрузка')).toBeVisible()
  await sheet.getByRole('button', { name: 'В карточки' }).click()
  await expect(sheet.getByText(/в карточках/i)).toBeVisible()
  await sheet.getByRole('button', { name: 'Закрыть' }).click()

  // «Объясни абзац» — копирует промпт
  await page.getByRole('button', { name: 'Объясни абзац с Claude' }).first().click()
  await expect(page.getByText(/Промпт скопирован|Скопировать не получилось/).first()).toBeVisible()

  // Задания: прочитал → найди → суть → разбор → перескажи вслух
  await page.getByRole('button', { name: 'Задания по тексту' }).click()
  await expect(page.getByRole('button', { name: 'Прочитал' })).toBeVisible()
  await runSegment(page)
  await page.goto('./#/stats')
  await expect(page.getByText(/Скорость чтения/)).toBeVisible()

  // Слово — в «Моих словах» словаря и в повторении
  await page.goto('./#/dictionary')
  await page.getByRole('radio', { name: 'Слова' }).click()
  await expect(page.getByText('Мои слова')).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'полезная нагрузка' }).getByText('в повторении')).toBeVisible()
  await page.getByRole('button', { name: /Прочность и испытания/ }).click()
  await expect(page.getByRole('button', { name: 'specimen', exact: true })).toBeVisible()
})

test('«Мой текст»: вставить абзац, тап по слову со своим переводом, удалить', async ({ page }) => {
  await page.goto('./#/mytext')
  await page.getByLabel('Текст на английском').fill('The bracket failed at the weld toe after two million cycles. Fatigue cracks started from the weld porosity.')
  await page.getByRole('button', { name: 'Открыть для чтения' }).click()
  await expect(page.getByRole('button', { name: 'Слушать' })).toBeVisible()
  await page.locator('article').getByRole('button', { name: 'porosity', exact: true }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: 'Закрыть' }).click()
  await page.getByRole('button', { name: 'Удалить текст' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить текст' }).click()
  await expect(page.getByLabel('Текст на английском')).toBeVisible()
  await expect(page.getByText('Сохранённые')).toHaveCount(0)
})

test('игра «Скорочтение»: шесть раундов на время, рекорд', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('./#/game/speedread')
  await page.getByRole('button', { name: 'Старт' }).click()
  for (let i = 0; i < 6; i++) {
    await expect(page.getByText(`Вопрос ${i + 1} из 6`)).toBeVisible()
    await page.getByRole('group', { name: /нажми на предложение с ответом/ }).getByRole('button').first().click()
    await page.getByRole('button', { name: i < 5 ? 'Дальше' : 'Итог' }).click()
  }
  await expect(page.getByRole('heading', { name: 'Раунд окончен' })).toBeVisible()
  await expect(page.getByText(/Рекорд: \d+/)).toBeVisible()
})
