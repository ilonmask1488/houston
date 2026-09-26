import { expect, test } from '@playwright/test'
import { seedIntake } from './helpers.ts'

test('первый запуск: приглашение на вводный тест, кнопка в зоне большого пальца', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveTitle(/Houston/)
  const start = page.getByRole('button', { name: 'Начать вводный тест' })
  await expect(start).toBeVisible()
  const box = (await start.boundingBox())!
  const vh = page.viewportSize()!.height
  expect(box.y).toBeGreaterThan(vh * 0.6) // нижняя треть экрана
  expect(box.height).toBeGreaterThanOrEqual(44)
  await expect(page.getByText('Сначала — настройка связи')).toBeVisible()
})

test('после теста: профиль и циклограмма сеанса на 30 минут', async ({ page }) => {
  await seedIntake(page)
  await page.reload()
  await expect(page.getByText('Сеанс связи · 30 мин')).toBeVisible()
  await expect(page.getByText('≈ B1')).toBeVisible()
  for (const block of ['Разминка', 'Повторение', 'Эфир', 'Позывной', 'Ротация']) await expect(page.getByText(block, { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Начать сеанс' })).toBeVisible()
})

test('навигация по всем разделам', async ({ page }) => {
  await page.goto('./')
  const nav = page.getByRole('navigation', { name: 'Разделы' })
  for (const [tab, heading] of [
    ['Треки', 'Треки'],
    ['Мой рассказ', 'Мой рассказ'],
    ['Словарь', 'Словарь'],
    ['Ещё', 'Ещё'],
  ]) {
    await nav.getByRole('link', { name: tab }).click()
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  }
  for (const [item, heading] of [
    ['Профиль', 'Профиль'],
    ['Статистика', 'Статистика'],
    ['Достижения', 'Достижения'],
    ['Проверка звука и микрофона', 'Звук и микрофон'],
    ['Настройки', 'Настройки'],
    ['О приложении', 'О приложении'],
  ]) {
    await nav.getByRole('link', { name: 'Ещё' }).click()
    await page.getByRole('link', { name: new RegExp(`^${item}`) }).click()
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  }
  await nav.getByRole('link', { name: 'Сеанс' }).click()
  await page.getByRole('button', { name: 'Начать вводный тест' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Вводный тест' })).toBeVisible()
  await expect(nav).toBeHidden() // тест — во весь экран
})

test('ни на одном экране нет горизонтальной прокрутки', async ({ page }) => {
  await seedIntake(page)
  for (const path of ['/', '/tracks', '/story', '/dictionary', '/more', '/profile', '/achievements', '/check', '/settings', '/about', '/intake']) {
    await page.goto(`./#${path}`)
    await expect(page.locator('main').first()).toBeAttached()
    await page.waitForTimeout(150)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
})

test('цели касания в навигации не меньше 44×44', async ({ page }) => {
  await page.goto('./')
  for (const link of await page.getByRole('navigation').getByRole('link').all()) {
    const b = (await link.boundingBox())!
    expect(b.width).toBeGreaterThanOrEqual(44)
    expect(b.height).toBeGreaterThanOrEqual(44)
  }
})

test('треки: пять каналов, стартовые модули отмечены после теста', async ({ page }) => {
  await page.goto('./#/tracks')
  await expect(page.getByText('Пройди вводный тест')).toBeVisible()
  await seedIntake(page)
  await page.goto('./#/tracks')
  for (const t of ['Эфир', 'Позывной', 'Техдок', 'Телеграмма', 'Чистый сигнал']) await expect(page.getByRole('heading', { name: t })).toBeVisible()
  // Эфир 38 → уровень 2 → «Выпадение звуков» (ошибка в уподоблении дальше — старт не сдвигает);
  // Чистый сигнал 60 → уровень 4, но ошибка в th тянет старт к первому модулю.
  await expect(page.locator('[data-start]')).toHaveCount(5)
  await expect(page.locator('[data-start]', { hasText: 'Выпадение звуков' })).toBeVisible()
  await expect(page.locator('[data-start]', { hasText: 'think — sink' })).toBeVisible()
})
