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
  })
}
