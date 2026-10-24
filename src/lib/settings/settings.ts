import { useLiveQuery } from 'dexie-react-hooks'
import { db, type AppDB } from '../db/db'
import type { Field } from '../../content/types'
import type { Settings } from '../db/types'

/** По умолчанию занятие 30 минут: параллельно идёт китайский в «Сяо Хо». */
export const DEFAULT_SETTINGS: Settings = {
  sessionMinutes: 30,
  variant: 'us',
  voice: 'female',
  accents: 'all',
  answerSeconds: 5,
  asr: true,
  sfx: true,
  vibration: true,
  theme: 'system',
  desiredRetention: 0.9,
}

export async function loadSettings(database: AppDB = db): Promise<Settings> {
  const { id: _id, ...stored } = (await database.settings.get('main')) ?? { id: 'main' }
  return { ...DEFAULT_SETTINGS, ...stored }
}

export async function updateSettings(patch: Partial<Settings>, database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.settings, async () => {
    const current = (await database.settings.get('main')) ?? { id: 'main' as const }
    await database.settings.put({ ...current, ...patch, id: 'main' })
  })
}

/** Живые настройки: до первого чтения из базы — значения по умолчанию. */
export function useSettings(): Settings {
  return useLiveQuery(() => loadSettings(), [], DEFAULT_SETTINGS)
}

/*
  Тема дублируется в localStorage, чтобы inline-скрипт в index.html применил её
  до отрисовки и не было вспышки светлой темы. Хранилище может быть недоступно
  (приватный режим) — тогда просто работаем без зеркала.
*/
const MIRROR_KEY = 'houston:appearance'
export const THEME_COLORS = { light: '#e9ece8', dark: '#0e1215' }

export function applyAppearance(s: Pick<Settings, 'theme'>): void {
  const root = document.documentElement
  if (s.theme === 'system') delete root.dataset.theme
  else root.dataset.theme = s.theme

  // Два meta theme-color с media: при «системной» теме браузер выбирает сам,
  // при ручной — оба получают цвет выбранной темы.
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
  metas.forEach((m) => {
    const own = m.media.includes('dark') ? THEME_COLORS.dark : THEME_COLORS.light
    m.content = s.theme === 'system' ? own : THEME_COLORS[s.theme]
  })

  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify({ theme: s.theme }))
  } catch {
    /* нет доступа к localStorage — не критично */
  }
}

/*
  Специальность нужна до загрузки контента (по ней фильтруются тексты и термины) и до отрисовки
  (по ней стиль), поэтому кроме базы она лежит в localStorage — читается мгновенно.
*/
const FIELD_KEY = 'houston:field'

/** Специальность, выбранная раньше; undefined — ещё не выбирали (первый запуск). */
export async function storedField(database: AppDB = db): Promise<Field | undefined> {
  try {
    const v = localStorage.getItem(FIELD_KEY)
    if (v === 'space' || v === 'mech') return v
  } catch {
    /* localStorage недоступен — берём из базы */
  }
  return (await loadSettings(database)).field
}

/** Сохранить специальность. Контент и стиль применяются при старте — после смены нужна перезагрузка. */
export async function saveField(field: Field, database: AppDB = db): Promise<void> {
  await updateSettings({ field }, database)
  try {
    localStorage.setItem(FIELD_KEY, field)
  } catch {
    /* без зеркала — прочитаем из базы */
  }
}
