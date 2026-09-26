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

/**
  Чтение (Техдок): скорость по шагам «прочитай» (слова / секунды, медиана последних 10 —
  чтобы одно отвлечение не портило цифру), доля и среднее время найденных ответов.
*/
export function readingStats(answers: AnswerRow[]): { wpm: number | null; texts: number; found: number; findTotal: number; findMs: number | null } {
  const reads = answers
    .filter((a) => a.kind === 'read' && Number(a.given) >= 20)
    .map((a) => (Number(a.expected) / Number(a.given)) * 60)
    .filter((x) => Number.isFinite(x) && x > 0)
  const last = reads.slice(-10).sort((a, b) => a - b)
  const wpm = last.length ? Math.round(last[Math.floor(last.length / 2)]!) : null
  const finds = answers.filter((a) => a.kind === 'find')
  const ok = finds.filter((a) => a.correct && a.latencyMs !== undefined)
  const findMs = ok.length ? Math.round(ok.reduce((s, a) => s + a.latencyMs!, 0) / ok.length) : null
  return { wpm, texts: reads.length, found: finds.filter((a) => a.correct).length, findTotal: finds.length, findMs }
}

/** Минимальные пары на слух по модулям Чистого сигнала (th, w/v, …): доля верных, от 3 ответов, хуже — выше. */
export function pairsByModule(answers: AnswerRow[]): { tag: string; correct: number; total: number }[] {
  const by = new Map<string, { correct: number; total: number }>()
  for (const a of answers) {
    if (a.kind !== 'pair' || !a.tag) continue
    const x = by.get(a.tag) ?? { correct: 0, total: 0 }
    x.total++
    if (a.correct) x.correct++
    by.set(a.tag, x)
  }
  return [...by]
    .filter(([, x]) => x.total >= 3)
    .map(([tag, x]) => ({ tag, ...x }))
    .sort((a, b) => a.correct / a.total - b.correct / b.total)
}

/** Слова в карточках по полосам частотности словаря; свои слова — отдельно. */
export function wordsByBand(itemIds: string[], bandOf: (id: string) => string | undefined): { band: string; n: number }[] {
  const by = new Map<string, number>()
  for (const id of new Set(itemIds)) {
    const band = id.startsWith('u-') ? 'own' : bandOf(id)
    if (band) by.set(band, (by.get(band) ?? 0) + 1)
  }
  const order = ['ngsl1', 'ngsl2', 'ngsl3', 'ngsl4', 'nawl', 'tech', 'own']
  return order.filter((b) => by.has(b)).map((band) => ({ band, n: by.get(band)! }))
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
