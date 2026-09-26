/*
  Высокоуровневый API звука для экранов: «сыграй фразу этим голосом на этой скорости», серии, предзагрузка.
  Скорость — playbackRate с сохранением высоты (preservesPitch): лестница 0.75 → 1.0 → 1.25
  звучит тем же голосом, только быстрее или медленнее.
*/
import type { VoiceId } from '../../content/types'
import { ru } from '../../i18n/ru'
import type { Settings } from '../db/types'
import { loadSettings } from '../settings/settings'
import { entriesFor, entryFor, urlOf } from './manifest'
import { AudioError, player } from './player'
import { hasEnglishVoice, speakEnglish, stopSpeaking } from './speech'

export { player } from './player'

let prefs: Pick<Settings, 'variant' | 'voice'> = { variant: 'us', voice: 'female' }
export function configureAudio(p: Pick<Settings, 'variant' | 'voice'>): void {
  prefs = { variant: p.variant, voice: p.voice }
}
void loadSettings()
  .then((s) => configureAudio(s))
  .catch(() => {})

/** Голос по умолчанию: вариант языка из настроек + пол голоса. */
export function defaultVoice(): VoiceId {
  return `${prefs.variant}-${prefs.voice === 'female' ? 'f' : 'm'}` as VoiceId
}

/** Длительность звука в мс (для паузы «твоя очередь»); без файла — оценка по длине текста. */
export function durationOf(text: string, voice?: VoiceId): number {
  return entryFor(text, voice ?? defaultVoice())?.ms ?? Math.max(800, text.split(/\s+/).length * 330)
}

export type PlayOptions = { voice?: VoiceId; rate?: number }

/** Сыграть фразу. Нет файла — синтез браузера (с понятной ошибкой, если и его нет). */
export async function playText(text: string, opts: PlayOptions = {}): Promise<void> {
  const voice = opts.voice ?? defaultVoice()
  const rate = opts.rate ?? 1
  const entry = entryFor(text, voice)
  if (entry) return player.play(urlOf(entry), rate, Math.round(entry.ms / rate) + 2500)
  if (await hasEnglishVoice()) {
    return speakEnglish(text, { rate, lang: voice.startsWith('gb') ? 'en-GB' : voice.startsWith('in') ? 'en-IN' : voice.startsWith('au') ? 'en-AU' : 'en-US', gender: voice.endsWith('f') ? 'female' : 'male' })
  }
  player.emitError(ru.audio.noVoice)
  throw new AudioError(ru.audio.noVoice)
}

let seriesToken = 0

/** Серия с паузой между звуками; прерывается следующей командой. */
export async function playSeries(items: { text: string; voice?: VoiceId; rate?: number }[], gapMs = 400, onStep?: (i: number) => void): Promise<void> {
  const token = ++seriesToken
  for (let i = 0; i < items.length; i++) {
    if (token !== seriesToken) return
    onStep?.(i)
    await playText(items[i]!.text, items[i]!)
    if (i < items.length - 1) await wait(gapMs)
  }
  onStep?.(-1)
}

export function stopAudio(): void {
  seriesToken++
  player.stop()
  stopSpeaking()
}

/** Предзагрузить звуки следующих экранов. */
export function preloadTexts(texts: { text: string; voice?: VoiceId }[]): void {
  player.preload(
    texts.flatMap(({ text, voice }) => {
      const e = voice ? entryFor(text, voice) : undefined
      return e ? [urlOf(e)] : entriesFor(text).map(urlOf)
    }),
  )
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
