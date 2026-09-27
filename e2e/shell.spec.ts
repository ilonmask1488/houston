import { expect, test } from '@playwright/test'
import { seedIntake } from './helpers.ts'

test('первый запуск: приглашение на вводный тест, кнопка видна без прокрутки', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveTitle(/Houston/)
  const start = page.getByRole('button', { name: 'Начать вводный тест' })
  await expect(start).toBeVisible()
  const box = (await start.boundingBox())!
  const vh = page.viewportSize()!.height
  expect(box.y + box.height).toBeLessThan(vh) // главная кнопка — без прокрутки
  expect(box.height).toBeGreaterThanOrEqual(44)
  await expect(page.getByText('Сначала — настройка связи')).toBeVisible()
})

test('«Сегодня» после теста: занятие простыми словами, одна главная кнопка без прокрутки, уровень одной строкой', async ({ page }) => {
  await seedIntake(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Занятие на сегодня' })).toBeVisible()
  for (const block of ['Разминка (игра)', 'Быстрая речь на слух', 'Говорим вслух', 'Сегодня:']) await expect(page.getByText(block, { exact: false }).first()).toBeVisible()
  const start = page.getByRole('button', { name: 'Начать занятие' })
  await expect(start).toBeVisible()
  const box = (await start.boundingBox())!
  expect(box.y + box.height).toBeLessThan(page.viewportSize()!.height)
  await expect(page.getByText(/Уровень ≈ B1 · сильнее всего чтение, слабее всего говорение/)).toBeVisible()
  // Числа объясняются тапом
  await page.getByRole('button', { name: /Дни подряд: объяснить/ }).click()
  await expect(page.getByRole('dialog', { name: 'Дни подряд' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Понятно' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('навигация: Сегодня · Курс · Собеседование · Словарь · Тренировка; профиль — значок сверху', async ({ page }) => {
  await page.goto('./')
  const nav = page.getByRole('navigation', { name: 'Разделы' })
  for (const [tab, heading] of [
    ['Курс', 'Курс'],
    ['Собеседование', 'Собеседование'],
    ['Словарь', 'Словарь'],
    ['Тренировка', 'Тренировка'],
  ]) {
    await nav.getByRole('link', { name: tab }).click()
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  }
  await expect(page.getByRole('link', { name: /Скорочтение/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Библиотека текстов/ })).toBeVisible()
  for (const [item, heading] of [
    ['Результаты вводного теста', 'Результаты теста'],
    ['Статистика', 'Статистика'],
    ['Достижения', 'Достижения'],
    ['Проверка звука и микрофона', 'Звук и микрофон'],
    ['Настройки', 'Настройки'],
    ['О приложении', 'О приложении'],
  ]) {
    await nav.getByRole('link', { name: 'Сегодня' }).click()
    await page.getByRole('link', { name: 'Профиль, статистика и настройки' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Профиль' })).toBeVisible()
    await page.getByRole('link', { name: new RegExp(`^${item}`) }).click()
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  }
  await nav.getByRole('link', { name: 'Сегодня' }).click()
  await page.getByRole('button', { name: 'Начать вводный тест' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Вводный тест' })).toBeVisible()
  await expect(nav).toBeHidden() // тест — во весь экран
})

test('ни на одном экране нет горизонтальной прокрутки', async ({ page }) => {
  await seedIntake(page)
  for (const path of ['/', '/session', '/tracks', '/story', '/dictionary', '/more', '/me', '/profile', '/achievements', '/check', '/settings', '/about', '/intake']) {
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

test('курс: пять направлений понятными словами, одна кнопка «Продолжить», модули свёрнуты', async ({ page }) => {
  await page.goto('./#/tracks')
  await expect(page.getByText('Пройди вводный тест')).toBeVisible()
  await seedIntake(page)
  await page.goto('./#/tracks')
  for (const t of ['Аудирование', 'Говорение', 'Чтение', 'Переписка', 'Произношение']) await expect(page.getByRole('heading', { name: t, exact: true })).toBeVisible()
  // Аудирование 38 → уровень 2 → «Выпадение звуков»; Произношение: ошибка в th тянет старт к первому модулю.
  await expect(page.getByRole('link', { name: 'Продолжить: «Выпадение звуков»' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Продолжить: «th»' })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Тренировать/ })).toHaveCount(0)
  await page.getByText('Все модули (8)').first().click()
  await expect(page.locator('[data-current]', { hasText: 'Выпадение звуков' })).toBeVisible()
  await page.getByRole('button', { name: /Уровень по направлению: объяснить/ }).first().click()
  await expect(page.getByRole('dialog', { name: 'Уровень по направлению' })).toBeVisible()
})
