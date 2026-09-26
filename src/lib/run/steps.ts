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
  /** «Мой рассказ»: твой ответ — послушать, шэдоуинг, по опорным словам, без подсказок */
  | { kind: 'storyListen'; story: string }
  | { kind: 'storyShadow'; story: string }
  | { kind: 'storyKeys'; story: string }
  | { kind: 'storyCold'; story: string }
  /** Техдок: прочитать, найти ответ (на время), краткое содержание абзаца, пересказ вслух, разбор предложения */
  | { kind: 'docRead'; text: string }
  | { kind: 'docFind'; text: string; i: number; seconds?: number }
  | { kind: 'docSummary'; text: string; p: number }
  | { kind: 'docRetell'; text: string; p: number }
  | { kind: 'docParse'; text: string }

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
  storyListen: 60,
  storyShadow: 100,
  storyKeys: 90,
  storyCold: 100,
  docRead: 90,
  docFind: 40,
  docSummary: 30,
  docRetell: 50,
  docParse: 45,
}

/** Полная тренировка своего ответа. */
export function storyTraining(story: string): Step[] {
  return [
    { kind: 'storyListen', story },
    { kind: 'storyShadow', story },
    { kind: 'storyKeys', story },
    { kind: 'storyCold', story },
  ]
}

export function stepsSeconds(steps: Step[]): number {
  return steps.reduce((s, x) => s + STEP_SECONDS[x.kind], 0)
}

/** Шаг с ответом, у которого есть «верно/неверно» (для точности в итогах). */
export function isQuestion(s: Step): boolean {
  return ['listen', 'dictation', 'passage', 'accents', 'docFind', 'docSummary', 'docParse'].includes(s.kind)
}
