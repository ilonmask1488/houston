import { expect, test, type Page } from './fixtures.ts'
import { knowUntilVerify } from './helpers.ts'

/** Пройти словарь: всё «Не знаю» — после второй полосы тест сам остановится. */
async function passVocab(page: Page) {
  for (let i = 0; i < 40; i++) {
    const dont = page.getByRole('button', { name: 'Не знаю', exact: true })
    if (!(await dont.isVisible().catch(() => false))) break
    const counter = await page.locator('p[class*="counter"]').textContent()
    await dont.click()
    await expect(page.locator('p[class*="counter"]').first()).not.toHaveText(counter ?? '', { timeout: 5000 }).catch(() => {})
  }
}

test('вводный тест целиком → профиль по трекам', async ({ page }, info) => {
  test.setTimeout(180_000)
  await page.goto('./')
  await page.getByRole('button', { name: 'Начать вводный тест' }).click()
  await page.getByRole('button', { name: 'Поехали' }).click()

  // 1. Словарь: первое «Знаю» спрашивает перевод
  await expect(page.getByText(/среди слов есть выдуманные/)).toBeVisible()
  await knowUntilVerify(page)
  await page.getByRole('button', { name: 'Не уверен' }).click()
  await passVocab(page)

  // 2. На слух: лестница скоростей, начинаем с 0.75
  await expect(page.getByText(/Фразы пойдут всё быстрее/)).toBeVisible()
  for (let i = 0; i < 8; i++) {
    await page.getByRole('button', { name: /^Послушать · / }).click()
    await expect(page.locator('html')).toHaveAttribute('data-audio', /playing|ended/, { timeout: 10_000 })
    if (i === 0) {
      await expect(page.getByText('0.75×').first()).toBeVisible()
      await page.getByRole('group', { name: 'Что прозвучало?' }).getByRole('button').first().click()
    } else await page.getByRole('button', { name: 'Не разобрал' }).click()
    await page.getByRole('button', { name: 'Дальше' }).click()
  }

  // 3. Близнецы
  await expect(page.getByText('Какое слово прозвучало?')).toBeVisible()
  for (let i = 0; i < 6; i++) {
    const before = await page.locator('p[class*="counter"]').textContent()
    await page.locator('button[class*="big"]').first().click()
    if (i < 5) await expect(page.locator('p[class*="counter"]')).not.toHaveText(before ?? '')
  }

  // 4. Чтение: отвечаем на все вопросы
  await expect(page.getByRole('heading', { name: 'A static fire test' })).toBeVisible()
  await page.getByRole('button', { name: 'К вопросам' }).click()
  await expect(page.getByText(/Время чтения/)).toBeVisible()
  await page.getByRole('button', { name: 'It is held down by clamps.' }).click()
  await page.getByRole('button', { name: 'Pressure, temperature and vibration.' }).click()
  await page.getByRole('button', { name: 'Engineers look for the reason first.' }).click()
  await page.getByRole('button', { name: 'Дальше' }).click()
  // Три из трёх — второй, более трудный текст
  await expect(page.getByRole('heading', { name: 'Why composite specimens fail' })).toBeVisible()
  await page.getByRole('button', { name: 'К вопросам' }).click()
  for (const g of await page.getByRole('group').all()) await g.getByRole('button').first().click()
  await page.getByRole('button', { name: 'Дальше' }).click()

  // 5. Вслух: три вопроса
  await expect(page.getByText('Tell me a little about yourself and your studies.')).toBeVisible()
  const withMic = info.project.name === 'android'
  for (let i = 0; i < 3; i++) {
    if (i === 0 && withMic) await page.getByRole('button', { name: 'Понятно, записать' }).click()
    await page.getByRole('button', { name: 'Послушать' }).click()
    if (withMic) {
      await page.getByRole('button', { name: 'Готово' }).click({ timeout: 20_000 })
      await expect(page.getByText(/говорил \d+ с/)).toBeVisible()
    } else {
      // WebKit в Playwright без микрофона: ответ вслух без записи и самооценка
      await page.getByRole('button', { name: 'Ответил' }).click({ timeout: 20_000 })
    }
    await page.getByRole('button', { name: 'Нормально' }).click()
  }

  // Профиль
  await expect(page.getByRole('heading', { level: 1, name: 'Результаты теста' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Ориентировочный уровень')).toBeVisible()
  for (const t of ['Аудирование', 'Говорение', 'Чтение', 'Переписка', 'Произношение']) await expect(page.getByText(t, { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Повторный тест откроется/)).toBeVisible()

  // На главной — профиль и сеанс; достижение «Первый контакт»
  await page.getByRole('button', { name: 'К занятию' }).click()
  await expect(page.getByRole('heading', { name: 'Занятие на сегодня' })).toBeVisible()
  await expect(page.getByText('~30 мин')).toBeVisible()
  await page.goto('./#/achievements')
  await expect(page.locator('li[data-got]', { hasText: 'Первый контакт' })).toBeVisible()
})

test('тест можно прервать и продолжить с того же места', async ({ page }) => {
  await page.goto('./#/intake')
  await page.getByRole('button', { name: 'Поехали' }).click()
  await page.getByRole('button', { name: 'Не знаю', exact: true }).click()
  await page.getByRole('button', { name: 'Не знаю', exact: true }).click()
  await expect(page.getByText(/^3 из \d+$/)).toBeVisible()
  await page.getByRole('button', { name: 'Выйти из теста' }).click()
  await expect(page.getByRole('button', { name: 'Продолжить вводный тест' })).toBeVisible()
  await page.getByRole('button', { name: 'Продолжить вводный тест' }).click()
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click()
  await expect(page.getByText(/^3 из \d+$/)).toBeVisible()
})
