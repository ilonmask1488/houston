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
  DocText,
  Episode,
  FalseFriend,
  MailFix,
  MailOrder,
  MailRegister,
  MailWrite,
  MinimalPair,
  CleanPhrase,
  StressWord,
  StoryQuestion,
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
  storyQuestions: [],
  episodes: [],
  texts: [],
  mailRegister: [],
  mailFix: [],
  mailOrder: [],
  mailWrite: [],
  mailBank: [],
  pairs: [],
  cleanPhrases: [],
  stress: [],
  falseFriends: [],
  bosses: null,
}

export const textById = new Map<string, DocText>()
export const mailRegisterById = new Map<string, MailRegister>()
export const mailFixById = new Map<string, MailFix>()
export const mailOrderById = new Map<string, MailOrder>()
export const mailWriteById = new Map<string, MailWrite>()
export const pairById = new Map<string, MinimalPair>()
export const cleanPhraseById = new Map<string, CleanPhrase>()
export const stressById = new Map<string, StressWord>()
export const falseFriendById = new Map<string, FalseFriend>()

export const storyQuestionById = new Map<string, StoryQuestion>()
export const episodeById = new Map<string, Episode>()

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
export type ModuleItems = {
  phrases: Phrase[]
  passages: Passage[]
  chunks: Chunk[]
  questions: QuickQuestion[]
  translate: TranslateItem[]
  substitution: Substitution[]
  texts: DocText[]
  mailRegister: MailRegister[]
  mailFix: MailFix[]
  mailOrder: MailOrder[]
  mailWrite: MailWrite[]
  pairs: MinimalPair[]
  cleanPhrases: CleanPhrase[]
  stress: StressWord[]
}
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
    itemsByModule.set(m.id, {
      phrases: [],
      passages: [],
      chunks: [],
      questions: [],
      translate: [],
      substitution: [],
      texts: [],
      mailRegister: [],
      mailFix: [],
      mailOrder: [],
      mailWrite: [],
      pairs: [],
      cleanPhrases: [],
      stress: [],
    })
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
  index(storyQuestionById, raw.storyQuestions)
  index(episodeById, raw.episodes)
  index(textById, raw.texts)
  index(mailRegisterById, raw.mailRegister)
  index(mailFixById, raw.mailFix)
  index(mailOrderById, raw.mailOrder)
  index(mailWriteById, raw.mailWrite)
  index(pairById, raw.pairs)
  index(cleanPhraseById, raw.cleanPhrases)
  index(stressById, raw.stress)
  index(falseFriendById, raw.falseFriends)
  content.episodes = [...raw.episodes].sort((a, b) => a.n - b.n)
  const put = <K extends keyof ModuleItems>(key: K, list: ModuleItems[K]) => {
    for (const x of list) itemsByModule.get(x.module)?.[key].push(x as never)
  }
  put('phrases', raw.phrases)
  put('passages', raw.passages)
  put('chunks', raw.chunks)
  put('questions', raw.questions)
  put('translate', raw.translate)
  put('substitution', raw.substitution)
  put('texts', raw.texts)
  put('mailRegister', raw.mailRegister)
  put('mailFix', raw.mailFix)
  put('mailOrder', raw.mailOrder)
  put('mailWrite', raw.mailWrite)
  put('pairs', raw.pairs)
  put('cleanPhrases', raw.cleanPhrases)
  put('stress', raw.stress)
}

export function intake(): IntakeContent {
  return content.intake
}

/** Текст, который реально звучит у фразы (разговорная форма, если есть). */
export function spokenText(p: Pick<Phrase, 'text' | 'say'>): string {
  return p.say ?? p.text
}
