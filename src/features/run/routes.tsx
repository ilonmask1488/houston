/* Маршруты упражнений: сегмент сеанса (/run/seg/:id) и свободная тренировка модуля (/run/module/:id). */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Placeholder, Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { moduleById, textById } from '../../content'
import { ru } from '../../i18n/ru'
import { doneSet, loadProgress, startModuleRow } from '../../lib/course/progress'
import type { SessionSegment } from '../../lib/db/types'
import { lastIntake } from '../../lib/intake/store'
import type { Step } from '../../lib/run/steps'
import { airSteps, callSteps, currentSpeed, docSteps, hash, stepAlive, todaySession, updateSegment } from '../../lib/session/session'
import { Runner } from './Runner'

export function SegmentRun() {
  const id = useParams().id ?? ''
  const navigate = useNavigate()
  const [seg, setSeg] = useState<SessionSegment | null | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    void todaySession().then((row) => {
      const found = row?.segments.find((x) => x.id === id) ?? null
      if (found?.module) void startModuleRow(found.module)
      setSeg(found)
    })
  }, [id])
  const steps = useMemo(() => (seg?.steps ?? []).filter(stepAlive), [seg])
  const back = () => navigate('/session')
  if (seg === undefined) return null
  if (!seg || !steps.length)
    return (
      <Screen title={ru.session.title} back>
        <Placeholder text={seg ? ru.steps.card.empty : ru.run.notFound} />
      </Screen>
    )
  return (
    <Runner
      key={attempt}
      steps={steps}
      source="session"
      startAt={attempt ? 0 : (seg.pos ?? 0)}
      onStep={(pos) => void updateSegment(seg.id, { pos })}
      onRestart={() => setAttempt((n) => n + 1)}
      onExit={back}
      onFinish={async (r) => {
        await updateSegment(seg.id, { status: 'done', pos: 0 }, { seconds: r.seconds, signal: r.signal, correct: r.correct, total: r.total, spokenMs: r.spokenMs })
      }}
      actions={() => (
        <button type="button" className={ui.signalButton} onClick={back}>
          {ru.run.summary.back}
        </button>
      )}
    />
  )
}

/** Задания к конкретному тексту из библиотеки (/run/text/:id). */
export function TextRun() {
  const id = useParams().id ?? ''
  const navigate = useNavigate()
  const [round, setRound] = useState(0)
  const t = textById.get(id)
  const m = t && moduleById.get(t.module)
  const steps = useMemo(
    () => (t && m ? docSteps({ module: m, done: new Set(), started: true, seed: hash(`${id}:${round}`), text: id }, 600) : []),
    [t, m, id, round],
  )
  useEffect(() => {
    if (m) void startModuleRow(m.id)
  }, [m])
  if (!t || !steps.length) return <Screen title={ru.run.notFound} back />
  return (
    <Runner
      key={round}
      steps={steps}
      source="drill"
      onExit={() => navigate(`/library/${id}`)}
      actions={() => (
        <>
          <button type="button" className={ui.signalButton} onClick={() => setRound((n) => n + 1)}>
            {ru.run.summary.again}
          </button>
          <button type="button" className={ui.secondary} onClick={() => navigate('/library')}>
            {ru.doc.toLibrary}
          </button>
        </>
      )}
    />
  )
}

/** Свободная тренировка модуля из «Треков»: один круг минут на пять. */
export function ModuleRun() {
  const id = useParams().id ?? ''
  const navigate = useNavigate()
  const [steps, setSteps] = useState<Step[] | null>(null)
  const [round, setRound] = useState(0)
  const m = moduleById.get(id)
  useEffect(() => {
    if (!m) return
    void (async () => {
      const progress = await loadProgress()
      const intake = await lastIntake()
      const seed = hash(`${id}:${Date.now()}`)
      const done = doneSet(progress, id)
      let out: Step[] = []
      if (m.track === 'air') out = airSteps({ module: m, done, started: progress.has(id) && round > 0, speed: await currentSpeed(intake), seed }, 300).flatMap((x) => x.steps)
      else if (m.track === 'call') out = callSteps({ module: m, done, seed, quickGame: false }, 360).flatMap((x) => x.steps ?? [])
      else if (m.track === 'doc') out = docSteps({ module: m, done, started: progress.has(id) && round > 0, seed }, 360)
      await startModuleRow(id)
      setSteps(out)
    })()
  }, [m, id, round])
  if (!m) return <Screen title={ru.run.notFound} back />
  if (!steps) return null
  if (!steps.length)
    return (
      <Screen title={m.title} back>
        <Placeholder text={ru.trackScreen.soonText} />
      </Screen>
    )
  return (
    <Runner
      key={round}
      steps={steps}
      source="drill"
      onExit={() => navigate('/tracks')}
      actions={() => (
        <>
          <button type="button" className={ui.signalButton} onClick={() => (setSteps(null), setRound((n) => n + 1))}>
            {ru.run.summary.again}
          </button>
          <button type="button" className={ui.secondary} onClick={() => navigate('/tracks')}>
            {ru.run.summary.toTracks}
          </button>
        </>
      )}
    />
  )
}
