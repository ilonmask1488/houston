/*
  Манифест звуков (генерирует scripts/generate_audio.py): текст → записи разными голосами.
  Файлы лежат в public/audio, имена с хэшем содержимого — кэш офлайна не устаревает.
  Сам манифест не вшит в бандл: грузится один раз при запуске (loadManifest в main.tsx)
  и лежит в предзагрузке service worker — офлайн он есть всегда.
*/
import type { VoiceId } from '../../content/types'

export type AudioEntry = { voice: VoiceId; file: string; source: string; ms: number }
export type AudioSource = { name: string; url: string; license: string; credit: string }

type Manifest = {
  version: number
  sources: Record<string, AudioSource>
  texts: Record<string, AudioEntry[]>
}

const BASE = `${import.meta.env.BASE_URL}audio/`

export let manifest: Manifest = { version: 0, sources: {}, texts: {} }

/** Загрузить манифест до первого рендера. Не вышло — звук упадёт на синтез браузера, как при отсутствии файла. */
export async function loadManifest(): Promise<void> {
  try {
    const r = await fetch(`${BASE}manifest.json`)
    if (r.ok) manifest = (await r.json()) as Manifest
  } catch (e) {
    console.error(e)
  }
}

/** Для тестов: подменить манифест. */
export function setManifest(m: Manifest): void {
  manifest = m
}

export function urlOf(entry: AudioEntry): string {
  return BASE + entry.file
}

export function entriesFor(text: string): AudioEntry[] {
  return manifest.texts[text] ?? []
}

/** Запись нужным голосом; если такого голоса нет — любым, что есть. */
export function entryFor(text: string, voice: VoiceId): AudioEntry | undefined {
  const all = entriesFor(text)
  return all.find((e) => e.voice === voice) ?? all.find((e) => e.voice.slice(0, 2) === voice.slice(0, 2)) ?? all[0]
}

export function hasAudio(text: string): boolean {
  return entriesFor(text).length > 0
}
