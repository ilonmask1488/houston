import { expect, test } from './fixtures.ts'
import { seedIntake } from './helpers.ts'
import { runSegment, speak } from './run.ts'

const ANSWER =
  "I'm a fourth-year student in rocket and space engineering. At the moment I'm working on a project about composite testing. We run tensile tests on carbon fiber specimens and compare the results with simulations. What I enjoy most is working with real hardware."

test('«Мой рассказ»: написать ответ, скопировать промпт для Claude, натренировать', async ({ page }) => {
  test.setTimeout(180_000)
  await seedIntake(page)
  await page.getByRole('navigation').getByRole('link', { name: 'Собеседование' }).click()
  await expect(page.getByText('Пробное собеседование').first()).toBeVisible()
  await page.getByRole('link', { name: /Tell me about yourself\./ }).click()
  await expect(page.getByText('Как отвечать')).toBeVisible()
  const train = page.getByRole('button', { name: 'Тренировать ответ' })
  await expect(train).toBeDisabled()
  await page.getByLabel('Твой ответ по-английски').fill(ANSWER)
  await expect(page.getByText('Сохранено')).toBeVisible()
  await expect(page.getByText(/\d+ слов · звучит ≈ \d+ с/)).toBeVisible()
  await page.getByRole('button', { name: 'Отредактировать с Claude' }).click()
  await expect(page.getByText(/Промпт скопирован|Скопировать не получилось/)).toBeVisible()

  await train.click()
  await expect(page.getByText('Послушай свой ответ', { exact: true }).first()).toBeVisible()
  await runSegment(page)
  await page.getByRole('button', { name: 'К собеседованию' }).click()
  await expect(page.getByText(/тренировок: 1/)).toBeVisible()

  // Сброс прогресса не трогает твои тексты
  await page.goto('./#/settings')
  await page.getByRole('button', { name: 'Сбросить прогресс' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Да, стереть' }).click()
  await expect(page.getByText(/Прогресс сброшен/)).toBeVisible()
  await page.goto('./#/story/about')
  await expect(page.getByLabel('Твой ответ по-английски')).toHaveValue(ANSWER)
})

test('пробное собеседование: вопросы подряд, транскрипт, разбор с Claude', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('./#/interview')
  await page.getByRole('button', { name: 'Начать собеседование' }).click()
  for (let i = 0; i < 5; i++) {
    await expect(page.getByText(new RegExp(`Вопрос ${i + 1} из 5`))).toBeVisible()
    await speak(page)
    await page.getByRole('button', { name: i < 4 ? 'Следующий вопрос' : 'Завершить' }).click()
  }
  await expect(page.getByRole('heading', { name: 'Итоги собеседования' })).toBeVisible()
  await expect(page.locator('ol li')).toHaveCount(5)
  await expect(page.getByText('Tell me about yourself.', { exact: true })).toBeVisible()
  await expect(page.getByText('Do you have any questions for us?', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Разобрать с Claude' }).click()
  await expect(page.getByText(/Промпт скопирован|Скопировать не получилось/)).toBeVisible()
  await page.goto('./#/achievements')
  await expect(page.locator('li[data-got]', { hasText: 'Первое собеседование' })).toBeVisible()
})

test('эпизод 1: реплики персонажей, выбор ответа с объяснением, культурная вставка', async ({ page }) => {
  test.setTimeout(300_000)
  await page.goto('./#/more')
  await page.getByRole('link', { name: 'Эпизод 1: Собеседование' }).click()
  await expect(page.getByRole('heading', { name: 'Собеседование' })).toBeVisible()
  await page.getByRole('button', { name: 'Дальше' }).click()
  let wrongShown = false
  for (let i = 0; i < 40; i++) {
    if (await page.getByText(/^Культура:/).isVisible().catch(() => false)) break
    const opts = page.getByRole('group', { name: 'Что ответишь?' }).getByRole('button')
    if ((await opts.first().isVisible().catch(() => false)) && (await opts.first().isEnabled().catch(() => false))) {
      // Первый раз нарочно выбираем не лучший вариант — должно прийти объяснение
      const texts = await opts.allTextContents()
      const idx = !wrongShown ? texts.findIndex((x) => /secret|Everything|difficult\.|No\.|salary|bye|call me|toilet|finding you|cat|student\. I/.test(x)) : 0
      await opts.nth(Math.max(0, idx)).click()
      if (!wrongShown && idx >= 0) {
        await expect(page.getByText('Лучше так — скажи вслух:')).toBeVisible()
        wrongShown = true
      }
      await page.getByRole('button', { name: 'Скажи это вслух' }).click()
      await speak(page)
    }
    // На последней реплике после «Дальше» открываются итоги — кнопки может уже не быть.
    await page
      .getByRole('button', { name: 'Дальше' })
      .click({ timeout: 5000 })
      .catch(() => {})
  }
  await expect(page.getByText(/Культура: Small talk/)).toBeVisible()
  await expect(page.getByText(/Верных ответов с первого раза/)).toBeVisible()
  await page.getByRole('button', { name: 'Практика разговора с Claude' }).click()
  await expect(page.getByText(/Промпт скопирован|Скопировать не получилось/)).toBeVisible()
  await page.getByRole('button', { name: 'К тренировке' }).click()
  await expect(page.getByText('✓ пройден')).toBeVisible()
})
