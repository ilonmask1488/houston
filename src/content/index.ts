/*
  Учебный контент и индексы по нему. JSON лежит в отдельном куске бандла (data.ts) и грузится один раз
  до первого рендера — loadContent() в main.tsx (в тестах — test-setup.ts).
  Индексы заполняются на месте: импортировать их можно как обычные константы, пусты они только до загрузки.
*/
import type { Content, IntakeContent, Module, TrackId } from './types'

export const content: Content = {
  modules: [],
  intake: { bands: [], words: [], pseudo: [], listening: [], pairs: [], reading: [], speaking: [], soundCheck: [], micPhrase: '' },
}

export const moduleById = new Map<string, Module>()
export const modulesByTrack = new Map<TrackId, Module[]>()

let loading: Promise<void> | null = null

export function loadContent(): Promise<void> {
  loading ??= import('./data').then(({ raw }) => fill(raw))
  return loading
}

export function fill(raw: Content): void {
  Object.assign(content, raw)
  moduleById.clear()
  modulesByTrack.clear()
  for (const m of [...raw.modules].sort((a, b) => a.order - b.order)) {
    moduleById.set(m.id, m)
    modulesByTrack.set(m.track, [...(modulesByTrack.get(m.track) ?? []), m])
  }
}

export function intake(): IntakeContent {
  return content.intake
}
