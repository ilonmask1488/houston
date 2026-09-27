import { expect, test } from './fixtures.ts'
import { putRows, seedIntake } from './helpers.ts'
import { runSegment } from './run.ts'

test('у каждого экрана упражнения есть инструкция и кнопка «?» — во всех пяти направлениях', async ({ page }) => {
  test.setTimeout(600_000)
  await seedIntake(page)
  for (const m of ['air-elision', 'call-intro', 'doc-structure', 'mail-structure', 'clean-th', 'clean-stress']) {
    await page.goto(`./#/run/module/${m}`)
    await runSegment(page, 80, { checkHelp: true })
  }
})

test.describe('однократные объяснения', () => {
  test.use({ coachmarks: false })

  test('первый запуск: обучение из четырёх шагов после теста, потом не показывается; можно показать заново', async ({ page }) => {
    await seedIntake(page)
    const tour = page.getByRole('dialog', { name: 'Как устроен Houston' })
    await expect(tour).toBeVisible()
    await expect(tour.getByText('1 / 4')).toBeVisible()
    await expect(tour.getByRole('heading', { name: 'Каждый день — одно занятие' })).toBeVisible()
    for (let i = 0; i < 3; i++) await tour.getByRole('button', { name: 'Дальше' }).click()
    await expect(tour.getByText('4 / 4')).toBeVisible()
    await tour.getByRole('button', { name: 'Начать' }).click()
    await expect(tour).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Занятие на сегодня' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    // Профиль → «Как устроено приложение» → обучение заново
    await page.getByRole('link', { name: 'Профиль, статистика и настройки' }).click()
    await page.getByRole('link', { name: /^Как устроено приложение/ }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Повторение и оценки' })).toBeVisible()
    await page.getByRole('button', { name: 'Показать обучение заново' }).click()
    await expect(page.getByRole('dialog', { name: 'Как устроен Houston' })).toBeVisible()
  })

  test('тому, кто уже занимался, после обновления — «Что изменилось», прогресс на месте', async ({ page }) => {
    await seedIntake(page)
    await putRows(page, 'days', [{ date: '2026-09-20', seconds: 1800, signal: 120, spokenSeconds: 200, spokenCount: 5, newItems: 3 }])
    await putRows(page, 'moduleProgress', [{ moduleId: 'air-weak', startedAt: 1, done: ['ph-weak-1'] }])
    await page.reload()
    const changed = page.getByRole('dialog', { name: 'Что изменилось' })
    await expect(changed).toBeVisible()
    await changed.getByRole('button', { name: 'Понятно' }).click()
    await expect(page.getByText('Очки 120')).toBeVisible()
  })

  test('новый вид упражнения объясняется один раз, потом — только по «?»', async ({ page }) => {
    await page.goto('./#/run/module/air-weak')
    await page.getByRole('button', { name: 'Понятно, поехали' }).click()
    const coach = page.getByRole('dialog', { name: 'Новое упражнение: Послушай фразу и выбери, что прозвучало' })
    await expect(coach).toBeVisible()
    await expect(coach.getByText(/«Не разобрал» — нормальный ответ/)).toBeVisible()
    await coach.getByRole('button', { name: 'Понятно' }).click()
    await page.getByRole('group', { name: 'Что прозвучало?' }).getByRole('button').first().click()
    await page.getByRole('button', { name: 'Дальше' }).click()
    // Второй такой же шаг — без объяснения
    await expect(page.getByRole('group', { name: 'Что прозвучало?' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    // «?» открывает то же объяснение
    await page.getByRole('button', { name: 'Как работает это упражнение' }).click()
    await expect(page.getByRole('dialog', { name: 'Послушай фразу и выбери, что прозвучало' })).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Понятно' }).click()
    // Выход спрашивает подтверждение
    await page.getByRole('button', { name: 'Выйти' }).click()
    await expect(page.getByRole('dialog', { name: 'Выйти?' })).toBeVisible()
    await page.getByRole('button', { name: 'Остаться' }).click()
    await expect(page.getByRole('group', { name: 'Что прозвучало?' })).toBeVisible()
  })
})

test('ни одно упражнение не требует микрофона: «Сказал вслух без записи»', async ({ page }, info) => {
  test.skip(info.project.name !== 'android', 'запись есть только в Chrome с поддельным микрофоном')
  await page.goto('./#/run/module/clean-th')
  await page.getByRole('button', { name: 'Понятно, поехали' }).click()
  for (let i = 0; i < 12; i++) {
    const skip = page.getByRole('button', { name: 'Сказал вслух без записи' })
    if (await skip.isVisible().catch(() => false)) break
    const g = page.getByRole('group', { name: 'Какое слово прозвучало' })
    if (await g.isVisible().catch(() => false)) {
      await g.getByRole('button').first().click()
      await page.getByRole('button', { name: 'Дальше' }).click()
    }
  }
  await page.getByRole('button', { name: 'Сказал вслух без записи' }).click()
  await expect(page.getByRole('button', { name: 'Похоже' })).toBeVisible()
})
