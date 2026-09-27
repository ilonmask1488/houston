/*
  Проигрыватель шагов: шапка с прогрессом, текущий шаг, запись ответов, прогресса модулей, карточек
  и сигнала, сохранение места (можно выйти и продолжить), итоги с репликой Ping.
*/
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IconClose } from '../../components/Icons'
import { StepTicks } from '../../components/Instruments'
import { Mascot } from '../../components/Mascot'
import { ConfirmDialog } from '../../components/ui'
import type { PlanBlock } from '../session/segments'
import { ExerciseHead, exerciseKind } from './ExerciseHead'
import ui from '../../components/ui.module.css'
import { moduleById } from '../../content'
import { formatSeconds, pick, ru } from '../../i18n/ru'
import { preloadTexts, stopAudio } from '../../lib/audio/audio'
import { markDone } from '../../lib/course/progress'
import type { AnswerSource } from '../../lib/db/types'
import { evaluateAchievements, type AchievementId } from '../../lib/progress/achievements'
import { addToday, recordAnswer } from '../../lib/progress/record'
import { SIGNAL, signalFor } from '../../lib/progress/signal'
import type { Step } from '../../lib/run/steps'
import { addChunkCards, addPhraseCard } from '../../lib/srs/cards'
import { CardStep } from './card'
import { AccentsStep, DictationStep, IntroStep, LadderStep, ListenStep, PassageStep } from './listening'
import type { StepResult } from './result'
import s from './run.module.css'
import { ChunkStep, QuickStep, SubstituteStep, TranslateStep } from './speaking'
import { preloadFor } from './preload'
import { StoryColdStep, StoryKeysStep, StoryListenStep, StoryShadowStep } from '../story/steps'
import { CleanSayStep, FalseFriendStep, PairHearStep, PairSayStep, StressStep } from './clean'
import { DocFindStep, DocParseStep, DocReadStep, DocRetellStep, DocSummaryStep } from './doc'
import { MailFixStep, MailOrderStep, MailRegisterStep, MailWriteStep } from './mail'

export type RunSummary = {
  seconds: number
  correct: number
  total: number
  signal: number
  spokenMs: number
  spoken: number
  accuracy: number | null
  completedModules: string[]
}

type Props = {
  steps: Step[]
  source: AnswerSource
  startAt?: number
  onStep?: (pos: number) => void
  onExit: () => void
  /** в конце: записать завершение сегмента */
  onFinish?: (r: RunSummary) => Promise<void>
  actions: (r: RunSummary) => ReactNode
  onRestart?: () => void
  /** что за блок или модуль — в шапке: «Быстрая речь на слух · 2 из 6» */
  title?: string
  /** заголовок итогов: «Готово: Разминка (игра) ✓» */
  summaryTitle?: string
  /** блоки всего занятия — тонкая полоса под шапкой */
  session?: PlanBlock[]
}

export function Runner(props: Props) {
  const { steps } = props
  const [index, setIndex] = useState(() => Math.min(props.startAt ?? 0, Math.max(0, steps.length - 1)))
  const [finished, setFinished] = useState<{ r: RunSummary; fresh: AchievementId[] } | null>(null)
  const acc = useRef({ correct: 0, total: 0, signal: 0, spokenMs: 0, spoken: 0, newItems: 0, completed: [] as string[] })
  const seconds = useRef(0)
  const lastTick = useRef(0)
  const busy = useRef(false)
  const finishing = useRef(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const resumed = (props.startAt ?? 0) > 0

  // Время: только пока вкладка видима.
  useEffect(() => {
    lastTick.current = Date.now()
    const tick = () => {
      const now = Date.now()
      if (document.visibilityState === 'visible') seconds.current += Math.min(60, (now - lastTick.current) / 1000)
      lastTick.current = now
    }
    const id = setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
      stopAudio()
    }
  }, [])

  useEffect(() => {
    preloadTexts(steps.slice(index, index + 4).flatMap(preloadFor))
  }, [index, steps])

  async function onDone(r: StepResult) {
    // Двойной тап по последнему «Дальше» не должен завершить круг дважды (дважды засчитать тренировку)
    if (busy.current || finishing.current) return
    busy.current = true
    try {
      const a = acc.current
      if (r.answer) await recordAnswer({ ...r.answer, source: props.source }).catch((e) => console.error(e))
      for (const d of r.done ?? []) {
        const { completedNow } = await markDone(d.module, d.item).catch(() => ({ completedNow: false }))
        if (completedNow) a.completed.push(d.module)
      }
      if (r.chunkLearned) a.newItems += await addChunkCards(r.chunkLearned).then(() => 1).catch(() => 0)
      if (r.missedPhrase) await addPhraseCard(r.missedPhrase).catch(() => false)
      if (r.correct !== undefined) {
        a.total++
        if (r.correct) a.correct++
      }
      if (r.spokenMs) {
        a.spokenMs += r.spokenMs
        a.spoken++
      }
      a.signal += signalFor({ seconds: 0, correct: r.correct ? 1 : 0, wrong: r.correct === false ? 1 : 0, spokenMs: r.spokenMs, onTime: r.onTime ? 1 : 0, fast: r.fast ? 1 : 0 })
      const next = index + 1
      props.onStep?.(next >= steps.length ? 0 : next)
      if (next >= steps.length) {
        finishing.current = true
        const secs = seconds.current
        const signal = a.signal + Math.round((secs / 60) * SIGNAL.perMinute) + SIGNAL.exerciseComplete + a.completed.length * SIGNAL.bossPassed
        const summary: RunSummary = {
          seconds: secs,
          correct: a.correct,
          total: a.total,
          signal,
          spokenMs: a.spokenMs,
          spoken: a.spoken,
          accuracy: a.total ? a.correct / a.total : null,
          completedModules: a.completed,
        }
        await addToday({ seconds: secs, signal, spokenMs: a.spokenMs, spoken: a.spoken, newItems: a.newItems }).catch((e) => console.error(e))
        await props.onFinish?.(summary).catch((e) => console.error(e))
        const fresh = await evaluateAchievements().catch(() => [] as AchievementId[])
        setFinished({ r: summary, fresh })
        return
      }
      setIndex(next)
      window.scrollTo(0, 0)
    } finally {
      busy.current = false
    }
  }

  if (finished) return <Summary {...finished} title={props.summaryTitle} actions={props.actions(finished.r)} />
  const step = steps[index]
  const kind = step ? exerciseKind(step) : null
  return (
    <div className={s.runner}>
      <div className={s.top}>
        <button type="button" className={s.close} onClick={() => setConfirmExit(true)} aria-label={ru.run.close}>
          <IconClose size={24} />
        </button>
        <div className={s.topMain}>
          {props.title && <span className={s.topTitle}>{props.title}</span>}
          <StepTicks total={steps.length} done={index} label={ru.run.progress(index + 1, steps.length)} />
        </div>
        <span className={`${s.count} mono`}>{steps.every((x) => x.kind === 'card') ? ru.run.cardOf(index + 1, steps.length) : ru.run.stepOf(index + 1, steps.length)}</span>
      </div>
      {props.session && (
        <div className={s.sessionBar} role="img" aria-label={ru.run.sessionBar(props.session.findIndex((b) => b.status === 'current') + 1, props.session.length)}>
          {props.session.map((b) => (
            <span key={b.block} data-status={b.status} style={{ flexGrow: b.minutes }} title={b.title} />
          ))}
        </div>
      )}
      {resumed && index === props.startAt && props.onRestart && (
        <div className={s.resume}>
          <span>{ru.run.resume}</span>
          <button type="button" className={ui.link} onClick={props.onRestart}>
            {ru.run.restart}
          </button>
        </div>
      )}
      {kind && <ExerciseHead key={`${index}:${kind}`} kind={kind} />}
      {step && <StepView key={`${index}:${JSON.stringify(step)}`} step={step} onDone={(r) => void onDone(r)} />}
      <ConfirmDialog
        open={confirmExit}
        title={ru.exercise.exitTitle}
        confirm={ru.exercise.exit}
        cancel={ru.exercise.stay}
        onCancel={() => setConfirmExit(false)}
        onConfirm={() => {
          setConfirmExit(false)
          props.onExit()
        }}
      >
        {props.source === 'session' ? ru.exercise.exitSession : ru.exercise.exitDrill}
      </ConfirmDialog>
    </div>
  )
}

export function StepView({ step, onDone }: { step: Step; onDone: (r: StepResult) => void }) {
  switch (step.kind) {
    case 'intro':
      return <IntroStep step={step} onDone={onDone} />
    case 'listen':
      return <ListenStep step={step} onDone={onDone} />
    case 'dictation':
      return <DictationStep step={step} onDone={onDone} />
    case 'ladder':
      return <LadderStep step={step} onDone={onDone} />
    case 'accents':
      return <AccentsStep step={step} onDone={onDone} />
    case 'passage':
      return <PassageStep step={step} onDone={onDone} />
    case 'chunk':
      return <ChunkStep step={step} onDone={onDone} />
    case 'quick':
      return <QuickStep step={step} onDone={onDone} />
    case 'translate':
      return <TranslateStep step={step} onDone={onDone} />
    case 'substitute':
      return <SubstituteStep step={step} onDone={onDone} />
    case 'card':
      return <CardStep step={step} onDone={onDone} />
    case 'storyListen':
      return <StoryListenStep step={step} onDone={onDone} />
    case 'storyShadow':
      return <StoryShadowStep step={step} onDone={onDone} />
    case 'storyKeys':
      return <StoryKeysStep step={step} onDone={onDone} />
    case 'storyCold':
      return <StoryColdStep step={step} onDone={onDone} />
    case 'docRead':
      return <DocReadStep step={step} onDone={onDone} />
    case 'docFind':
      return <DocFindStep step={step} onDone={onDone} />
    case 'docSummary':
      return <DocSummaryStep step={step} onDone={onDone} />
    case 'docRetell':
      return <DocRetellStep step={step} onDone={onDone} />
    case 'docParse':
      return <DocParseStep step={step} onDone={onDone} />
    case 'mailRegister':
      return <MailRegisterStep step={step} onDone={onDone} />
    case 'mailFix':
      return <MailFixStep step={step} onDone={onDone} />
    case 'mailOrder':
      return <MailOrderStep step={step} onDone={onDone} />
    case 'mailWrite':
      return <MailWriteStep step={step} onDone={onDone} />
    case 'pairHear':
      return <PairHearStep step={step} onDone={onDone} />
    case 'pairSay':
      return <PairSayStep step={step} onDone={onDone} />
    case 'cleanSay':
      return <CleanSayStep step={step} onDone={onDone} />
    case 'stress':
      return <StressStep step={step} onDone={onDone} />
    case 'falseFriend':
      return <FalseFriendStep step={step} onDone={onDone} />
  }
}

function Summary({ r, fresh, actions, title }: { r: RunSummary; fresh: AchievementId[]; actions: ReactNode; title?: string }) {
  const t = ru.run.summary
  const pool = r.accuracy === null || r.accuracy >= 0.85 ? ru.lines.summaryHigh : r.accuracy >= 0.6 ? ru.lines.summaryMid : ru.lines.summaryLow
  const [line] = useState(() => pick(pool))
  const done = r.completedModules.map((id) => moduleById.get(id)?.title).filter(Boolean)
  return (
    <div className={s.runner}>
      <div className={`${s.body} ${s.summary}`}>
        <Mascot mood={fresh.length || done.length || (r.accuracy ?? 1) >= 0.85 ? 'celebrate' : 'happy'} size={112} />
        <h1>{done.length ? t.moduleDone(done[0]!) : (title ?? t.title)}</h1>
        <p>{line}</p>
        <div className={s.stats}>
          <div className={s.stat}>
            <span className={s.statValue}>{formatSeconds(r.seconds)}</span>
            <span className={s.statLabel}>{t.time}</span>
          </div>
          <div className={s.stat}>
            <span className={s.statValue}>{r.accuracy === null ? '—' : `${Math.round(r.accuracy * 100)}%`}</span>
            <span className={s.statLabel}>{t.accuracy}</span>
          </div>
          <div className={s.stat}>
            <span className={s.statValue}>+{r.signal}</span>
            <span className={s.statLabel}>{t.signal}</span>
          </div>
          <div className={s.stat}>
            <span className={s.statValue}>{formatSeconds(r.spokenMs / 1000)}</span>
            <span className={s.statLabel}>{t.spoken}</span>
          </div>
        </div>
        {fresh.map((id) => (
          <div key={id} className={s.badge} role="status">
            <span className={s.statLabel}>{t.achievement}</span>
            <b>{ru.achievements.list[id]?.name}</b>
            <span>{ru.achievements.list[id]?.what}</span>
          </div>
        ))}
      </div>
      <div className={s.actions}>{actions}</div>
    </div>
  )
}
