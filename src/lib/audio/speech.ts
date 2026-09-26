/*
  Синтез речи браузера (speechSynthesis). Нужен в двух случаях:
  1) запасной вариант, если файла нет;
  2) озвучка твоих собственных текстов («Мой рассказ», «Мой текст») — их нельзя сгенерировать заранее.
  Английские голоса есть почти везде (Android, iOS, Windows), но набор разный — выбираем по языку.
*/

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function englishVoices(): SpeechSynthesisVoice[] {
  return speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang))
}

/** Голоса грузятся асинхронно — ждём до 1 с. */
export async function hasEnglishVoice(): Promise<boolean> {
  if (!speechSupported()) return false
  if (englishVoices().length) return true
  await new Promise<void>((r) => {
    const t = setTimeout(r, 1000)
    speechSynthesis.addEventListener('voiceschanged', () => (clearTimeout(t), r()), { once: true })
  })
  return englishVoices().length > 0
}

/** Лучший голос: сначала нужный вариант (en-US / en-GB…), среди них — «естественные» (Natural, Google, Siri). */
export function pickVoice(lang: string, gender?: 'female' | 'male'): SpeechSynthesisVoice | undefined {
  const all = englishVoices()
  const same = all.filter((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase())
  const pool = same.length ? same : all
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|neural|premium|enhanced|google|siri/i.test(v.name) ? 2 : 0) +
    (gender && new RegExp(gender === 'female' ? 'female|woman|samantha|zira|aria|jenny|ava|emma|sonia|libby' : '\\bmale|man|daniel|david|guy|andrew|brian|ryan', 'i').test(v.name) ? 1 : 0) +
    (v.localService ? 0.5 : 0)
  return [...pool].sort((a, b) => score(b) - score(a))[0]
}

export function speakEnglish(text: string, opts: { rate?: number; lang?: string; gender?: 'female' | 'male'; onBoundary?: (charIndex: number) => void } = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!speechSupported()) return reject(new Error('no speechSynthesis'))
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = opts.lang ?? 'en-US'
    u.rate = opts.rate ?? 1
    const v = pickVoice(u.lang, opts.gender)
    if (v) u.voice = v
    u.onend = () => resolve()
    u.onerror = (e) => (e.error === 'canceled' || e.error === 'interrupted' ? resolve() : reject(new Error(e.error)))
    if (opts.onBoundary) u.onboundary = (e) => opts.onBoundary!(e.charIndex)
    speechSynthesis.speak(u)
  })
}

export function stopSpeaking(): void {
  if (speechSupported()) speechSynthesis.cancel()
}
