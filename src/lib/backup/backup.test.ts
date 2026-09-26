import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { AppDB, resetProgress } from '../db/db'
import { CURRENT_SCHEMA_VERSION } from '../db/schema'
import {
  BACKUP_REMINDER_MS,
  BackupError,
  backupFileName,
  exportBackup,
  importBackup,
  parseBackup,
  shouldRemindBackup,
} from './backup'

let n = 0
const opened: AppDB[] = []
function freshDb(): AppDB {
  const d = new AppDB(`test-backup-${n++}`)
  opened.push(d)
  return d
}

afterEach(async () => {
  for (const d of opened.splice(0)) {
    d.close()
    await Dexie.delete(d.name)
  }
})

async function seed(d: AppDB): Promise<void> {
  await d.settings.put({ id: 'main', sessionMinutes: 45, variant: 'gb' })
  await d.setMeta('firstLaunchAt', 1000)
  await d.days.put({ date: '2026-09-25', seconds: 1800, signal: 90, spokenSeconds: 300, spokenCount: 12, newItems: 5 })
  await d.reviews.add({ cardId: 'c-clarify:1', at: 2000, rating: 4, durationMs: 1500 })
  await d.intake.add({ at: 3000, cefr: 'B1', tracks: { air: 30, call: 20, doc: 70, mail: 55, clean: 50 }, result: { version: 1 } })
}

describe('экспорт и импорт бэкапа', () => {
  it('данные проходят круг «экспорт → JSON → импорт» без изменений', async () => {
    const src = freshDb()
    await seed(src)
    const json = JSON.stringify(await exportBackup(src, '0.1.0'))

    const dst = freshDb()
    await dst.days.put({ date: '2020-01-01', seconds: 1, signal: 1, spokenSeconds: 0, spokenCount: 0, newItems: 0 })
    await importBackup(parseBackup(json), dst)

    expect(await dst.settings.get('main')).toEqual({ id: 'main', sessionMinutes: 45, variant: 'gb' })
    expect(await dst.days.toArray()).toHaveLength(1) // старые данные заменены, а не смешаны
    expect((await dst.reviews.toArray())[0]).toMatchObject({ cardId: 'c-clarify:1', rating: 4 })
    expect((await dst.intake.toArray())[0]).toMatchObject({ cefr: 'B1', tracks: { doc: 70 } })
    expect(await dst.getMeta('firstLaunchAt')).toBe(1000)
  })

  it('бэкап содержит метаданные формата', async () => {
    const b = await exportBackup(freshDb(), '0.1.0')
    expect(b).toMatchObject({ app: 'houston', format: 1, schemaVersion: CURRENT_SCHEMA_VERSION, appVersion: '0.1.0' })
  })

  it('понятные ошибки на чужом и битом файле, бэкап «Сяо Хо» узнаётся', () => {
    expect(() => parseBackup('не json')).toThrow(BackupError)
    expect(() => parseBackup('{"app":"other","tables":{}}')).toThrow(/не бэкап Houston/)
    expect(() => parseBackup('{"app":"xiao-huo","format":1,"schemaVersion":2,"tables":{}}')).toThrow(/Сяо Хо/)
    expect(() => parseBackup('{"app":"houston","format":99,"schemaVersion":1,"tables":{}}')).toThrow(/новой версией/)
    expect(() =>
      parseBackup(`{"app":"houston","format":1,"schemaVersion":${CURRENT_SCHEMA_VERSION + 1},"tables":{}}`),
    ).toThrow(/новой версией/)
    expect(() => parseBackup('{"app":"houston","format":1,"schemaVersion":1,"tables":{"days":5}}')).toThrow(/повреждён/)
  })

  it('неудачный импорт не портит текущие данные', async () => {
    const d = freshDb()
    await seed(d)
    const bad = { ...(await exportBackup(d)), tables: { days: [{ nodate: true }] } }
    await expect(importBackup(bad, d)).rejects.toThrow()
    expect(await d.days.count()).toBe(1)
    expect(await d.intake.count()).toBe(1)
  })

  it('сброс прогресса стирает прогресс и незаконченный тест, но не настройки', async () => {
    const d = freshDb()
    await seed(d)
    await d.setMeta('intakeDraft', '{}')
    await resetProgress(d)
    expect(await d.days.count()).toBe(0)
    expect(await d.intake.count()).toBe(0)
    expect(await d.getMeta('intakeDraft')).toBeUndefined()
    expect((await d.settings.get('main'))?.sessionMinutes).toBe(45)
  })

  it('имя файла содержит дату', () => {
    expect(backupFileName(new Date(2026, 8, 6))).toBe('houston-backup-2026-09-06.json')
  })
})

describe('напоминание о бэкапе', () => {
  const day = 24 * 60 * 60 * 1000
  it('не раньше чем через 2 недели после первого запуска', () => {
    expect(shouldRemindBackup(13 * day, 0, undefined, undefined)).toBe(false)
    expect(shouldRemindBackup(BACKUP_REMINDER_MS, 0, undefined, undefined)).toBe(true)
  })
  it('отсчёт от последнего бэкапа', () => {
    expect(shouldRemindBackup(20 * day, 0, 10 * day, undefined)).toBe(false)
    expect(shouldRemindBackup(24 * day, 0, 10 * day, undefined)).toBe(true)
  })
  it('после «Закрыть» молчит ещё 2 недели', () => {
    expect(shouldRemindBackup(20 * day, 0, undefined, 15 * day)).toBe(false)
    expect(shouldRemindBackup(29 * day, 0, undefined, 15 * day)).toBe(true)
  })
})
