import { expect, test } from './fixtures.ts'
import { seedIntake } from './helpers.ts'
import { playStatic, runSegment } from './run.ts'

test('занятие: одна кнопка «Начать», блоки идут подряд через экран «Готово → Дальше», прогресс сохраняется', async ({ page }) => {
  test.setTimeout(420_000)
  await seedIntake(page)
  await page.getByRole('link', { name: 'План занятия' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Занятие на сегодня' })).toBeVisible()
  for (const b of ['Разминка (игра)', 'Быстрая речь на слух', 'Говорим вслух', 'Сегодня:']) await expect(page.getByText(b, { exact: false }).first()).toBeVisible()
  await expect(page.getByText(/игра «Помехи»/)).toBeVisible()
  // В плане нет кнопок у каждого блока — одна «Начать занятие»
  await expect(page.getByRole('button', { name: 'Открыть' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Начать занятие' }).click()

  // Разминка — короткий раунд «Помех» (для теста — 6 секунд)
  await expect(page).toHaveURL(/game\/static\?seg=warmup/)
  await page.goto('./#/game/static?seg=warmup&seconds=6')
  await playStatic(page)
  await expect(page.getByText(/Рекорд: \d+/).first()).toBeVisible()

  // Дальше — быстрая речь на слух (повторения в первый день нет)
  await expect(page.getByText(/^Дальше: Быстрая речь на слух · \d+ мин$/)).toBeVisible()
  await page.getByRole('button', { name: 'Дальше', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Выпадение звуков' })).toBeVisible() // аудирование 38 → старт с «Выпадения»
  await expect(page.getByText('Быстрая речь на слух', { exact: true })).toBeVisible() // шапка: что за блок
  await runSegment(page)
  await expect(page.getByRole('heading', { name: 'Готово: Быстрая речь на слух ✓' })).toBeVisible()
  await expect(page.getByText('Очки', { exact: true })).toBeVisible()

  // Следующий блок — «Говорим вслух»; его можно пропустить
  await expect(page.getByText(/^Дальше: Говорим вслух · \d+ мин$/)).toBeVisible()
  await page.getByRole('button', { name: 'Дальше', exact: true }).click()
  await expect(page.getByText('Говорим вслух', { exact: true })).toBeVisible() // итоги прошлого блока ушли
  await runSegment(page)
  await page.getByRole('link', { name: 'План занятия' }).click()
  await expect(page.locator('li[data-status="done"]')).toHaveCount(1) // «Разминка» целиком; остальные блоки ещё не закончены

  // Главный экран показывает прогресс, статистика — минуты
  await page.goto('./#/')
  await expect(page.getByText(/пройдено блоков: 1 из \d+/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Продолжить занятие' })).toBeVisible()
  await page.goto('./#/stats')
  await expect(page.getByText('Дней подряд')).toBeVisible()
  await expect(page.getByText(/Минуты по дням/)).toBeVisible()
  // Изученные готовые фразы — в словаре с отметкой «в повторении»
  await page.goto('./#/dictionary')
  await expect(page.getByText('в повторении').first()).toBeVisible()
})

test('между блоками можно пропустить следующий блок', async ({ page }) => {
  await seedIntake(page)
  await page.goto('./#/session')
  await expect(page.getByText(/игра «Помехи»/)).toBeVisible()
  await page.goto('./#/game/static?seg=warmup&seconds=4')
  await playStatic(page)
  await page.getByRole('button', { name: 'Пропустить этот блок' }).click()
  // Аудирование пропущено — открылся следующий блок
  await expect(page).toHaveURL(/run\/seg\/call-1/)
})

test('занятие можно прервать посреди блока и продолжить', async ({ page }) => {
  await seedIntake(page)
  await page.goto('./#/session')
  // план сохранён, когда на экране появились блоки
  await expect(page.getByText(/игра «Помехи»/)).toBeVisible()
  await page.goto('./#/run/seg/air-1')
  await page.getByRole('button', { name: 'Понятно, поехали' }).click()
  await expect(page.getByText(/^2 из \d+$/)).toBeVisible()
  await page.getByRole('button', { name: 'Выйти' }).click()
  await expect(page.getByText('Прогресс сохранён — продолжишь с этого места.')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Выйти' }).click()
  await expect(page.getByRole('heading', { name: 'Занятие на сегодня' })).toBeVisible()
  await page.goto('./#/run/seg/air-1')
  await expect(page.getByText('Продолжаем с места, где остановился.')).toBeVisible()
  await expect(page.getByText(/^2 из \d+$/)).toBeVisible()
})

test('курс: любой модуль открывается для свободной тренировки', async ({ page }) => {
  test.setTimeout(120_000)
  await seedIntake(page)
  await page.goto('./#/tracks')
  await page.getByText('Все модули (8)').first().click()
  await page.getByRole('link', { name: /^Слияние слов/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Слияние слов' })).toBeVisible()
  await runSegment(page)
  await page.getByRole('button', { name: 'К курсу' }).click()
  await expect(page.getByRole('link', { name: 'Продолжить: «Выпадение звуков»' })).toBeVisible()
})

test('словарь: поиск готовой фразы по-русски и по-английски', async ({ page }) => {
  await page.goto('./#/dictionary')
  await expect(page.getByText(/^Ситуация: /).first()).toBeVisible()
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
