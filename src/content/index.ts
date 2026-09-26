/*
  Учебный контент и индексы по нему. JSON лежит в отдельном куске бандла (data.ts) и грузится один раз
  до первого рендера — loadContent() в main.tsx (в тестах — test-setup.ts).
  Индексы заполняются на месте: импортировать их можно как обычные константы, пусты они только до загрузки.
*/
import type {
  Character,
  Chunk,
  Connected,
  Content,
  IntakeContent,
  Module,
  Passage,
  Phrase,
  QuickQuestion,
  Substitution,
  TrackId,
  TranslateItem,
} from './types'

export const content: Content = {
  modules: [],
  intake: { bands: [], words: [], pseudo: [], listening: [], pairs: [], reading: [], speaking: [], soundCheck: [], micPhrase: '' },
  connected: [],
  phrases: [],
  passages: [],
  characters: [],
  chunks: [],
  questions: [],
  translate: [],
  substitution: [],
}

export const moduleById = new Map<string, Module>()
export const modulesByTrack = new Map<TrackId, Module[]>()
export const connectedByModule = new Map<string, Connected>()
export const phraseById = new Map<string, Phrase>()
export const passageById = new Map<string, Passage>()
export const characterById = new Map<string, Character>()
export const chunkById = new Map<string, Chunk>()
export const questionById = new Map<string, QuickQuestion>()
export const translateById = new Map<string, TranslateItem>()
export const substById = new Map<string, Substitution>()

/** Что лежит в модуле: id всех его упражнений по видам. */
export type ModuleItems = { phrases: Phrase[]; passages: Passage[]; chunks: Chunk[]; questions: QuickQuestion[]; translate: TranslateItem[]; substitution: Substitution[] }
export const itemsByModule = new Map<string, ModuleItems>()

let loading: Promise<void> | null = null

export function loadContent(): Promise<void> {
  loading ??= import('./data').then(({ raw }) => fill(raw))
  return loading
}

function index<T extends { id: string }>(map: Map<string, T>, list: T[]) {
  map.clear()
  for (const x of list) map.set(x.id, x)
}

export function fill(raw: Content): void {
  Object.assign(content, raw)
  moduleById.clear()
  modulesByTrack.clear()
  itemsByModule.clear()
  for (const m of [...raw.modules].sort((a, b) => a.order - b.order)) {
    moduleById.set(m.id, m)
    modulesByTrack.set(m.track, [...(modulesByTrack.get(m.track) ?? []), m])
    itemsByModule.set(m.id, { phrases: [], passages: [], chunks: [], questions: [], translate: [], substitution: [] })
  }
  connectedByModule.clear()
  for (const c of raw.connected) connectedByModule.set(c.module, c)
  index(phraseById, raw.phrases)
  index(passageById, raw.passages)
  index(characterById, raw.characters)
  index(chunkById, raw.chunks)
  index(questionById, raw.questions)
  index(translateById, raw.translate)
  index(substById, raw.substitution)
  const put = <K extends keyof ModuleItems>(key: K, list: ModuleItems[K]) => {
    for (const x of list) itemsByModule.get(x.module)?.[key].push(x as never)
  }
  put('phrases', raw.phrases)
  put('passages', raw.passages)
  put('chunks', raw.chunks)
  put('questions', raw.questions)
  put('translate', raw.translate)
  put('substitution', raw.substitution)
}

export function intake(): IntakeContent {
  return content.intake
}

/** Текст, который реально звучит у фразы (разговорная форма, если есть). */
export function spokenText(p: Pick<Phrase, 'text' | 'say'>): string {
  return p.say ?? p.text
}
