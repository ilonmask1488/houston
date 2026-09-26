/*
  Твой текст для тренировки: предложения (для шэдоуинга), ключевые слова (ответ по опорным словам),
  время звучания. Всё локально, без внешних сервисов.
*/

/** Разбить на предложения (с учётом сокращений вроде e.g., i.e., Mr.). */
export function splitSentences(text: string): string[] {
  const protectedText = text
    .replace(/\s+/g, ' ')
    .replace(/\b(e\.g|i\.e|etc|Mr|Mrs|Ms|Dr|vs|approx|No)\./gi, (m) => m.replace(/\./g, '\u0000'))
  return protectedText
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.replace(/\u0000/g, '.').trim())
    .filter((s) => /[a-zA-Z]/.test(s))
}

const STOP = new Set(
  (
    'a an the and or but so if then than that this these those there here it its i me my mine we us our you your he him his she her they them their ' +
    'is am are was were be been being have has had do does did will would can could should may might must shall ' +
    'to of in on at by for with from about as into over after before during between through up down out off ' +
    'not no very really quite just also too more most much many some any all each every both such own same other ' +
    'what which who whom whose when where why how one two first second yes okay well like get got make made thing things ' +
    "i'm i've i'd i'll it's that's there's we're we've they're don't didn't doesn't can't won't"
  ).split(' '),
)

function words(s: string): string[] {
  return s
    .replace(/[’]/g, "'")
    .split(/[^A-Za-z0-9'-]+/)
    .filter(Boolean)
}

/**
  Ключевые слова предложения: 1–3 самых «содержательных» (длинные, не служебные, числа).
  Порядок — как в предложении, чтобы по ним было легко восстановить мысль.
*/
export function keywords(sentence: string, max = 3): string[] {
  const ws = words(sentence)
  const scored = ws
    .map((w, i) => ({ w, i, score: STOP.has(w.toLowerCase()) ? -1 : /\d/.test(w) ? 10 : w.length + (/^[A-Z]/.test(w) && i > 0 ? 3 : 0) }))
    .filter((x) => x.score > 3)
  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, max)
  return top.sort((a, b) => a.i - b.i).map((x) => x.w)
}

/** Опорные слова всего ответа: по предложению — строка из 1–3 слов. */
export function keyLines(text: string): string[][] {
  return splitSentences(text).map((s) => keywords(s))
}

/** Сколько секунд звучит ответ: ~130 слов в минуту — спокойный темп собеседования. */
export function speakingSeconds(text: string, wpm = 130): number {
  return Math.round((words(text).length / wpm) * 60)
}

export function wordCount(text: string): number {
  return words(text).length
}

/** Есть ли в тексте кириллица — значит, кусок ещё не переведён. */
export function hasCyrillic(text: string): boolean {
  return /[а-яё]/i.test(text)
}
