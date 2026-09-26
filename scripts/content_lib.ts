/*
  Общее для проверки контента: чтение JSON, частотные списки (NGSL/NAWL/BSL), какой звук нужен.
  Правила «какой звук нужен» — те же, что в scripts/audio_lib.py (collect_needs).
*/
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { splitSentences } from '../src/lib/story/text.ts'

export type JsonFile = { path: string; data: unknown }

export function loadContentFiles(root: string): JsonFile[] {
  const dir = join(root, 'src/content')
  const out: JsonFile[] = []
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (name.endsWith('.json')) out.push({ path: relative(root, p).replaceAll('\\', '/'), data: JSON.parse(readFileSync(p, 'utf8')) })
    }
  }
  walk(dir)
  return out
}

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Пары «текст|голос», которым нужен звук. */
export function audioNeeds(data: unknown): Set<string> {
  const out = new Set<string>()
  const add = (text: unknown, voice: unknown) => {
    if (typeof text === 'string' && text.trim() && typeof voice === 'string') out.add(`${text.trim()}|${voice}`)
  }
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk)
    if (!isRec(v)) return
    const spoken = v.say || v.text || v.q
    if (typeof v.voice === 'string') {
      if (typeof v.answer === 'string' && Array.isArray(v.options)) v.options.forEach((o) => add(o, v.voice))
      else add(spoken, v.voice)
    }
    if (Array.isArray(v.voices)) v.voices.forEach((voice) => add(spoken, voice))
    if (Array.isArray(v.speak)) v.speak.forEach((s) => isRec(s) && add(s.text, s.voice))
    for (const [k, x] of Object.entries(v)) if (k !== 'speak') walk(x)
  }
  walk(data)
  return out
}

/** Сколько объектов с флагом reviewed и сколько из них не проверено. */
export function reviewedStats(data: unknown): { total: number; unreviewed: number } {
  let total = 0
  let unreviewed = 0
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk)
    if (!isRec(v)) return
    if (typeof v.reviewed === 'boolean') {
      total++
      if (!v.reviewed) unreviewed++
    }
    Object.values(v).forEach(walk)
  }
  walk(data)
  return { total, unreviewed }
}

export type WordLists = { ngslRank: Map<string, number>; nawl: Set<string>; bsl: Set<string>; allForms: Set<string> }

function lemmaLines(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean))
}

export function loadWordLists(root: string): WordLists {
  const src = (f: string) => readFileSync(join(root, 'data/sources', f), 'utf8')
  const ngslRank = new Map<string, number>()
  for (const [i, line] of src('NGSL_12_stats.csv').split(/\r?\n/).entries()) {
    if (i === 0 || !line.trim()) continue
    const [lemma, rank] = line.split(',')
    ngslRank.set(lemma!.trim().toLowerCase(), Number(rank))
  }
  const allForms = new Set<string>()
  const nawl = new Set<string>()
  const bsl = new Set<string>()
  for (const forms of lemmaLines(src('NGSL_12_lemmatized_for_teaching.csv'))) forms.forEach((f) => allForms.add(f))
  for (const forms of lemmaLines(src('NAWL_12_lemmatized_for_teaching.csv'))) {
    nawl.add(forms[0]!)
    forms.forEach((f) => allForms.add(f))
  }
  for (const forms of lemmaLines(src('BSL_101_lemmatized_for_teaching.txt'))) {
    bsl.add(forms[0]!)
    forms.forEach((f) => allForms.add(f))
  }
  return { ngslRank, nawl, bsl, allForms }
}

type Json = Record<string, unknown>

/**
  Связность контента фаз 1+: модули существуют, id уникальны, у фраз первый вариант — верный,
  у отрывков ответы в пределах вариантов и говорящие есть среди персонажей, чанки не повторяются.
*/
export function checkCourse(files: JsonFile[]): string[] {
  const errors: string[] = []
  const get = (suffix: string) => (files.find((f) => f.path.endsWith(suffix))?.data ?? []) as Json[]
  const modules = new Set(get('content/modules.json').map((m) => m.id as string))
  const characters = new Set(get('content/characters.json').map((c) => c.id as string))
  const ids = new Map<string, string>()
  const collections: [string, Json[]][] = [
    ['air/phrases.json', get('air/phrases.json')],
    ['air/passages.json', get('air/passages.json')],
    ['call/chunks.json', get('call/chunks.json')],
    ['call/questions.json', get('call/questions.json')],
    ['call/translate.json', get('call/translate.json')],
    ['call/substitution.json', get('call/substitution.json')],
  ]
  for (const [file, list] of collections) {
    for (const x of list) {
      const id = x.id as string
      if (ids.has(id)) errors.push(`повтор id ${id} (${file} и ${ids.get(id)})`)
      ids.set(id, file)
      if (!modules.has(x.module as string)) errors.push(`${file}: ${id} — нет модуля ${String(x.module)}`)
      if (typeof x.reviewed !== 'boolean') errors.push(`${file}: ${id} — нет флага reviewed`)
    }
  }
  for (const p of get('air/phrases.json')) {
    const opts = p.options as string[]
    if (opts[0] !== p.text) errors.push(`фраза ${String(p.id)}: первый вариант должен совпадать с текстом`)
    if (new Set(opts).size !== opts.length) errors.push(`фраза ${String(p.id)}: варианты повторяются`)
    const focus = String(p.focus ?? '').split('→')[0]!.split('…')[0]!.trim().toLowerCase()
    if (focus && !String(p.text).toLowerCase().includes(focus)) errors.push(`фраза ${String(p.id)}: фокус «${focus}» не найден в тексте`)
  }
  for (const p of get('air/passages.json')) {
    for (const l of p.lines as Json[]) if (!characters.has(l.speaker as string)) errors.push(`отрывок ${String(p.id)}: нет персонажа ${String(l.speaker)}`)
    for (const q of p.questions as Json[]) {
      const n = (q.options as string[]).length
      if ((q.answer as number) < 0 || (q.answer as number) >= n) errors.push(`отрывок ${String(p.id)}: индекс ответа вне вариантов`)
    }
  }
  const chunkIds = new Set(get('call/chunks.json').map((c) => c.id as string))
  for (const q of get('story/questions.json')) {
    for (const c of q.chunks as string[]) if (!chunkIds.has(c)) errors.push(`вопрос «${String(q.id)}»: нет чанка ${c}`)
    if (typeof q.reviewed !== 'boolean') errors.push(`вопрос «${String(q.id)}»: нет флага reviewed`)
  }
  for (const e of get('story/episodes.json')) {
    if (!modules.has(e.after as string)) errors.push(`эпизод ${String(e.id)}: нет модуля ${String(e.after)}`)
    for (const l of e.lines as Json[]) {
      if (l.speaker === 'me') {
        const opts = l.options as Json[]
        if (opts[0]?.why !== null || opts.slice(1).some((o) => !o.why)) errors.push(`эпизод ${String(e.id)}: у верного варианта why = null, у неверных — объяснение`)
      } else if (!characters.has(l.speaker as string)) errors.push(`эпизод ${String(e.id)}: нет персонажа ${String(l.speaker)}`)
    }
  }
  const chunkTexts = new Set<string>()
  for (const c of get('call/chunks.json')) {
    const key = String(c.en).toLowerCase()
    if (chunkTexts.has(key)) errors.push(`чанк «${String(c.en)}» повторяется`)
    chunkTexts.add(key)
  }
  errors.push(...checkDoc(get('doc/texts.json'), get('doc/strategies.json'), modules, ids))
  errors.push(...checkDictionary(get('dict/words.json')))
  return errors
}

/**
  Техдок: у каждого абзаца три разных кратких содержания и образец пересказа; ключ «найди ответ»
  стоит ровно в одном предложении текста (иначе верными окажутся два); индекс ответа разбора в пределах вариантов.
*/
export function checkDoc(texts: Json[], strategies: Json[], modules: Set<string>, ids: Map<string, string>): string[] {
  const errors: string[] = []
  for (const s of strategies) if (!modules.has(s.module as string)) errors.push(`стратегия: нет модуля ${String(s.module)}`)
  for (const t of texts) {
    const id = String(t.id)
    const where = `текст ${id}`
    if (ids.has(id)) errors.push(`повтор id ${id}`)
    ids.set(id, 'doc/texts.json')
    if (!modules.has(t.module as string)) errors.push(`${where}: нет модуля ${String(t.module)}`)
    if (typeof t.reviewed !== 'boolean') errors.push(`${where}: нет флага reviewed`)
    if (!t.source || !t.license) errors.push(`${where}: нет источника или лицензии`)
    const paragraphs = t.paragraphs as string[]
    const summaries = t.summaries as string[][]
    const retell = t.retell as string[]
    if (summaries.length !== paragraphs.length || retell.length !== paragraphs.length) errors.push(`${where}: краткие содержания и пересказы — по одному на абзац`)
    for (const [i, s] of summaries.entries()) if (s.length !== 3 || new Set(s).size !== 3) errors.push(`${where}: абзац ${i + 1} — нужно 3 разных кратких содержания`)
    const sentences = paragraphs.flatMap((p) => splitSentences(p)).map((x) => x.toLowerCase())
    for (const f of t.find as Json[]) {
      const n = sentences.filter((x) => x.includes(String(f.key).toLowerCase())).length
      if (n !== 1) errors.push(`${where}: ключ «${String(f.key)}» найден в ${n} предложениях, нужно ровно в одном`)
    }
    const parse = t.parse as Json
    const opts = parse.options as string[]
    if ((parse.answer as number) < 0 || (parse.answer as number) >= opts.length || new Set(opts).size !== opts.length) errors.push(`${where}: разбор — индекс ответа или варианты`)
  }
  return errors
}

const BANDS = new Set(['ngsl1', 'ngsl2', 'ngsl3', 'ngsl4', 'nawl', 'tech'])

/** Словарь: id уникальны, перевод есть, у технических терминов — транскрипция и тема. */
export function checkDictionary(words: Json[]): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const w of words) {
    const id = String(w.id)
    if (seen.has(id)) errors.push(`словарь: повтор ${id}`)
    seen.add(id)
    if (!String(w.ru ?? '').trim()) errors.push(`словарь: ${id} без перевода`)
    if (!BANDS.has(w.band as string)) errors.push(`словарь: ${id} — неизвестная полоса ${String(w.band)}`)
    if (w.band === 'tech' && (!w.ipa || !w.topic)) errors.push(`словарь: термин ${id} без транскрипции или темы`)
    if (typeof w.reviewed !== 'boolean') errors.push(`словарь: ${id} без флага reviewed`)
  }
  return errors
}

type IntakeJson = {
  bands: { id: string; source: string; from?: number; to?: number }[]
  words: { w: string; ru: string; band: string }[]
  pseudo: string[]
  listening: { id: string; text: string; options: string[] }[]
  pairs: { id: string; answer: string; options: string[] }[]
  reading: { id: string; questions: { options: string[]; answer: number }[] }[]
}

/** Слова теста — из своих полос, псевдослова — не слова, варианты ответов корректны. */
export function checkIntake(intake: IntakeJson, lists: WordLists): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const w of intake.words) {
    const key = w.w.toLowerCase()
    if (seen.has(key)) errors.push(`вводный тест: слово «${w.w}» повторяется`)
    seen.add(key)
    const band = intake.bands.find((b) => b.id === w.band)
    if (!band) {
      errors.push(`вводный тест: у слова «${w.w}» нет полосы ${w.band}`)
      continue
    }
    if (band.source === 'ngsl') {
      const rank = lists.ngslRank.get(key)
      if (rank === undefined || rank < band.from! || rank > band.to!) errors.push(`вводный тест: «${w.w}» не в полосе ${band.id} (ранг NGSL ${rank ?? 'нет'})`)
    }
    if (band.source === 'nawl' && (!lists.nawl.has(key) || lists.ngslRank.has(key))) errors.push(`вводный тест: «${w.w}» не из NAWL (или есть в NGSL)`)
    if (band.source === 'bsl' && (!lists.bsl.has(key) || lists.ngslRank.has(key) || lists.nawl.has(key)))
      errors.push(`вводный тест: «${w.w}» не из BSL (или есть в NGSL/NAWL)`)
    if (!w.ru.trim()) errors.push(`вводный тест: нет перевода у «${w.w}»`)
  }
  for (const b of intake.bands) {
    const n = intake.words.filter((w) => w.band === b.id).length
    if (n < 8) errors.push(`вводный тест: в полосе ${b.id} только ${n} слов (нужно ≥ 8)`)
  }
  for (const p of intake.pseudo) if (lists.allForms.has(p.toLowerCase())) errors.push(`вводный тест: псевдослово «${p}» — настоящее слово из списков`)
  if (intake.pseudo.length < intake.bands.length * 2) errors.push('вводный тест: псевдослов меньше, чем по 2 на полосу')
  for (const l of intake.listening) {
    if (l.options[0] !== l.text) errors.push(`вводный тест: ${l.id} — первый вариант должен совпадать с текстом`)
    if (new Set(l.options).size !== l.options.length) errors.push(`вводный тест: ${l.id} — варианты повторяются`)
  }
  for (const p of intake.pairs) if (!p.options.includes(p.answer)) errors.push(`вводный тест: ${p.id} — ответа нет среди вариантов`)
  for (const r of intake.reading)
    for (const q of r.questions) if (q.answer < 0 || q.answer >= q.options.length) errors.push(`вводный тест: ${r.id} — индекс ответа вне вариантов`)
  return errors
}
