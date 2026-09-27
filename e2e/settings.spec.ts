import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { seedIntake } from './helpers.ts'

test('тема, длительность и вариант языка сохраняются после перезагрузки', async ({ page }) => {
  await seedIntake(page)
  await page.goto('./#/settings')
  await page.getByRole('radio', { name: 'Тёмная' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('radio', { name: '45 мин' }).click()
  await page.getByRole('radio', { name: 'Британский' }).click()
  await expect(page.getByRole('radio', { name: 'Британский' })).toHaveAttribute('aria-checked', 'true')
  await page.waitForTimeout(300)

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('radio', { name: '45 мин' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('radio', { name: 'Британский' })).toHaveAttribute('aria-checked', 'true')
  await page.goto('./#/')
  await expect(page.getByText('~45 мин')).toBeVisible()
})

test('бэкап: сохранить → изменить → загрузить → всё вернулось', async ({ page }) => {
  await seedIntake(page)
  await page.goto('./#/settings')
  await page.getByRole('radio', { name: '20 мин' }).click()
  await expect(page.getByRole('radio', { name: '20 мин' })).toHaveAttribute('aria-checked', 'true')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Сохранить бэкап' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^houston-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const file = await download.path()
  const json = JSON.parse(await readFile(file, 'utf8'))
  expect(json).toMatchObject({ app: 'houston', format: 1 })
  expect(json.tables.intake).toHaveLength(1)
  await expect(page.getByText(/Последний бэкап:/)).toBeVisible()

  await page.getByRole('radio', { name: '45 мин' }).click()
  await page.getByRole('button', { name: 'Сбросить прогресс' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Да, стереть' }).click()
  await expect(page.getByText(/Прогресс сброшен/)).toBeVisible()

  await page.getByTestId('backup-file').setInputFiles(file)
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Загрузить бэкап' }).click()
  await expect(page.getByText('Готово: прогресс восстановлен из бэкапа.')).toBeVisible()
  await expect(page.getByRole('radio', { name: '20 мин' })).toHaveAttribute('aria-checked', 'true')
  await page.goto('./#/')
  await expect(page.getByText('≈ B1')).toBeVisible()
})

test('бэкап «Сяо Хо» вместо Houston — понятная ошибка, данные не тронуты', async ({ page }) => {
  await page.goto('./#/settings')
  await page.getByRole('radio', { name: '45 мин' }).click()
  await page.getByTestId('backup-file').setInputFiles({
    name: 'xiaohuo-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"app":"xiao-huo","format":1,"schemaVersion":2,"tables":{}}'),
  })
  await expect(page.getByText(/Это бэкап «Сяо Хо»/)).toBeVisible()
  await expect(page.getByRole('radio', { name: '45 мин' })).toHaveAttribute('aria-checked', 'true')
})
