import Dexie, { type EntityTable } from 'dexie'
import { DB_NAME, SCHEMA_VERSIONS } from './schema'
import type {
  AchievementRow,
  AnswerRow,
  CardRow,
  DayRow,
  EpisodeRow,
  GameRecordRow,
  InterviewRow,
  StoryRow,
  IntakeRow,
  MetaKey,
  MetaRow,
  ModuleProgressRow,
  ReviewRow,
  SessionRow,
  SettingsRow,
} from './types'

export class AppDB extends Dexie {
  settings!: EntityTable<SettingsRow, 'id'>
  meta!: EntityTable<MetaRow, 'key'>
  cards!: EntityTable<CardRow, 'id'>
  reviews!: EntityTable<ReviewRow, 'id'>
  days!: EntityTable<DayRow, 'date'>
  achievements!: EntityTable<AchievementRow, 'id'>
  gameRecords!: EntityTable<GameRecordRow, 'game'>
  answers!: EntityTable<AnswerRow, 'id'>
  intake!: EntityTable<IntakeRow, 'id'>
  moduleProgress!: EntityTable<ModuleProgressRow, 'moduleId'>
  sessions!: EntityTable<SessionRow, 'date'>
  stories!: EntityTable<StoryRow, 'id'>
  interviews!: EntityTable<InterviewRow, 'id'>
  episodes!: EntityTable<EpisodeRow, 'id'>

  constructor(name = DB_NAME) {
    super(name)
    for (const v of SCHEMA_VERSIONS) {
      const version = this.version(v.version).stores(v.stores)
      if (v.upgrade) version.upgrade(v.upgrade)
    }
  }

  async getMeta<T extends MetaRow['value']>(key: MetaKey): Promise<T | undefined> {
    return (await this.meta.get(key))?.value as T | undefined
  }

  async setMeta(key: MetaKey, value: MetaRow['value']): Promise<void> {
    await this.meta.put({ key, value })
  }

  async deleteMeta(key: MetaKey): Promise<void> {
    await this.meta.delete(key)
  }
}

export const db = new AppDB()

/**
  Таблицы прогресса — то, что стирает «Сбросить прогресс». Настройки и твои тексты («Мой рассказ») остаются:
  это не прогресс, а твоя работа — её удаляют отдельно, в редакторе ответа.
*/
export const PROGRESS_TABLES = ['cards', 'reviews', 'days', 'achievements', 'gameRecords', 'answers', 'intake', 'moduleProgress', 'sessions', 'interviews', 'episodes'] as const

export async function resetProgress(database: AppDB = db): Promise<void> {
  await database.transaction('rw', [...PROGRESS_TABLES, 'meta'], async () => {
    await Promise.all(PROGRESS_TABLES.map((t) => database.table(t).clear()))
    await database.meta.delete('intakeDraft')
  })
}
