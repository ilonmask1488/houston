import { expect, test } from '@playwright/test'
import { seedIntake } from './helpers.ts'
import { playStatic, runSegment } from './run.ts'

test('сеанс связи: разминка-игра, Эфир и Позывной проходятся, прогресс сохраняется', async ({ page }) => {
  test.setTimeout(420_000)
  await seedIntake(page)
  await page.getByRole('button', { name: 'Начать сеанс' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Сеанс связи' })).toBeVisible()
  for (const b of ['Разминка', 'Эфир', 'Позывной', 'Ротация']) await expect(page.getByText(b, { exact: false }).first()).toBeVisible()
  await expect(page.getByText(/игра «Помехи»/)).toBeVisible()

  // Разминка — короткий раунд «Помех»
  await page.goto('./#/game/static?seg=warmup&seconds=6')
  await playStatic(page)
  await expect(page.getByText(/Рекорд: \d+/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Дальше по сеансу' }).click()
  await expect(page.locator('li[data-status="done"]')).toHaveCount(1)

  // Следующий сегмент — Эфир (после разминки повторения ещё нет)
  await page.getByRole('button', { name: /^(Начать|Продолжить): Эфир$/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Выпадение звуков' })).toBeVisible() // Эфир 38 → старт с «Выпадения»
  await runSegment(page)
  await expect(page.getByText('Сигнал', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'К сеансу' }).click()
  await expect(page.locator('li[data-status="done"]')).toHaveCount(2)

  // Позывной — новые чанки вслух
  await page.getByRole('button', { name: /^(Начать|Продолжить): Позывной$/ }).click()
  await runSegment(page)
  await page.getByRole('button', { name: 'К сеансу' }).click()
  await expect(page.locator('li[data-status="done"]')).toHaveCount(3)

  // Главный экран показывает прогресс, статистика — минуты
  await page.goto('./#/')
  await expect(page.getByText(/сегодня: 3 из \d+ сегментов/)).toBeVisible()
  await page.goto('./#/stats')
  await expect(page.getByText('Дней в эфире')).toBeVisible()
  await expect(page.getByText(/Минуты по дням/)).toBeVisible()
  // Изученные чанки — в словаре с отметкой «в повторении»
  await page.goto('./#/dictionary')
  await expect(page.getByText('в повторении').first()).toBeVisible()
})

test('сеанс можно прервать посреди сегмента и продолжить', async ({ page }) => {
  await seedIntake(page)
  await page.goto('./#/session')
  // план сохранён, когда на экране появились сегменты
  await expect(page.getByText(/игра «Помехи»/)).toBeVisible()
  await page.goto('./#/run/seg/air-1')
  await page.getByRole('button', { name: 'Понятно, поехали' }).click()
  await expect(page.getByText(/^2 из \d+$/)).toBeVisible()
  await page.getByRole('button', { name: 'Выйти' }).click()
  await expect(page.getByText(/продолжить с 2-го шага/)).toBeVisible()
  await page.goto('./#/run/seg/air-1')
  await expect(page.getByText('Продолжаем с места, где остановился.')).toBeVisible()
  await expect(page.getByText(/^2 из \d+$/)).toBeVisible()
})

test('треки: модуль открывается для свободной тренировки', async ({ page }) => {
  test.setTimeout(120_000)
  await seedIntake(page)
  await page.goto('./#/tracks')
  await page.getByRole('link', { name: 'Тренировать: Слияние слов' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Слияние слов' })).toBeVisible()
  await runSegment(page)
  await page.getByRole('button', { name: 'К трекам' }).click()
  await expect(page.locator('li[data-current]', { hasText: 'Выпадение звуков' })).toBeVisible()
})

test('словарь: поиск чанка по-русски и по-английски', async ({ page }) => {
  await page.goto('./#/dictionary')
  await page.getByRole('searchbox').fill('make sure')
  await expect(page.getByText('Just to make sure I understand', { exact: true })).toBeVisible()
  await page.getByRole('searchbox').fill('переспросить')
  await expect(page.getByText('Could you say that again, please?', { exact: true })).toBeVisible()
  await page.getByRole('searchbox').fill('зжзжзж')
  await expect(page.getByText(/Ничего не нашлось/)).toBeVisible()
})

test('игра «Быстрый ответ»: три вопроса, очки и рекорд', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('./#/game/quick')
  await page.getByRole('button', { name: 'Старт' }).click()
  for (let i = 0; i < 3; i++) {
    await expect(page.getByText(`Вопрос ${i + 1} из 3`)).toBeVisible()
    if (i === 0) await page.getByRole('button', { name: 'Послушать' }).click()
    const allow = page.getByRole('button', { name: 'Понятно, записать' })
    const done = page.getByRole('button', { name: 'Готово', exact: true })
    const said = page.getByRole('button', { name: 'Сказал', exact: true })
    await expect(allow.or(done).or(said).first()).toBeVisible({ timeout: 20_000 })
    if (await allow.isVisible()) await allow.click()
    await expect(done.or(said).first()).toBeVisible({ timeout: 20_000 })
    if (await done.isVisible()) await done.click()
    else {
      await said.click()
      await page.getByRole('button', { name: 'Да', exact: true }).first().click()
      await page.getByRole('button', { name: 'Да', exact: true }).nth(1).click()
    }
    await page.getByRole('button', { name: 'Дальше' }).click()
  }
  await expect(page.getByRole('heading', { name: 'Раунд окончен' })).toBeVisible()
  await expect(page.getByText(/Рекорд: \d+/).first()).toBeVisible()
})
