/*
  Типы учебного контента. Весь сгенерированный контент — reviewed: false до ручной проверки
  (npm run check:content считает долю непроверенного).
*/

/** Пять треков: Эфир (аудирование), Позывной (говорение), Техдок (чтение), Телеграмма (переписка), Чистый сигнал (произношение). */
export type TrackId = 'air' | 'call' | 'doc' | 'mail' | 'clean'
export const TRACKS: TrackId[] = ['air', 'call', 'doc', 'mail', 'clean']

export type Accent = 'us' | 'gb' | 'in' | 'au'
/** Голоса edge-tts: акцент + пол. Персонажи сюжета получают свои голоса из этого же набора. */
export type VoiceId = 'us-f' | 'us-m' | 'gb-f' | 'gb-m' | 'in-f' | 'in-m' | 'au-f' | 'au-m'
export const VOICES: VoiceId[] = ['us-f', 'us-m', 'gb-f', 'gb-m', 'in-f', 'in-m', 'au-f', 'au-m']

export function accentOf(v: VoiceId): Accent {
  return v.slice(0, 2) as Accent
}

export type Module = {
  id: string
  track: TrackId
  order: number
  /** уровень сложности 1–5: с какого модуля стартовать после теста */
  level: 1 | 2 | 3 | 4 | 5
  title: string
  what: string
}

export type BandId = 'ngsl1' | 'ngsl2' | 'ngsl3' | 'ngsl4' | 'nawl' | 'bsl'

export type IntakeBand = { id: BandId; label: string; source: 'ngsl' | 'nawl' | 'bsl'; from?: number; to?: number; size: number }
export type IntakeWord = { w: string; ru: string; band: BandId }
/** Фраза для аудирования: text — как пишется; say — что произносит синтез, если отличается (gonna). options[0] — верный. */
export type IntakeListening = { id: string; voice: VoiceId; tag: string; text: string; say?: string; options: string[] }
export type IntakePair = { id: string; voice: VoiceId; tag: string; answer: string; options: string[] }
export type IntakeQuestion = { q: string; options: string[]; answer: number }
export type IntakeReading = {
  id: string
  level: 1 | 2
  title: string
  text: string
  source: string
  license: string
  questions: IntakeQuestion[]
}
export type IntakeSpeaking = { id: string; voice: VoiceId; q: string; ru: string }

export type IntakeContent = {
  bands: IntakeBand[]
  words: IntakeWord[]
  pseudo: string[]
  listening: IntakeListening[]
  pairs: IntakePair[]
  reading: IntakeReading[]
  speaking: IntakeSpeaking[]
  soundCheck: { voice: VoiceId; text: string }[]
  micPhrase: string
}

export type Content = {
  modules: Module[]
  intake: IntakeContent
}
