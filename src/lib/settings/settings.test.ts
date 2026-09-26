import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppDB } from '../db/db'
import { DEFAULT_SETTINGS, loadSettings, updateSettings } from './settings'

let d: AppDB
beforeEach(() => {
  d = new AppDB('test-settings')
})
afterEach(async () => {
  d.close()
  await Dexie.delete(d.name)
})

describe('настройки', () => {
  it('без записи в базе — значения по умолчанию', async () => {
    expect(await loadSettings(d)).toEqual(DEFAULT_SETTINGS)
  })

  it('изменения накладываются частично и сохраняются', async () => {
    await updateSettings({ theme: 'dark' }, d)
    await updateSettings({ sessionMinutes: 45, variant: 'gb' }, d)
    expect(await loadSettings(d)).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark', sessionMinutes: 45, variant: 'gb' })
  })

  it('по умолчанию: 30 минут, американский вариант, все акценты, 5 секунд на начало ответа', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ sessionMinutes: 30, variant: 'us', accents: 'all', answerSeconds: 5, desiredRetention: 0.9 })
  })
})
