/*
  Вводный тест в базе: черновик (можно прерваться и продолжить) и итоги.
*/
import { useLiveQuery } from 'dexie-react-hooks'
import { content } from '../../content'
import { db } from '../db/db'
import type { IntakeRow } from '../db/types'
import { evaluateAchievements, type AchievementId } from '../progress/achievements'
import { addToday } from '../progress/record'
import { SIGNAL } from '../progress/signal'
import { computeResult, type IntakeDraft, type IntakeResult } from './score'

export type IntakeRecord = IntakeRow & { result: IntakeResult }

export async function loadDraft(): Promise<IntakeDraft | null> {
  const raw = await db.getMeta<string>('intakeDraft')
  if (!raw) return null
  try {
    const d = JSON.parse(raw) as IntakeDraft
    return d.version === 1 ? d : null
  } catch {
    return null
  }
}

export async function saveDraft(d: IntakeDraft): Promise<void> {
  await db.setMeta('intakeDraft', JSON.stringify(d))
}

export async function dropDraft(): Promise<void> {
  await db.deleteMeta('intakeDraft')
}

export async function lastIntake(): Promise<IntakeRecord | undefined> {
  return (await db.intake.orderBy('at').last()) as IntakeRecord | undefined
}

/** Итоги теста: сохранить, записать ответы в общую статистику, начислить сигнал и время. */
export async function finishIntake(d: IntakeDraft, now = Date.now()): Promise<{ record: IntakeRecord; achievements: AchievementId[] }> {
  const result = computeResult(d, content.intake.bands)
  const record: IntakeRecord = { at: now, cefr: result.cefr, tracks: result.tracks, result }
  const seconds = Math.min(40 * 60, Math.max(0, (now - d.startedAt) / 1000))
  const spokenMs = d.speaking.reduce((s, a) => s + (a.speechMs ?? 0), 0)
  await db.transaction('rw', [db.intake, db.answers, db.meta], async () => {
    record.id = await db.intake.add(record)
    await db.answers.bulkAdd([
      ...d.listening.map((a) => ({ at: now, kind: 'listen', source: 'intake' as const, track: 'air' as const, item: a.id, expected: 'right', given: a.correct ? 'right' : 'wrong', correct: a.correct, speed: a.speed, accent: a.accent, tag: a.tag })),
      ...d.pairs.map((a) => ({ at: now, kind: 'pair', source: 'intake' as const, track: 'clean' as const, item: a.id, expected: 'right', given: a.correct ? 'right' : 'wrong', correct: a.correct, tag: a.tag })),
      ...d.speaking.map((a) => ({ at: now, kind: 'speak', source: 'intake' as const, track: 'call' as const, item: a.id, expected: '', given: a.transcript ?? '', correct: a.self >= 3, latencyMs: a.latencyMs, speechMs: a.speechMs })),
    ])
    await db.meta.delete('intakeDraft')
  })
  await addToday({ seconds, signal: SIGNAL.intake, spokenMs, spoken: d.speaking.length })
  const achievements = await evaluateAchievements()
  return { record, achievements }
}

/** Живые данные для экранов: последний итог и незаконченный черновик. */
export function useIntakeState(): { last: IntakeRecord | undefined; hasDraft: boolean; loaded: boolean } {
  const v = useLiveQuery(async () => ({ last: await lastIntake(), hasDraft: !!(await db.getMeta('intakeDraft')) }), [])
  return { last: v?.last, hasDraft: v?.hasDraft ?? false, loaded: v !== undefined }
}
