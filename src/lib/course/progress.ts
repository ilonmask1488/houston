/*
  Прогресс по модулям треков. Модуль пройден, когда каждое его упражнение сделано хотя бы раз
  (фраза понята, отрывок понят на 2 из 3, чанк изучен, ответ сказан вслух).
  «Настоящая скорость» (air-fast) — свои упражнения: все фразы Эфира, понятые на 1.25.
*/
import { content, itemsByModule, modulesByTrack } from '../../content'
import type { Module, TrackId } from '../../content/types'
import { db, type AppDB } from '../db/db'
import type { ModuleProgressRow } from '../db/types'
import { startModule } from '../intake/score'
import type { IntakeRecord } from '../intake/store'

/** id упражнений модуля (то, что нужно сделать, чтобы его закрыть). */
export function moduleItems(moduleId: string): string[] {
  if (moduleId === 'air-fast') return content.phrases.filter((p) => p.module !== 'air-accents').map((p) => p.id)
  const m = itemsByModule.get(moduleId)
  if (!m) return []
  return [
    ...m.phrases,
    ...m.passages,
    ...m.chunks,
    ...m.questions,
    ...m.translate,
    ...m.substitution,
    ...m.texts,
    ...m.mailRegister,
    ...m.mailFix,
    ...m.mailOrder,
    ...m.mailWrite,
    ...m.pairs,
    ...m.cleanPhrases,
    ...m.stress,
  ].map((x) => x.id)
}

/** Модуль с контентом. */
export function hasContent(moduleId: string): boolean {
  return moduleItems(moduleId).length > 0
}

export async function markDone(moduleId: string, itemId: string, database: AppDB = db, now = Date.now()): Promise<{ completedNow: boolean }> {
  let completedNow = false
  await database.transaction('rw', database.moduleProgress, async () => {
    const row: ModuleProgressRow = (await database.moduleProgress.get(moduleId)) ?? { moduleId, startedAt: now, done: [] }
    if (!row.done.includes(itemId)) row.done.push(itemId)
    if (!row.completedAt) {
      const all = moduleItems(moduleId)
      if (all.length && all.every((id) => row.done.includes(id))) {
        row.completedAt = now
        completedNow = true
      }
    }
    await database.moduleProgress.put(row)
  })
  return { completedNow }
}

export async function startModuleRow(moduleId: string, database: AppDB = db, now = Date.now()): Promise<void> {
  if (!(await database.moduleProgress.get(moduleId))) await database.moduleProgress.put({ moduleId, startedAt: now, done: [] })
}

export type Progress = Map<string, ModuleProgressRow>

export async function loadProgress(database: AppDB = db): Promise<Progress> {
  return new Map((await database.moduleProgress.toArray()).map((r) => [r.moduleId, r]))
}

/** Стартовый модуль трека по вводному тесту (без теста — первый). */
export function startOf(track: TrackId, intake?: Pick<IntakeRecord, 'tracks' | 'result'>): Module | undefined {
  const modules = (modulesByTrack.get(track) ?? []).filter((m) => hasContent(m.id))
  if (!modules.length) return undefined
  if (!intake) return modules[0]
  return startModule(modules, intake.tracks[track], intake.result.weakTags) ?? modules[0]
}

/**
  Текущий модуль трека: первый незакрытый, начиная со стартового; если от старта до конца всё закрыто —
  первый незакрытый вообще; если закрыто всё — последний (повторение).
*/
export function currentModule(track: TrackId, progress: Progress, intake?: Pick<IntakeRecord, 'tracks' | 'result'>): Module | undefined {
  const modules = (modulesByTrack.get(track) ?? []).filter((m) => hasContent(m.id))
  if (!modules.length) return undefined
  const start = startOf(track, intake) ?? modules[0]!
  const open = (m: Module) => !progress.get(m.id)?.completedAt
  return modules.find((m) => m.order >= start.order && open(m)) ?? modules.find(open) ?? modules[modules.length - 1]
}

export function doneSet(progress: Progress, moduleId: string): Set<string> {
  return new Set(progress.get(moduleId)?.done ?? [])
}

/** Доля пройденного в модуле, 0..1. */
export function moduleShare(progress: Progress, moduleId: string): number {
  const all = moduleItems(moduleId)
  if (!all.length) return 0
  const done = doneSet(progress, moduleId)
  return all.filter((id) => done.has(id)).length / all.length
}
