/*
  Шапка упражнения (UX §4.1): инструкция глаголом, строка шагов и «?». При первой встрече
  с видом упражнения — однократная подсказка поверх экрана (коучмарк). Как в «Сяо Хо».
*/
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Help } from '../../components/Help'
import { Sheet } from '../../components/Sheet'
import type { ExerciseKind } from '../../i18n/exercises'
import { ru } from '../../i18n/ru'
import { db } from '../../lib/db/db'
import type { Step } from '../../lib/run/steps'
import { parseCardId } from '../../lib/srs/srs'
import s from './run.module.css'

/** Какой вид упражнения у шага (у карточек — по типу карточки). Объяснение модуля — не упражнение. */
export function exerciseKind(step: Step): ExerciseKind | null {
  if (step.kind === 'intro') return null
  if (step.kind === 'card') return `card${parseCardId(step.card).kind}` as ExerciseKind
  return step.kind
}

function parse(v: string | undefined): string[] {
  try {
    const list = v ? (JSON.parse(v) as unknown) : []
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function useCoachmark(kind: ExerciseKind) {
  const seen = useLiveQuery(async () => ({ list: parse(await db.getMeta<string>('seenExercises')) }), [])
  // Закрываем сразу локально: запись в базу догонит.
  const [closed, setClosed] = useState(false)
  const show = !closed && !!seen && !seen.list.includes(kind)
  const dismiss = () => {
    setClosed(true)
    void db.setMeta('seenExercises', JSON.stringify([...new Set([...(seen?.list ?? []), kind])]))
  }
  return { show, dismiss }
}

export function ExerciseHead({ kind }: { kind: ExerciseKind }) {
  const t = ru.exercise.kinds[kind]
  const coach = useCoachmark(kind)
  return (
    <>
      <div className={s.exHead}>
        <div className={s.exText}>
          <p className={s.exTitle}>{t.title}</p>
          <p className={s.exSteps}>{t.steps}</p>
        </div>
        <Help title={t.title} text={t.help} />
      </div>
      {coach.show && (
        <Sheet title={ru.exercise.newTitle(t.title)} onClose={coach.dismiss}>
          {t.help.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <p>
            <b>{t.steps}</b>
          </p>
        </Sheet>
      )}
    </>
  )
}
