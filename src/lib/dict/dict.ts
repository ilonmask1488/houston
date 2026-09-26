/*
  Встроенный словарь (src/content/dict/words.json): ~3700 частых и академических слов NGSL/NAWL
  с короткими переводами и ~350 технических терминов с МФА и звуком. Отдельный кусок бандла:
  грузится при первом обращении (словарь, тап по слову, повторение слов).
  Поиск понимает формы: tested → test, specimens → specimen, studies → study.
*/
import type { DictWord } from '../../content/types'

export const dictById = new Map<string, DictWord>()
const byForm = new Map<string, DictWord>()
/** многословные термины: первое слово → термины, начинающиеся с него */
const phrases = new Map<string, DictWord[]>()
let loading: Promise<void> | null = null
export let dictWords: DictWord[] = []

export function norm(w: string): string {
  return w
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
    .replace(/'s$/, '')
}

export function fillDictionary(words: DictWord[]): void {
  dictWords = words
  dictById.clear()
  byForm.clear()
  phrases.clear()
  for (const w of words) {
    dictById.set(w.id, w)
    const key = norm(w.text)
    if (key.includes(' ')) {
      const first = key.split(' ')[0]!
      phrases.set(first, [...(phrases.get(first) ?? []), w])
    }
    // технические термины первыми: у совпадающих форм приоритет техническому значению
    if (!byForm.has(key) || w.band === 'tech') byForm.set(key, w)
    for (const f of w.forms ?? []) if (!byForm.has(f)) byForm.set(f, w)
  }
}

export function loadDictionary(): Promise<void> {
  loading ??= import('../../content/dict/words.json').then((m) => fillDictionary(m.default as DictWord[]))
  return loading
}

export function dictionaryLoaded(): boolean {
  return dictById.size > 0
}

/** Кандидаты леммы по простым правилам английской морфологии. */
export function lemmaCandidates(w: string): string[] {
  const out = [w]
  const add = (x: string) => x.length > 1 && !out.includes(x) && out.push(x)
  if (w.endsWith('ies')) add(`${w.slice(0, -3)}y`)
  if (w.endsWith('ied')) add(`${w.slice(0, -3)}y`)
  if (w.endsWith('es')) add(w.slice(0, -2))
  if (w.endsWith('s') && !w.endsWith('ss')) add(w.slice(0, -1))
  if (w.endsWith('ed')) {
    add(w.slice(0, -2))
    add(w.slice(0, -1))
    if (/(.)\1ed$/.test(w)) add(w.slice(0, -3))
  }
  if (w.endsWith('ing')) {
    add(w.slice(0, -3))
    add(`${w.slice(0, -3)}e`)
    if (/(.)\1ing$/.test(w)) add(w.slice(0, -4))
  }
  if (w.endsWith('er')) add(w.slice(0, -2))
  if (w.endsWith('est')) add(w.slice(0, -3))
  if (w.endsWith('ly')) add(w.slice(0, -2))
  return out
}

export function lookup(word: string): DictWord | undefined {
  const w = norm(word)
  if (!w) return undefined
  for (const c of lemmaCandidates(w)) {
    const hit = byForm.get(c)
    if (hit) return hit
  }
  return undefined
}

/**
  Слово в контексте: если тапнутое слово — часть технического термина из нескольких слов
  («strain gauge», «finite element analysis»), вернуть термин целиком.
*/
export function lookupInContext(words: string[], index: number): { entry?: DictWord; from: number; to: number } {
  const n = words.map((w) => norm(w))
  for (let start = Math.max(0, index - 3); start <= index; start++) {
    for (const term of phrases.get(n[start] ?? '') ?? []) {
      const parts = norm(term.text).split(' ')
      const end = start + parts.length - 1
      if (end < index || end >= n.length) continue
      const ok = parts.every((p, k) => {
        const got = n[start + k] ?? ''
        return got === p || lemmaCandidates(got).includes(p)
      })
      if (ok) return { entry: term, from: start, to: end }
    }
  }
  return { entry: lookup(words[index] ?? ''), from: index, to: index }
}

export const BAND_LABEL: Record<string, string> = {
  ngsl1: 'топ-500',
  ngsl2: '501–1000',
  ngsl3: '1001–2000',
  ngsl4: '2001–2800',
  nawl: 'академическое',
  tech: 'технический термин',
}
