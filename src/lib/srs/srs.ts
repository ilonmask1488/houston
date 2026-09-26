/*
  Интервальное повторение FSRS (ts-fsrs). В базе — только числа (мс), здесь — перевод в Date и обратно.
  Типы карточек (ТЗ §9.2), открываются постепенно:
    1 — аудио → значение (первой, когда слово встретилось в уроке);
    2 — иероглифы + пиньинь → значение (после первого успешного повторения типа 1);
    4 — тоны: слово → тоновый рисунок (тогда же, что и тип 2);
    3 — значение → скажи вслух (после первого успешного повторения типа 2);
    5 — иероглифы без пиньиня → значение (фаза 4).
*/
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from 'ts-fsrs'
import type { CardRow } from '../db/types'

export type CardKind = 1 | 2 | 3 | 4 | 5
export type Grade14 = 1 | 2 | 3 | 4

export function cardId(itemId: string, kind: CardKind): string {
  return `${itemId}:${kind}`
}

const schedulers = new Map<number, ReturnType<typeof fsrs>>()
export function scheduler(retention = 0.9) {
  let f = schedulers.get(retention)
  if (!f) {
    f = fsrs(generatorParameters({ request_retention: retention, enable_fuzz: true, maximum_interval: 365 }))
    schedulers.set(retention, f)
  }
  return f
}

function toCard(r: CardRow): Card {
  return {
    due: new Date(r.due),
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsedDays,
    scheduled_days: r.scheduledDays,
    learning_steps: r.learningSteps ?? 0,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state,
    last_review: r.lastReview !== undefined ? new Date(r.lastReview) : undefined,
  }
}

function toRow(base: Pick<CardRow, 'id' | 'itemId' | 'kind' | 'createdAt'>, c: Card): CardRow {
  return {
    ...base,
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    learningSteps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as CardRow['state'],
    lastReview: c.last_review?.getTime(),
  }
}

export function newCard(itemId: string, kind: CardKind, now = Date.now()): CardRow {
  return toRow({ id: cardId(itemId, kind), itemId, kind, createdAt: now }, createEmptyCard(new Date(now)))
}

/** Ответ на карточку: новая запись карточки. */
export function review(row: CardRow, grade: Grade14, now = Date.now(), retention = 0.9): CardRow {
  const { card } = scheduler(retention).next(toCard(row), new Date(now), grade as Grade)
  return toRow(row, card)
}

/** Через сколько карточка вернётся при каждой из четырёх оценок (для подписей кнопок). */
export function previewIntervals(row: CardRow, now = Date.now(), retention = 0.9): Record<Grade14, number> {
  const p = scheduler(retention).repeat(toCard(row), new Date(now))
  return {
    1: p[Rating.Again].card.due.getTime() - now,
    2: p[Rating.Hard].card.due.getTime() - now,
    3: p[Rating.Good].card.due.getTime() - now,
    4: p[Rating.Easy].card.due.getTime() - now,
  }
}

/** «10 мин», «1 д», «3 нед», «2 мес» */
export function formatInterval(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000))
  if (min < 60) return `${min} мин`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} ч`
  const d = Math.round(h / 24)
  if (d < 14) return `${d} д`
  if (d < 60) return `${Math.round(d / 7)} нед`
  return `${Math.round(d / 30)} мес`
}

/** Какие карточки открываются после ответа (постепенное открытие типов). */
export function unlocksAfter(row: CardRow, grade: Grade14, hanziOnly = false): CardKind[] {
  if (grade < 3) return []
  if (row.kind === 1) return [2, 4]
  // Тип 5 «иероглифы без пиньиня» — со второй ступени или по настройке.
  if (row.kind === 2) return hanziOnly ? [3, 5] : [3]
  return []
}
