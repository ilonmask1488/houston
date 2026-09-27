import { expect, test } from './fixtures.ts'

test('после первой загрузки приложение открывается без сети', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'service worker в WebKit-сборке Playwright под Windows не поддерживается')

  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Начать вводный тест' })).toBeVisible()
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready
    if (reg.active?.state !== 'activated') {
      await new Promise<void>((r) => reg.active?.addEventListener('statechange', () => r()))
    }
  })

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Начать вводный тест' })).toBeVisible()
  await page.getByRole('navigation').getByRole('link', { name: 'Курс' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Курс' })).toBeVisible()
  // Шрифты тоже из кэша: знаки транскрипции рисуются IBM Plex Sans, кириллица — Plex Sans Condensed
  const fonts = await page.evaluate(async () => {
    await document.fonts.load('16px "IBM Plex Sans"', 'ðθŋʃəˈː')
    await document.fonts.load('600 16px "IBM Plex Sans Condensed"', 'Эфир')
    return [document.fonts.check('16px "IBM Plex Sans"', 'ðθŋʃəˈː'), document.fonts.check('600 16px "IBM Plex Sans Condensed"', 'Эфир')]
  })
  expect(fonts).toEqual([true, true])
  await context.setOffline(false)
})
