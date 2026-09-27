/*
  «Прогулка новичка» (UX §9): с чистого листа на вьюпорте iPhone — первый запуск → вводный тест → «Сегодня» →
  занятие целиком → «Курс» → «Собеседование» → «Словарь» → «Тренировка» → профиль и настройки.
  Снимок каждого экрана и состояния — в docs/screens/<WALK>/NN-имя.png.
  Запуск: $env:WALK='ux-walk'; npx playwright test walk --project=iphone
*/
import { expect, test, type Page } from './fixtures.ts'
import { knowUntilVerify } from './helpers.ts'
import { runSegment } from './run.ts'

const dir = process.env.WALK
test.skip(!dir, 'прогулка запускается только по запросу: WALK=<папка>')

let n = 0
async function snap(page: Page, name: string) {
  n++
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(350)
  const file = `${String(n).padStart(2, '0')}-${name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60)}`
  await page.screenshot({ path: `docs/screens/${dir}/${file}.png` })
}

/** Игра внутри занятия: для скорости — короткий раунд (параметр seconds), «Быстрый ответ» — три вопроса. */
async function playGame(page: Page) {
  const url = new URL(page.url())
  const game = url.hash.match(/game\/(\w+)/)?.[1]
  if (!game) return
  await snap(page, `игра-${game}-вступление`)
  if (game !== 'quick' && game !== 'speedread') {
    await page.goto(`./${url.hash}&seconds=5`)
    await page.getByRole('button', { name: 'Старт' }).click()
    await snap(page, `игра-${game}-идёт`)
    await expect(page.getByRole('heading', { name: 'Раунд окончен' })).toBeVisible({ timeout: 20_000 })
  } else if (game === 'quick') {
    await page.getByRole('button', { name: 'Старт' }).click()
    for (let i = 0; i < 3; i++) {
      // первый вопрос — по кнопке, дальше вопрос звучит сам
      await page.getByRole('button', { name: 'Послушать' }).click({ timeout: 3000 }).catch(() => {})
      const said = page.getByRole('button', { name: 'Сказал', exact: true })
      await said.click({ timeout: 20_000 })
      await page.getByRole('button', { name: 'Да', exact: true }).first().click()
      await page.getByRole('button', { name: 'Да', exact: true }).nth(1).click()
      await page.getByRole('button', { name: 'Дальше' }).click()
    }
  }
  await expect(page.getByRole('heading', { name: 'Раунд окончен' })).toBeVisible({ timeout: 20_000 })
}

test.use({ coachmarks: false, actionTimeout: 30_000 })

test('прогулка новичка', async ({ page }) => {
  test.setTimeout(1_800_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message, e.stack?.slice(0, 1500)))
  // Объяснение нового упражнения — снимаем и закрываем
  const coach = page.getByRole('dialog', { name: /^Новое упражнение/ })
  await page.addLocatorHandler(coach, async () => {
    await snap(page, 'объяснение-при-первой-встрече')
    await coach.getByRole('button', { name: 'Понятно' }).click()
  })

  // ——— Первый запуск и вводный тест ———
  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Начать вводный тест' })).toBeVisible()
  await page.waitForTimeout(4500) // «готово офлайн» исчезает само
  await snap(page, 'первый-запуск')
  await page.getByRole('button', { name: 'Начать вводный тест' }).click()
  await snap(page, 'тест-вступление')
  await page.getByRole('button', { name: 'Поехали' }).click()
  await snap(page, 'тест-словарь')
  await knowUntilVerify(page)
  await snap(page, 'тест-словарь-проверка')
  await page.getByRole('button', { name: 'Не уверен' }).click()
  for (let i = 0; i < 40; i++) {
    const dont = page.getByRole('button', { name: 'Не знаю', exact: true })
    if (!(await dont.isVisible().catch(() => false))) break
    await dont.click()
    await page.waitForTimeout(80)
  }
  await snap(page, 'тест-на-слух')
  for (let i = 0; i < 8; i++) {
    await page.getByRole('button', { name: /^Послушать · / }).click()
    await page.getByRole('button', { name: 'Не разобрал' }).click()
    if (i === 0) await snap(page, 'тест-на-слух-ответ')
    await page.getByRole('button', { name: 'Дальше' }).click()
  }
  await snap(page, 'тест-близнецы')
  for (let i = 0; i < 6; i++) {
    await page.locator('button[class*="big"]').first().click()
    await page.waitForTimeout(250)
  }
  await snap(page, 'тест-чтение')
  await page.getByRole('button', { name: 'К вопросам' }).click()
  for (const g of await page.getByRole('group').all()) await g.getByRole('button').nth(1).click()
  await page.getByRole('button', { name: 'Дальше' }).click()
  await snap(page, 'тест-вслух')
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Послушать' }).click()
    await page.getByRole('button', { name: 'Ответил' }).click({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Нормально' }).click()
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Результаты теста' })).toBeVisible({ timeout: 15_000 })
  await snap(page, 'результаты-теста')

  // ——— Обучение и «Сегодня» ———
  await page.getByRole('button', { name: 'К занятию' }).click()
  const tour = page.getByRole('dialog', { name: 'Как устроен Houston' })
  for (let i = 1; i <= 4; i++) {
    await expect(tour.getByText(`${i} / 4`)).toBeVisible()
    await snap(page, `обучение-${i}`)
    await tour.getByRole('button', { name: i < 4 ? 'Дальше' : 'Начать' }).click()
  }
  await expect(page.getByRole('heading', { name: 'Занятие на сегодня' })).toBeVisible()
  await snap(page, 'сегодня')
  await page.getByRole('button', { name: /Дни подряд: объяснить/ }).click()
  await snap(page, 'сегодня-объяснение-дней')
  await page.getByRole('dialog').getByRole('button', { name: 'Понятно' }).click()
  await page.getByRole('link', { name: 'План занятия' }).click()
  await snap(page, 'план-занятия')

  // ——— Занятие целиком ———
  await page.getByRole('button', { name: 'Начать занятие' }).click()
  for (let block = 0; block < 20; block++) {
    await page.waitForTimeout(600)
    if (page.url().includes('/game/')) await playGame(page)
    else {
      await runSegment(page, 200, {
        onScreen: async (title) => {
          await snap(page, `упр-${title}`)
        },
      })
    }
    await snap(page, `между-блоками-${block + 1}`)
    const done = page.getByText('Занятие выполнено!')
    if (await done.isVisible().catch(() => false)) break
    await page.getByRole('button', { name: 'Дальше', exact: true }).click()
  }
  await page.getByRole('button', { name: 'На главный экран' }).click()
  await snap(page, 'сегодня-выполнено')

  // ——— Курс, собеседование, словарь, тренировка ———
  const nav = page.getByRole('navigation', { name: 'Разделы' })
  await nav.getByRole('link', { name: 'Курс' }).click()
  await page.waitForTimeout(600)
  await snap(page, 'курс')
  await page.getByText(/^Все модули/).first().click()
  await snap(page, 'курс-модули')
  await page.getByRole('button', { name: /Уровень по направлению: объяснить/ }).first().click()
  await snap(page, 'курс-объяснение-уровня')
  await page.getByRole('dialog').getByRole('button', { name: 'Понятно' }).click()

  await nav.getByRole('link', { name: 'Собеседование' }).click()
  await snap(page, 'собеседование')
  await page.getByRole('button', { name: 'STAR: объяснить' }).first().click()
  await snap(page, 'собеседование-star')
  await page.getByRole('dialog').getByRole('button', { name: 'Понятно' }).click()
  await page.getByRole('link', { name: /Tell me about yourself\./ }).click()
  await snap(page, 'собеседование-ответ')

  await nav.getByRole('link', { name: 'Словарь' }).click()
  await snap(page, 'словарь-фразы')
  for (const tab of ['Слова', 'Письма', 'На слух']) {
    await page.getByRole('radio', { name: tab }).click()
    await snap(page, `словарь-${tab}`)
  }

  await nav.getByRole('link', { name: 'Тренировка' }).click()
  await snap(page, 'тренировка')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await snap(page, 'тренировка-низ')
  await page.getByRole('link', { name: /Библиотека текстов/ }).click()
  await snap(page, 'библиотека')
  await page.getByRole('link', { name: /What a satellite bus does/ }).click()
  await page.getByRole('button', { name: 'Перевод абзаца' }).first().click()
  await snap(page, 'библиотека-текст-перевод')

  // ——— Профиль и настройки ———
  await nav.getByRole('link', { name: 'Сегодня' }).click()
  await page.getByRole('link', { name: 'Профиль, статистика и настройки' }).click()
  await snap(page, 'профиль')
  for (const [link, name] of [
    ['Статистика', 'статистика'],
    ['Достижения', 'достижения'],
    ['Настройки', 'настройки'],
    ['Как устроено приложение', 'как-устроено'],
  ] as const) {
    await page.getByRole('link', { name: new RegExp(`^${link}`) }).click()
    await snap(page, name)
    await page.goBack()
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Профиль' })).toBeVisible()
})
