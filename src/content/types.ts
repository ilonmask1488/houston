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

/* ——— Эфир ——— */

/** Фраза для аудирования. options[0] — верная расшифровка, остальные — ловушки. say — как произносит синтез (gonna). */
export type Phrase = {
  id: string
  module: string
  text: string
  say?: string
  options: string[]
  ru: string
  /** фрагмент, где живёт явление связной речи */
  focus: string
  voice: VoiceId
  /** для «Акцентов»: одна фраза разными голосами */
  voices?: VoiceId[]
  reviewed: boolean
}

export type Connected = { module: string; intro: string[]; rules: [string, string, string][]; tip: string }

export type Character = { id: string; name: string; role: string; voice: VoiceId }

export type Passage = {
  id: string
  module: string
  title: string
  kind: string
  situation: string
  lines: { speaker: string; voice: VoiceId; text: string }[]
  /** answer — индекс верного варианта (в данных всегда 0, приложение перемешивает) */
  questions: { q: string; options: string[]; answer: number }[]
  reviewed: boolean
}

/* ——— Позывной ——— */

export type Chunk = { id: string; module: string; fn: string; en: string; ru: string; example?: string; exampleRu?: string; reviewed: boolean }
export type QuickQuestion = { id: string; module: string; q: string; ru: string; voice: VoiceId; reviewed: boolean }
export type TranslateItem = { id: string; module: string; ru: string; en: string; reviewed: boolean }
export type Substitution = { id: string; module: string; base: string; ru: string; swaps: { cue: string; en: string }[]; reviewed: boolean }

/* ——— «Мой рассказ» и сюжет ——— */

export type StoryQuestion = {
  id: string
  q: string
  ru: string
  tip: string
  /** ответ по методу STAR */
  star: boolean
  /** образец ответа студента-инженера */
  example: string
  /** подходящие чанки */
  chunks: string[]
  voice: VoiceId
  reviewed: boolean
}

export type CharacterLine = { speaker: string; voice: VoiceId; text: string; ru: string }
export type MyLine = { speaker: 'me'; options: { text: string; ru: string; why: string | null }[] }
export type EpisodeLine = CharacterLine | MyLine

export function isMyLine(l: EpisodeLine): l is MyLine {
  return 'options' in l
}

export type Episode = {
  id: string
  n: number
  title: string
  place: string
  /** после какого модуля лучше смотреть */
  after: string
  intro: string
  lines: EpisodeLine[]
  culture: { title: string; text: string }
  reviewed: boolean
}

/* ——— Техдок ——— */

export type DocText = {
  id: string
  module: string
  level: 1 | 2 | 3
  topic: 'space' | 'prop' | 'mat' | 'test' | 'cad' | 'sens'
  /** жанр: статья, аннотация, даташит, требования… */
  kind: string
  title: string
  paragraphs: string[]
  /** по абзацам: [верное, ловушка, ловушка] */
  summaries: string[][]
  /** образец пересказа абзаца */
  retell: string[]
  /** вопрос и ключевая фраза из предложения-ответа */
  find: { q: string; key: string }[]
  parse: { sentence: string; parts: [string, string][]; q: string; options: string[]; answer: number }
  source: string
  license: string
  reviewed: boolean
}

/** Слово встроенного словаря: общие (полосы NGSL/NAWL) и технические (с МФА и звуком). */
export type DictWord = {
  id: string
  text: string
  ru: string
  band: 'ngsl1' | 'ngsl2' | 'ngsl3' | 'ngsl4' | 'nawl' | 'tech'
  rank?: number
  forms?: string[]
  ipa?: string
  topic?: string
  /** у технических: полоса частотности, если термин есть и в общем списке */
  freq?: string
  voices?: VoiceId[]
  reviewed: boolean
}

export type Content = {
  modules: Module[]
  intake: IntakeContent
  connected: Connected[]
  phrases: Phrase[]
  passages: Passage[]
  characters: Character[]
  chunks: Chunk[]
  questions: QuickQuestion[]
  translate: TranslateItem[]
  substitution: Substitution[]
  storyQuestions: StoryQuestion[]
  episodes: Episode[]
  texts: DocText[]
}
