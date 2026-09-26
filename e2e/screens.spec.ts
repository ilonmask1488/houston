import { expect, test, type Page } from '@playwright/test'
import { knowUntilVerify, seedIntake } from './helpers.ts'

/*
  Скриншоты ключевых экранов для проверки дизайна глазами.
  Запуск: SCREENS=phase0 npx playwright test screens
  Результат — docs/screens/<SCREENS>/.
*/
const phase = process.env.SCREENS
test.skip(!phase, 'скриншоты снимаются только по запросу: SCREENS=<папка>')

async function shoot(page: Page, name: string, scheme: string, project: string) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `docs/screens/${phase}/${project}-${scheme}-${name}.png` })
}

for (const scheme of ['light', 'dark'] as const) {
  test(`экраны, тема ${scheme}`, async ({ page }, info) => {
    test.setTimeout(240_000)
    const p = info.project.name
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.goto('./')
    await page.waitForTimeout(5000) // «готово офлайн» исчезает само

    await shoot(page, 'home-first', scheme, p)
    await page.goto('./#/intake')
    await shoot(page, 'intake-intro', scheme, p)
    await page.getByRole('button', { name: 'Поехали' }).click()
    await shoot(page, 'intake-vocab', scheme, p)
    await knowUntilVerify(page)
    await shoot(page, 'intake-verify', scheme, p)
    await page.getByRole('button', { name: 'Не уверен' }).click()
    for (let i = 0; i < 25; i++) {
      const dont = page.getByRole('button', { name: 'Не знаю', exact: true })
      if (!(await dont.isVisible().catch(() => false))) break
      await dont.click()
      await page.waitForTimeout(60)
    }
    await page.getByRole('button', { name: /^Послушать · / }).click()
    await expect(page.getByRole('group', { name: 'Что прозвучало?' })).toBeVisible()
    await shoot(page, 'intake-listen', scheme, p)
    await page.getByRole('button', { name: 'Не разобрал' }).click()
    await shoot(page, 'intake-listen-feedback', scheme, p)

    await seedIntake(page)
    for (const [name, path] of [
      ['home', '/'],
      ['profile', '/profile'],
      ['tracks', '/tracks'],
      ['story', '/story'],
      ['dictionary', '/dictionary'],
      ['more', '/more'],
      ['check', '/check'],
      ['achievements', '/achievements'],
      ['settings', '/settings'],
      ['about', '/about'],
    ] as const) {
      await page.goto(`./#${path}`)
      await expect(page.locator('main').first()).toBeAttached()
      await shoot(page, name, scheme, p)
    }
    if (phase === 'phase0') return

    // ——— Фаза 1: сеанс, упражнения Эфира и Позывного, игры, статистика ———
    await page.goto('./#/session')
    await expect(page.getByText(/игра «Помехи»/)).toBeVisible()
    await shoot(page, 'p1-session', scheme, p)
    await page.goto('./#/run/seg/air-1')
    await shoot(page, 'p1-intro', scheme, p)
    await page.getByRole('button', { name: 'Понятно, поехали' }).click()
    await expect(page.getByRole('group', { name: 'Что прозвучало?' })).toBeVisible()
    await shoot(page, 'p1-listen', scheme, p)
    await page.getByRole('group', { name: 'Что прозвучало?' }).getByRole('button').nth(1).click()
    await shoot(page, 'p1-listen-feedback', scheme, p)
    await page.goto('./#/run/module/air-elision')
    await page.waitForTimeout(300)
    for (const [name, path, act] of [
      ['p1-tracks', '/tracks', null],
      ['p1-dictionary', '/dictionary', null],
      ['p1-games', '/games', null],
      ['p1-game-static', '/game/static', 'Старт'],
      ['p1-game-quick', '/game/quick', null],
    ] as const) {
      await page.goto(`./#${path}`)
      await expect(page.locator('main').first()).toBeAttached()
      if (act) {
        await page.getByRole('button', { name: act }).click()
        await page.getByRole('group', { name: 'Что прозвучало?' }).waitFor()
      }
      await shoot(page, name, scheme, p)
    }
    // Позывной: чанк и перевод на лету
    await page.goto('./#/run/module/call-intro')
    await expect(page.getByText(/функция: представиться/)).toBeVisible()
    await shoot(page, 'p1-chunk', scheme, p)
    // Длинный отрывок после ответа
    await page.goto('./#/run/module/air-long')
    const intro = page.getByRole('button', { name: 'Понятно, поехали' })
    const listen = page.getByRole('button', { name: 'Слушать отрывок' })
    await expect(intro.or(listen).first()).toBeVisible()
    if (await intro.isVisible()) await intro.click()
    await listen.click()
    for (const g of await page.getByRole('group').all()) await g.getByRole('button').first().click()
    await page.getByRole('button', { name: 'Проверить ответы' }).click()
    await shoot(page, 'p1-passage', scheme, p)
    await page.goto('./#/stats')
    await shoot(page, 'p1-stats', scheme, p)
  })
}
