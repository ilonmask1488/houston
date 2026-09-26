/*
  Шаги упражнений — маленькие JSON-объекты: хранятся в плане сеанса в базе, поэтому
  сеанс можно прервать и продолжить с того же места.
*/
import type { VoiceId } from '../../content/types'

export type Step =
  | { kind: 'intro'; module: string }
  | { kind: 'listen'; phrase: string; speed: number; voice?: VoiceId }
  | { kind: 'dictation'; phrase: string; speed: number }
  | { kind: 'ladder'; phrase: string }
  | { kind: 'accents'; phrase: string }
  | { kind: 'passage'; passage: string }
  | { kind: 'chunk'; chunk: string }
  | { kind: 'quick'; question: string }
  | { kind: 'translate'; item: string }
  | { kind: 'substitute'; item: string; swap: number }
  | { kind: 'card'; card: string }

export type StepKind = Step['kind']

/** Сколько секунд в среднем уходит на шаг — для раскладки сеанса по времени. */
export const STEP_SECONDS: Record<StepKind, number> = {
  intro: 50,
  listen: 22,
  dictation: 40,
  ladder: 45,
  accents: 50,
  passage: 170,
  chunk: 30,
  quick: 70,
  translate: 25,
  substitute: 40,
  card: 15,
}

export function stepsSeconds(steps: Step[]): number {
  return steps.reduce((s, x) => s + STEP_SECONDS[x.kind], 0)
}

/** Шаг с ответом, у которого есть «верно/неверно» (для точности в итогах). */
export function isQuestion(s: Step): boolean {
  return s.kind === 'listen' || s.kind === 'dictation' || s.kind === 'passage' || s.kind === 'accents'
}
