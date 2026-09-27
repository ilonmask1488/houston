import { expect, test, type Page } from './fixtures.ts'
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
    if (phase === 'phase1') return

    // ——— Фаза 2: «Мой рассказ», собеседование, эпизоды ———
    await page.goto('./#/story')
    await shoot(page, 'p2-story', scheme, p)
    await page.goto('./#/story/problem')
    await page
      .getByLabel('Твой ответ по-английски')
      .fill(
        'In our composite project, the specimens kept breaking at the grips, so the results were useless. My task was to find out why. I compared the failure surfaces and suggested adding tabs. After that, almost all specimens failed in the middle, and the results became consistent.',
      )
    await page.getByText('Сохранено').waitFor()
    await shoot(page, 'p2-editor', scheme, p)
    await page.goto('./#/story/problem/train')
    await page.getByRole('button', { name: 'Дальше' }).click()
    await page.getByRole('button', { name: 'Дальше' }).click()
    await expect(page.getByText('Ответь по опорным словам')).toBeVisible()
    await shoot(page, 'p2-keys', scheme, p)
    await page.goto('./#/interview')
    await shoot(page, 'p2-interview', scheme, p)
    await page.goto('./#/tracks')
    await page.getByRole('link', { name: 'Эпизод 2: Первый день' }).scrollIntoViewIfNeeded()
    await shoot(page, 'p2-episodes', scheme, p)
    await page.goto('./#/episode/ep-2')
    await shoot(page, 'p2-episode-intro', scheme, p)
    await page.getByRole('button', { name: 'Дальше' }).click()
    await page.getByRole('button', { name: 'Дальше' }).click()
    await page.getByRole('button', { name: 'Дальше' }).click()
    await page.getByRole('group', { name: 'Что ответишь?' }).getByRole('button', { name: /settling in the chair/ }).click()
    await shoot(page, 'p2-episode-choice', scheme, p)
    if (phase === 'phase2') return

    // ——— Фаза 3: Техдок ———
    await page.goto('./#/library')
    await shoot(page, 'p3-library', scheme, p)
    await page.goto('./#/library/t-adapter-req')
    await page.locator('article').getByRole('button', { name: 'shall', exact: true }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.waitForTimeout(300)
    await shoot(page, 'p3-word', scheme, p)
    await page.goto('./#/run/text/t-adapter-req')
    await expect(page.getByRole('button', { name: 'Прочитал' })).toBeVisible()
    await shoot(page, 'p3-read', scheme, p)
    await page.getByRole('button', { name: 'Прочитал' }).click()
    const find = page.getByRole('group', { name: /нажми на предложение с ответом/ })
    await expect(find).toBeVisible()
    await shoot(page, 'p3-find', scheme, p)
    await find.getByRole('button').nth(1).click()
    await shoot(page, 'p3-find-feedback', scheme, p)
    await page.getByRole('button', { name: 'Дальше' }).click()
    await find.getByRole('button').first().click()
    await page.getByRole('button', { name: 'Дальше' }).click()
    await page.getByRole('group', { name: /краткое содержание/ }).getByRole('button').first().click()
    await shoot(page, 'p3-summary', scheme, p)
    await page.getByRole('button', { name: 'Дальше' }).click()
    await page.getByRole('group', { name: /Разбор: выбери/ }).getByRole('button').first().click()
    await shoot(page, 'p3-parse', scheme, p)
    await page.goto('./#/dictionary')
    await page.getByRole('radio', { name: 'Слова' }).click()
    await page.getByRole('button', { name: /Двигатели/ }).click()
    await shoot(page, 'p3-dictionary-words', scheme, p)
    await page.goto('./#/game/speedread')
    await page.getByRole('button', { name: 'Старт' }).click()
    await shoot(page, 'p3-speedread', scheme, p)
    await page.goto('./#/mytext')
    await page.getByLabel('Текст на английском').fill('The test article shall withstand a quasi-static load of 12 g along the launch axis without detrimental yielding. Margins of safety are calculated with a yield factor of 1.1 and an ultimate factor of 1.25.')
    await page.getByRole('button', { name: 'Открыть для чтения' }).click()
    await shoot(page, 'p3-mytext', scheme, p)
    if (phase === 'phase3') return

    // ——— Фаза 4: Телеграмма, Чистый сигнал, игры, боссы ———
    const got = page.getByRole('button', { name: 'Понятно, поехали' })
    await page.goto('./#/run/module/mail-register')
    await got.waitFor()
    await shoot(page, 'p4-mail-intro', scheme, p)
    await page.goto('./#/boss/mail')
    const reg = page.getByRole('group', { name: 'Выбери вариант' })
    await reg.waitFor()
    await shoot(page, 'p4-mail-register', scheme, p)
    await reg.getByRole('button').nth(1).click()
    await shoot(page, 'p4-mail-register-feedback', scheme, p)
    await page.goto('./#/run/module/clean-th')
    await got.waitFor()
    await shoot(page, 'p4-clean-intro', scheme, p)
    await got.click()
    await page.getByRole('group', { name: 'Какое слово прозвучало' }).waitFor()
    await shoot(page, 'p4-pair', scheme, p)
    await page.goto('./#/run/module/clean-stress')
    await got.click()
    await page.getByRole('group', { name: 'Слоги' }).getByRole('button').first().click()
    await shoot(page, 'p4-stress', scheme, p)
    await page.goto('./#/game/ff')
    await page.getByRole('button', { name: 'Старт' }).click()
    await shoot(page, 'p4-game-ff', scheme, p)
    await page.goto('./#/dictionary')
    await page.getByRole('radio', { name: 'Письма' }).click()
    await shoot(page, 'p4-mail-bank', scheme, p)
    await page.goto('./#/tracks')
    await page.getByRole('link', { name: /Письмо «сложному» заказчику/ }).scrollIntoViewIfNeeded()
    await shoot(page, 'p4-tracks-boss', scheme, p)
    await page.goto('./#/episode/ep-6')
    await shoot(page, 'p4-episode-6', scheme, p)
  })
}
