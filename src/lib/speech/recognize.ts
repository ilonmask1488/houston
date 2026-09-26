/*
  Распознавание речи: Web Speech API (SpeechRecognition, en-US), только если браузер его умеет.
  Звук уходит на серверы разработчика браузера — это честно сказано в интерфейсе.
  Сравнение с образцом — по словам, с нормализацией: регистр, пунктуация, сокращения (I'm = I am),
  числа (2 = two), британское/американское написание.
*/

type Alternative = { transcript: string; confidence?: number }
type ResultList = ArrayLike<ArrayLike<Alternative> & { isFinal?: boolean }>
type Recognition = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((e: { results: ResultList; resultIndex?: number }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  onspeechstart: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionCtor = new () => Recognition

function ctor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export function recognitionSupported(): boolean {
  return !!ctor()
}

export type ListenEvents = {
  /** голос услышан (время от старта, мс) */
  onSpeechStart?: (ms: number) => void
  /** пришёл кусок текста (время от старта, мс) — для оценки пауз */
  onText?: (ms: number, text: string) => void
}

export type Listening = {
  result: Promise<{ alts: string[]; speechStartMs?: number; lastTextMs?: number; textTimes: number[] }>
  stop: () => void
  cancel: () => void
}

/**
  Слушать, пока не остановят (continuous). Chrome на Android сам обрывает сессию после тишины —
  тогда перезапускаем и склеиваем окончательные куски.
*/
export function listen(lang = 'en-US', events: ListenEvents = {}, continuous = true): Listening {
  const Ctor = ctor()
  if (!Ctor) throw new Error('unsupported')
  const started = Date.now()
  let finals: string[] = []
  let interim = ''
  let alts: string[] = []
  let speechStartMs: number | undefined
  const textTimes: number[] = []
  let stopped = false
  let finish: (v: Awaited<Listening['result']>) => void = () => {}
  let fail: (e: Error) => void = () => {}
  let done = false
  let current: Recognition | null = null

  const complete = () => {
    if (done) return
    done = true
    const full = [...finals, interim].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    const list = full ? [full, ...alts.filter((a) => a !== full)] : alts
    finish({ alts: list, speechStartMs, lastTextMs: textTimes.at(-1), textTimes })
  }

  const run = () => {
    const r = new Ctor()
    current = r
    r.lang = lang
    // Промежуточные результаты нужны Safari: при остановке кнопкой он часто не присылает окончательный.
    r.interimResults = true
    r.maxAlternatives = 3
    r.continuous = continuous
    r.onspeechstart = () => {
      if (speechStartMs === undefined) {
        speechStartMs = Date.now() - started
        events.onSpeechStart?.(speechStartMs)
      }
    }
    r.onresult = (e) => {
      const ms = Date.now() - started
      interim = ''
      const from = e.resultIndex ?? 0
      for (let i = from; i < e.results.length; i++) {
        const res = e.results[i]!
        const best = res[0]?.transcript?.trim() ?? ''
        if (!best) continue
        if (res.isFinal) {
          finals.push(best)
          alts = Array.from({ length: res.length }, (_, k) => res[k]!.transcript.trim()).filter(Boolean)
        } else interim = best
      }
      if (speechStartMs === undefined) {
        speechStartMs = ms
        events.onSpeechStart?.(ms)
      }
      textTimes.push(ms)
      events.onText?.(ms, [...finals, interim].join(' '))
    }
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      if (!done) {
        done = true
        fail(new Error(e.error))
      }
    }
    r.onend = () => {
      if (interim) {
        finals.push(interim)
        interim = ''
      }
      if (stopped || !continuous) complete()
      else {
        try {
          run() // сессию оборвал браузер — продолжаем слушать
        } catch {
          complete()
        }
      }
    }
    r.start()
  }

  const result = new Promise<Awaited<Listening['result']>>((resolve, reject) => {
    finish = resolve
    fail = reject
  })
  finals = []
  run()
  return {
    result,
    stop: () => {
      stopped = true
      current?.stop()
      // Бывает, что конец так и не приходит — не ждём вечно.
      setTimeout(complete, 1500)
    },
    cancel: () => {
      stopped = true
      done = true
      current?.abort()
    },
  }
}

/* ——— Сравнение по словам ——— */

const CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are', "he's": 'he is', "she's": 'she is',
  "it's": 'it is', "that's": 'that is', "there's": 'there is', "what's": 'what is', "let's": 'let us',
  "i've": 'i have', "you've": 'you have', "we've": 'we have', "they've": 'they have',
  "i'll": 'i will', "you'll": 'you will', "we'll": 'we will', "they'll": 'they will', "it'll": 'it will',
  "i'd": 'i would', "you'd": 'you would', "we'd": 'we would', "they'd": 'they would',
  "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "can't": 'can not', 'cannot': 'can not',
  "won't": 'will not', "isn't": 'is not', "aren't": 'are not', "wasn't": 'was not', "weren't": 'were not',
  "haven't": 'have not', "hasn't": 'has not', "hadn't": 'had not', "shouldn't": 'should not',
  "wouldn't": 'would not', "couldn't": 'could not', "should've": 'should have', "would've": 'would have',
  "could've": 'could have', "must've": 'must have', gonna: 'going to', wanna: 'want to', gotta: 'got to',
}
const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
/** Британское написание → американское, чтобы colour = color. */
const SPELLING: [RegExp, string][] = [
  [/our$/, 'or'],
  [/tre$/, 'ter'],
  [/ise$/, 'ize'],
  [/ised$/, 'ized'],
  [/ising$/, 'izing'],
  [/isation$/, 'ization'],
  [/ogue$/, 'og'],
]
const SPELLING_KEEP = new Set(['our', 'four', 'your', 'hour', 'tour', 'pour', 'flour', 'sour', 'rise', 'wise', 'otherwise', 'exercise', 'advise', 'surprise', 'promise', 'noise', 'raise', 'precise', 'concise', 'expertise', 'enterprise', 'premise', 'compromise', 'arise', 'devise', 'revise', 'supervise', 'televise', 'improvise', 'franchise', 'merchandise', 'cruise', 'praise', 'paradise', 'poise', 'dialogue', 'catalogue', 'theatre', 'centre', 'metre', 'litre', 'fibre'])

function spell(w: string): string {
  if (w === 'centre') return 'center'
  if (w === 'metre') return 'meter'
  if (w === 'litre') return 'liter'
  if (w === 'fibre') return 'fiber'
  if (w === 'theatre') return 'theater'
  if (w === 'catalogue') return 'catalog'
  if (w === 'dialogue') return 'dialog'
  if (SPELLING_KEEP.has(w) || w.length < 5) return w
  for (const [re, to] of SPELLING) if (re.test(w)) return w.replace(re, to)
  return w
}

/** Слова для сравнения: нижний регистр, без пунктуации, сокращения раскрыты. */
export function normalizeWords(text: string): string[] {
  const out: string[] = []
  const tokens = text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  for (const raw of tokens) {
    const t = raw.replace(/^'+|'+$/g, '')
    if (!t) continue
    const exp = CONTRACTIONS[t]
    if (exp) out.push(...exp.split(' '))
    else if (/^\d+$/.test(t) && Number(t) < NUMBERS.length) out.push(NUMBERS[Number(t)]!)
    else out.push(spell(t.replace(/'s$/, '')))
  }
  return out
}

export type WordMatch = { word: string; ok: boolean }

/** Какие слова образца нашлись в распознанном (по наибольшей общей подпоследовательности). */
export function compareWords(target: string, heard: string): { words: WordMatch[]; ok: number; total: number } {
  const shown = target.split(/\s+/).filter(Boolean)
  const a = shown.map((w) => normalizeWords(w).join(' ')).filter(Boolean)
  const shownFiltered = shown.filter((w) => normalizeWords(w).length)
  const b = normalizeWords(heard)
  // Цель — последовательность «единиц» (слово образца может раскрыться в два: I'm → i am).
  const units = a.map((u) => u.split(' '))
  const flat = units.flat()
  const dp = Array.from({ length: flat.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = flat.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) dp[i]![j] = flat[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
  const hit: boolean[] = new Array(flat.length).fill(false)
  let i = 0
  let j = 0
  while (i < flat.length && j < b.length) {
    if (flat[i] === b[j]) {
      hit[i] = true
      i++
      j++
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i++
    else j++
  }
  let k = 0
  const words = units.map((u, idx) => {
    const ok = u.every((_, n) => hit[k + n])
    k += u.length
    return { word: shownFiltered[idx]!, ok }
  })
  return { words, ok: words.filter((w) => w.ok).length, total: words.length }
}

/** Лучший из вариантов распознавания — с наибольшим совпадением. */
export function bestAlternative(target: string, alts: string[]): { heard: string; match: ReturnType<typeof compareWords> } | null {
  let best: { heard: string; match: ReturnType<typeof compareWords> } | null = null
  for (const heard of alts) {
    const match = compareWords(target, heard)
    if (!best || match.ok > best.match.ok) best = { heard, match }
  }
  return best
}

export function countWords(text: string): number {
  return normalizeWords(text).length
}
