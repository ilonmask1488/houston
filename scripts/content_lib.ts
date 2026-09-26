/*
  Общее для проверки контента: чтение JSON, частотные списки (NGSL/NAWL/BSL), какой звук нужен.
  Правила «какой звук нужен» — те же, что в scripts/audio_lib.py (collect_needs).
*/
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

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
