/*
  Записи прогресса в IndexedDB. Правило: в базе только JSON-совместимые значения
  (время — числом миллисекунд, не Date), чтобы бэкап сохранялся и восстанавливался без потерь.
*/
import type { TrackId } from '../../content/types'

export type ThemeSetting = 'system' | 'light' | 'dark'
export type VoiceSetting = 'female' | 'male'
export type Variant = 'us' | 'gb'

export type Settings = {
  sessionMinutes: 20 | 30 | 45
  /** вариант языка: произношение образцов и написание (color / colour) */
  variant: Variant
  voice: VoiceSetting
  /** акценты в аудировании: все (US, UK, Индия, Австралия…) или только основной вариант */
  accents: 'all' | 'main'
  /** время на начало ответа в упражнениях с таймером */
  answerSeconds: 5 | 7 | 10
  /** распознавание речи (Web Speech API) там, где браузер умеет */
  asr: boolean
  sfx: boolean
  vibration: boolean
  theme: ThemeSetting
  desiredRetention: 0.85 | 0.9 | 0.95
}

export type SettingsRow = Partial<Settings> & { id: 'main' }

export type MetaKey =
  | 'firstLaunchAt'
  | 'lastBackupAt'
  | 'backupReminderDismissedAt'
  | 'installHintDismissedAt'
  | 'storagePersisted'
  | 'soundChecked'
  | 'micChecked'
  | 'micExplained'
  | 'asrExplained'
  /** незаконченный вводный тест (JSON) — можно прерваться и продолжить */
  | 'intakeDraft'
  /** 'both' — запись и распознавание вместе; 'asr-only' — телефон не даёт микрофон двоим сразу */
  | 'captureMode'

export type MetaRow = { key: MetaKey; value: number | boolean | string }

/** Карточка FSRS. Даты — миллисекунды. kind — тип карточки (lib/srs/srs.ts). */
export type CardRow = {
  id: string // `${itemId}:${kind}`
  itemId: string
  kind: number
  due: number
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  reps: number
  lapses: number
  state: 0 | 1 | 2 | 3
  lastReview?: number
  learningSteps?: number
  createdAt?: number
}

export type ReviewRow = {
  id?: number
  cardId: string
  at: number
  rating: 1 | 2 | 3 | 4
  durationMs: number
  stateBefore?: 0 | 1 | 2 | 3
  kind?: number
}

export type DayRow = {
  date: string // YYYY-MM-DD по местному времени
  seconds: number
  /** очки «уровня сигнала» за день */
  signal: number
  /** сколько секунд сказано вслух (по записи или по оценке длительности упражнения) */
  spokenSeconds: number
  spokenCount: number
  newItems: number
}

export type AchievementRow = { id: string; unlockedAt: number }

export type GameRecordRow = { game: string; best: number; weekBest: number; weekStart: string }

export type AnswerSource = 'intake' | 'lesson' | 'game' | 'session' | 'drill'

/** Один ответ — источник статистики: слабые звуки, скорость аудирования, паузы. */
export type AnswerRow = {
  id?: number
  at: number
  /** тип упражнения: 'listen', 'pair', 'dictation', 'quick', 'translate', 'vocab'… */
  kind: string
  source: AnswerSource
  track?: TrackId
  item: string
  expected: string
  given: string
  correct: boolean
  /** скорость воспроизведения (аудирование) */
  speed?: number
  /** акцент голоса (аудирование) */
  accent?: string
  /** явление связной речи или звук (для статистики слабых мест) */
  tag?: string
  /** время до начала ответа, мс (говорение) */
  latencyMs?: number
  /** длительность речи, мс */
  speechMs?: number
}

/** Итог вводного теста (подробности — в result, формат lib/intake/score.ts). */
export type IntakeRow = {
  id?: number
  at: number
  cefr: string
  tracks: Record<TrackId, number>
  result: unknown
}

/** Прогресс модуля трека. */
export type ModuleProgressRow = {
  moduleId: string
  startedAt: number
  completedAt?: number
  /** пройденные упражнения модуля */
  done: string[]
}
