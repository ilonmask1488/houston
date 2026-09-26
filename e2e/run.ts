import { expect, type Page } from '@playwright/test'

const SUMMARY = /^(Сегмент пройден|Модуль «.*» закрыт!)$/

async function visible(page: Page, name: string | RegExp, exact = true): Promise<boolean> {
  return page
    .getByRole('button', { name, exact: typeof name === 'string' ? exact : undefined })
    .first()
    .isVisible({ timeout: 200 })
    .catch(() => false)
}

async function click(page: Page, name: string | RegExp, exact = true) {
  await page.getByRole('button', { name, exact: typeof name === 'string' ? exact : undefined }).first().click()
}

/** «Дальше», если он есть: на последнем шаге после ответа могут сразу открыться итоги. */
async function next(page: Page) {
  await page
    .getByRole('button', { name: 'Дальше', exact: true })
    .first()
    .click({ timeout: 5000 })
    .catch(() => {})
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

/** Пройти открытый сегмент до итогов, отвечая первым вариантом и «Хорошо». */
export async function runSegment(page: Page, maxSteps = 80): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    if (await page.getByRole('heading', { name: SUMMARY }).isVisible().catch(() => false)) return
    if (await visible(page, 'Понятно, поехали')) {
      await click(page, 'Понятно, поехали')
      continue
    }
    // Техдок: прочитал
    if (await visible(page, 'Прочитал')) {
      await click(page, 'Прочитал')
      continue
    }
    // Что прозвучало / акценты / Техдок (найти ответ, краткое содержание, разбор): первый вариант
    const choice = page
      .getByRole('group', { name: /Что прозвучало\?|Что сказали\?|нажми на предложение с ответом|краткое содержание|Разбор: выбери/ })
      .getByRole('button')
      .first()
    if ((await choice.isVisible().catch(() => false)) && (await choice.isEnabled({ timeout: 300 }).catch(() => false))) {
      await choice.click()
      await next(page)
      continue
    }
    // Диктант
    const input = page.locator('textarea')
    if ((await input.isVisible().catch(() => false)) && (await input.isEnabled({ timeout: 300 }).catch(() => false))) {
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
    if (await visible(page, 'Показать ответ')) {
      await click(page, 'Показать ответ')
      await click(page, /^Хорошо/)
      continue
    }
    // Говорение
    for (const name of ['Записать себя', 'Ответить вслух', 'Послушать', 'Скажи это вслух']) {
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
