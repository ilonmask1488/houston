import { expect, type Page } from '@playwright/test'

const SUMMARY = /^(Готово.*|Модуль «.*» пройден!)$/

async function visible(page: Page, name: string | RegExp, exact = true): Promise<boolean> {
  return page
    .getByRole('button', { name, exact: typeof name === 'string' ? exact : undefined })
    .first()
    .isVisible({ timeout: 200 })
    .catch(() => false)
}

async function click(page: Page, name: string | RegExp, exact = true) {
  // Шаг мог смениться между проверкой и кликом — не ждём вечно, цикл посмотрит заново.
  await page.getByRole('button', { name, exact: typeof name === 'string' ? exact : undefined }).first().click({ timeout: 5000 }).catch(() => {})
}

const summary = (page: Page) => page.getByRole('heading', { name: SUMMARY })

/**
  «Дальше» шага, если он есть. На итогах блока тоже есть «Дальше» (к следующему блоку) —
  его не трогаем: итоги видны вместе с этой кнопкой, поэтому проверяем их перед кликом.
*/
async function next(page: Page) {
  const btn = page.getByRole('button', { name: 'Дальше', exact: true }).first()
  await btn.waitFor({ timeout: 5000 }).catch(() => {})
  if (await summary(page).isVisible().catch(() => false)) return
  await btn.click({ timeout: 5000 }).catch(() => {})
}

/** Ответить голосом: с поддельным микрофоном (Android) — запись, без него — «Сказал». */
export async function speak(page: Page) {
  const allow = page.getByRole('button', { name: 'Понятно, записать', exact: true })
  const done = page.getByRole('button', { name: 'Готово', exact: true })
  const said = page.getByRole('button', { name: 'Сказал', exact: true })
  // Объяснение про микрофон появляется один раз и не сразу — ждём любой из трёх вариантов.
  await expect(allow.or(done).or(said).first()).toBeVisible({ timeout: 20_000 })
  if (await allow.isVisible()) await allow.click()
  await expect(done.or(said).first()).toBeVisible({ timeout: 20_000 })
  if (await done.isVisible()) {
    await page.waitForTimeout(700)
    await done.click()
  } else await said.click()
}

/** Пройти открытый сегмент до итогов, отвечая первым вариантом и «Вспомнил». */
export async function runSegment(page: Page, maxSteps = 200, opts: { checkHelp?: boolean; onScreen?: (title: string) => Promise<void> } = {}): Promise<void> {
  let lastTitle = ''
  for (let i = 0; i < maxSteps; i++) {
    if (await page.getByRole('heading', { name: SUMMARY }).isVisible().catch(() => false)) return
    // Для «прогулки новичка»: снимок каждого нового экрана упражнения
    if (opts.onScreen) {
      const title = (await page.locator('[class*="exTitle"]').first().textContent({ timeout: 300 }).catch(() => null)) ?? ''
      const counter = (await page.locator('[class*="count"]').first().textContent({ timeout: 300 }).catch(() => null)) ?? ''
      if (title && `${title}${counter}` !== lastTitle) {
        lastTitle = `${title}${counter}`
        await opts.onScreen(title)
      }
    }
    if (await visible(page, 'Понятно, поехали')) {
      await click(page, 'Понятно, поехали')
      continue
    }
    // У каждого экрана упражнения — инструкция глаголом и «?» (UX §4.1); объяснение модуля и итоги — не упражнения
    if (opts.checkHelp) {
      const intro = page.getByRole('button', { name: 'Понятно, поехали' })
      await expect(page.getByRole('button', { name: 'Как работает это упражнение' }).or(intro).or(summary(page)).first()).toBeVisible()
      if (await intro.isVisible()) continue
    }
    // Техдок: прочитал
    if (await visible(page, 'Прочитал')) {
      await click(page, 'Прочитал')
      continue
    }
    // Телеграмма: написать письмо и сравнить с образцом
    if (await visible(page, 'Сравнить с образцом')) {
      await page.locator('textarea').fill('Hi Tom,\n\nCould you send me the photos by Wednesday?\n\nThanks,\nIvan')
      await click(page, 'Сравнить с образцом')
      await next(page)
      continue
    }
    // Телеграмма: собрать письмо из блоков
    const pool = page.getByRole('group', { name: 'Собери письмо' })
    if (await pool.isVisible().catch(() => false)) {
      while (await pool.isVisible().catch(() => false)) await pool.getByRole('button').first().click()
      await click(page, 'Проверить')
      await next(page)
      continue
    }
    // Чистый сигнал: распознавание не разобрало слово — самооценка
    if (await visible(page, 'Похоже')) {
      await click(page, 'Похоже')
      await next(page)
      continue
    }
    // Что прозвучало / акценты / Техдок / письма / пары / ударение / ложные друзья: первый вариант
    const choice = page
      .getByRole('group', {
        name: /Что прозвучало\?|Что сказали\?|нажми на предложение с ответом|краткое содержание|Разбор: выбери|Выбери вариант|Как сказать естественно|Какое слово прозвучало|Варианты перевода|^Слоги$/,
      })
      .getByRole('button')
      .first()
    if ((await choice.isVisible().catch(() => false)) && (await choice.isEnabled({ timeout: 300 }).catch(() => false))) {
      await choice.click()
      await next(page)
      continue
    }
    // Диктант (у письма тоже textarea, но без «Проверить»)
    const input = page.locator('textarea')
    if ((await input.isVisible().catch(() => false)) && (await input.isEnabled({ timeout: 300 }).catch(() => false)) && (await visible(page, 'Проверить'))) {
      await input.fill('the test')
      await click(page, 'Проверить')
      await next(page)
      continue
    }
    // Лестница скоростей
    if (await visible(page, /^Послушать · \d/)) {
      await click(page, /^Послушать · \d/)
      await click(page, 'Понял')
      continue
    }
    if (await visible(page, 'Да, так и слышал')) {
      await click(page, 'Да, так и слышал')
      await next(page)
      continue
    }
    // Длинный отрывок
    if (await visible(page, 'Слушать отрывок')) {
      await click(page, 'Слушать отрывок')
      for (const g of await page.getByRole('group').all()) await g.getByRole('button').first().click()
      await click(page, 'Проверить ответы')
      await next(page)
      continue
    }
    // Карточки
    if (await visible(page, 'Проверить себя')) {
      await click(page, 'Проверить себя')
      await click(page, /^Вспомнил/)
      continue
    }
    // Говорение
    for (const name of ['Записать себя и сравнить', 'Записать себя', 'Ответить вслух', 'Послушать', 'Скажи это вслух']) {
      if (await visible(page, name)) {
        await click(page, name)
        await speak(page)
        break
      }
    }
    if (await visible(page, 'Понятно, записать')) {
      await speak(page)
      continue
    }
    if (await visible(page, 'Сказал так же')) {
      await click(page, 'Сказал так же')
      continue
    }
    if (await visible(page, 'Сказал')) {
      await click(page, 'Сказал')
      continue
    }
    // Запись началась сама (перевод на лету) — договорить и остановить
    if (await visible(page, 'Готово')) {
      await page.waitForTimeout(700)
      await click(page, 'Готово')
      continue
    }
    if (await visible(page, 'Дальше')) {
      await next(page)
      continue
    }
    await page.waitForTimeout(300)
  }
  await expect(page.getByRole('heading', { name: SUMMARY })).toBeVisible()
}

/** Сыграть открытую «Помехи» до конца раунда. */
export async function playStatic(page: Page): Promise<void> {
  await click(page, 'Старт')
  for (let i = 0; i < 60; i++) {
    if (await page.getByRole('heading', { name: 'Раунд окончен' }).isVisible().catch(() => false)) return
    const opt = page.getByRole('group', { name: 'Что прозвучало?' }).getByRole('button').first()
    if (await opt.isVisible().catch(() => false)) await opt.click({ timeout: 1000 }).catch(() => {})
    await page.waitForTimeout(400)
  }
  await expect(page.getByRole('heading', { name: 'Раунд окончен' })).toBeVisible({ timeout: 15_000 })
}
