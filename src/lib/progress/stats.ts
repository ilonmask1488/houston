/*
  Статистика (ТЗ §11): минуты по дням, минуты речи вслух, скорость, на которой понимаешь аудирование,
  время до начала ответа, прогресс по трекам.
*/
import type { AnswerRow, DayRow } from '../db/types'
import { addDays } from './streak'

export type DayBar = { date: string; minutes: number; spokenMinutes: number }

/** Последние n дней (включая сегодня), пропуски — нули. */
export function minutesByDay(days: DayRow[], today: string, n = 14): DayBar[] {
  const by = new Map(days.map((d) => [d.date, d]))
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1)
    const d = by.get(date)
    return { date, minutes: Math.round((d?.seconds ?? 0) / 60), spokenMinutes: Math.round(((d?.spokenSeconds ?? 0) / 60) * 10) / 10 }
  })
}

export const SPEED_BUCKETS = [0.75, 1, 1.25] as const
export type SpeedStat = { speed: number; correct: number; total: number }

function bucket(speed: number): number {
  return speed < 0.9 ? 0.75 : speed < 1.15 ? 1 : 1.25
}

/**
  Понимание на слух по скоростям. «Комфортная» скорость — самая высокая, где не меньше 5 ответов
  и не меньше 70% верных. Вводный тест не считается — только тренировки.
*/
export function listeningBySpeed(answers: AnswerRow[]): { buckets: SpeedStat[]; comfort: number | null } {
  const listen = answers.filter((a) => a.speed !== undefined && a.track === 'air' && a.source !== 'intake' && a.kind !== 'passage')
  const buckets = SPEED_BUCKETS.map((sp) => {
    const at = listen.filter((a) => bucket(a.speed!) === sp)
    return { speed: sp, correct: at.filter((a) => a.correct).length, total: at.length }
  })
  let comfort: number | null = null
  for (const b of buckets) if (b.total >= 5 && b.correct / b.total >= 0.7) comfort = b.speed
  return { buckets, comfort }
}

/** Среднее время до начала ответа (быстрый ответ, перевод на лету) за период. */
export function avgLatency(answers: AnswerRow[]): number | null {
  const xs = answers.filter((a) => a.latencyMs !== undefined && a.track === 'call').map((a) => a.latencyMs!)
  return xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null
}

/** Явления связной речи, где чаще всего теряешься (доля ошибок, от 4 ответов). */
export function weakTags(answers: AnswerRow[]): { tag: string; errorRate: number; total: number }[] {
  const by = new Map<string, { wrong: number; total: number }>()
  for (const a of answers) {
    if (!a.tag || a.track !== 'air' || a.source === 'intake') continue
    const x = by.get(a.tag) ?? { wrong: 0, total: 0 }
    x.total++
    if (!a.correct) x.wrong++
    by.set(a.tag, x)
  }
  return [...by]
    .filter(([, x]) => x.total >= 4 && x.wrong > 0)
    .map(([tag, x]) => ({ tag, errorRate: x.wrong / x.total, total: x.total }))
    .sort((a, b) => b.errorRate - a.errorRate)
}
