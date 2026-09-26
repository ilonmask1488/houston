import { db, type AppDB } from '../db/db'
import { CURRENT_SCHEMA_VERSION, SCHEMA_VERSIONS, TABLE_NAMES, type BackupTables } from '../db/schema'

/** Бэкапы «Houston» и «Сяо Хо» не смешиваются: у каждого свой id. */
export const BACKUP_APP_ID = 'houston'
export const BACKUP_FORMAT = 1

export type Backup = {
  app: typeof BACKUP_APP_ID
  format: number
  schemaVersion: number
  appVersion: string
  exportedAt: number
  tables: BackupTables
}

export class BackupError extends Error {}

export async function exportBackup(database: AppDB = db, appVersion = 'dev'): Promise<Backup> {
  const tables: BackupTables = {}
  await database.transaction('r', TABLE_NAMES, async () => {
    for (const name of TABLE_NAMES) tables[name] = await database.table(name).toArray()
  })
  return {
    app: BACKUP_APP_ID,
    format: BACKUP_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion,
    exportedAt: Date.now(),
    tables,
  }
}

/** Проверяет файл бэкапа и приводит его таблицы к текущей схеме. */
export function parseBackup(text: string): Backup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('Это не файл бэкапа: не получается прочитать JSON.')
  }
  if (!isRecord(data) || data.app !== BACKUP_APP_ID || !isRecord(data.tables)) {
    const other = isRecord(data) && data.app === 'xiao-huo'
    throw new BackupError(
      other
        ? 'Это бэкап «Сяо Хо» — его загружают в приложение для китайского. Для Houston выбери файл houston-backup-….json.'
        : 'Это не бэкап Houston. Выбери файл, который приложение сохранило само.',
    )
  }
  if (typeof data.format !== 'number' || data.format > BACKUP_FORMAT) {
    throw new BackupError('Бэкап сделан более новой версией приложения. Обнови приложение и попробуй снова.')
  }
  const schemaVersion = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0
  if (schemaVersion < 1 || schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new BackupError('Бэкап сделан более новой версией приложения. Обнови приложение и попробуй снова.')
  }
  let tables: BackupTables = {}
  for (const [name, rows] of Object.entries(data.tables)) {
    if (!Array.isArray(rows)) throw new BackupError(`Файл бэкапа повреждён: таблица «${name}» не список.`)
    tables[name] = rows
  }
  for (const v of SCHEMA_VERSIONS) {
    if (v.version > schemaVersion && v.migrateBackup) tables = v.migrateBackup(tables)
  }
  return { ...(data as Backup), schemaVersion: CURRENT_SCHEMA_VERSION, tables }
}

/** Полностью заменяет данные на устройстве данными из бэкапа (в одной транзакции). */
export async function importBackup(backup: Backup, database: AppDB = db): Promise<void> {
  await database.transaction('rw', TABLE_NAMES, async () => {
    for (const name of TABLE_NAMES) {
      const table = database.table(name)
      await table.clear()
      const rows = backup.tables[name]
      if (rows?.length) await table.bulkPut(rows)
    }
  })
}

export function backupFileName(now = new Date()): string {
  const d = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return `houston-backup-${d}.json`
}

/** Сохранить бэкап файлом и отметить дату — от неё считается напоминание. */
export async function downloadBackup(database: AppDB = db): Promise<void> {
  const backup = await exportBackup(database, __APP_VERSION__)
  const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = backupFileName()
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  await database.setMeta('lastBackupAt', Date.now())
}

export const BACKUP_REMINDER_MS = 14 * 24 * 60 * 60 * 1000

/**
  Напоминать о бэкапе раз в две недели. Отсчёт — от последнего бэкапа
  (или от первого запуска), а после «Закрыть» — от момента закрытия.
*/
export function shouldRemindBackup(
  now: number,
  firstLaunchAt: number | undefined,
  lastBackupAt: number | undefined,
  dismissedAt: number | undefined,
): boolean {
  const since = Math.max(lastBackupAt ?? firstLaunchAt ?? now, dismissedAt ?? 0)
  return now - since >= BACKUP_REMINDER_MS
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
