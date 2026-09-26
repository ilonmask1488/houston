/* Мини-игры: «Помехи», «Быстрый ответ», «Скорочтение». Маршрут /game/:id (?seg=… — сегмент сеанса). */
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { IconClose } from '../../components/Icons'
import { SignalMeter } from '../../components/Instruments'
import { Mascot } from '../../components/Mascot'
import { PingSays, Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { VoiceAnswer, VoiceReport, type VoiceResult } from '../../components/Voice'
import { accentOf } from '../../content/types'
import { pick, ru } from '../../i18n/ru'
import { playText, stopAudio } from '../../lib/audio/audio'
import { sfx, startStatic } from '../../lib/audio/sfx'
import { loadProgress } from '../../lib/course/progress'
import { db } from '../../lib/db/db'
import { comboPoints, GAME_IDS, gameRandom, quickPoints, quickQuestions, saveRecord, STATIC_SECONDS, staticNoise, staticPool, staticSpeed, type GameId, type StaticItem } from '../../lib/games/games'
import { rng, shuffle } from '../../lib/intake/plan'
import { lastIntake } from '../../lib/intake/store'
import { evaluateAchievements } from '../../lib/progress/achievements'
import { addToday, recordAnswer } from '../../lib/progress/record'
import { comboMultiplier, signalFor } from '../../lib/progress/signal'
import { currentSpeed, updateSegment } from '../../lib/session/session'
import { useSettings } from '../../lib/settings/settings'
import s from './games.module.css'
import { SpeedreadGame } from './Speedread'

type Outcome = { score: number; correct: number; wrong: number; bestStreak: number; seconds: number; spokenMs: number; onTime: number }

export function GameRoute() {
  const id = useParams().id as GameId
  const [params] = useSearchParams()
  const seg = params.get('seg')
  // ?seconds= — короткий раунд для автотестов
  const seconds = Number(params.get('seconds')) || STATIC_SECONDS
  const navigate = useNavigate()
  const [phase, setPhase] = useState<'intro' | 'play' | 'over'>('intro')
  const [outcome, setOutcome] = useState<{ o: Outcome; best: number; weekBest: number; isBest: boolean; signal: number } | null>(null)
  const [round, setRound] = useState(0)
  const record = useLiveQuery(() => db.gameRecords.get(id), [id, outcome])
  const t = ru.games
  if (!GAME_IDS.includes(id)) return <Screen title={ru.run.notFound} back />
  const info = t[id]

  const finish = async (o: Outcome) => {
    const r = await saveRecord(id, o.score)
    const signal = signalFor({ seconds: o.seconds, correct: o.correct, wrong: o.wrong, spokenMs: o.spokenMs, onTime: o.onTime }) + Math.floor(o.score / 10)
    await addToday({ seconds: o.seconds, signal, spokenMs: o.spokenMs, spoken: id === 'quick' ? o.correct + o.wrong : 0 })
    if (seg) await updateSegment(seg, { status: 'done' }, { seconds: o.seconds, signal, correct: o.correct, total: o.correct + o.wrong, spokenMs: o.spokenMs })
    await evaluateAchievements()
    if (r.isBest) sfx('combo')
    setOutcome({ o, ...r, signal })
    setPhase('over')
  }

  const exit = () => (stopAudio(), navigate(seg ? '/session' : '/more'))

  return (
    <main className={s.game}>
      <div className={s.top}>
        <button type="button" className={s.close} aria-label={t.exit} onClick={exit}>
          <IconClose size={24} />
        </button>
        <span className={s.gameTitle}>{info.title}</span>
      </div>
      {phase === 'intro' && (
        <section className={s.intro}>
          <Mascot mood="wink" size={112} />
          <h1>{info.title}</h1>
          <p>{info.what}</p>
          <p className={s.rules}>{t.rules[id]}</p>
          {record && (
            <p className="mono">
              {t.best(record.best)} · {t.weekBest(record.weekBest)}
            </p>
          )}
          <button type="button" className={ui.signalButton} onClick={() => setPhase('play')}>
            {t.start}
          </button>
        </section>
      )}
      {phase === 'play' &&
        (id === 'static' ? (
          <StaticGame key={round} seconds={seconds} onFinish={(o) => void finish(o)} />
        ) : id === 'quick' ? (
          <QuickGame key={round} onFinish={(o) => void finish(o)} />
        ) : (
          <SpeedreadGame key={round} onFinish={(o) => void finish(o)} />
        ))}
      {phase === 'over' && outcome && (
        <section className={s.intro}>
          <Mascot mood={outcome.isBest ? 'celebrate' : 'happy'} size={112} />
          <h1>{t.over}</h1>
          <p className={s.bigScore}>{outcome.o.score}</p>
          {outcome.isBest && <p className={s.record}>{t.newRecord}</p>}
          <p className="mono">
            {t.best(outcome.best)} · {t.weekBest(outcome.weekBest)}
          </p>
          <p>{t.stats(outcome.o.correct, outcome.o.wrong, outcome.o.bestStreak, outcome.signal)}</p>
          <div className={s.actions}>
            {seg ? (
              <button type="button" className={ui.signalButton} onClick={() => navigate('/session')}>
                {t.toSession}
              </button>
            ) : (
              <button type="button" className={ui.signalButton} onClick={() => (setRound((n) => n + 1), setOutcome(null), setPhase('play'))}>
                {t.again}
              </button>
            )}
            {seg ? (
              <button type="button" className={ui.secondary} onClick={() => (setRound((n) => n + 1), setOutcome(null), setPhase('play'))}>
                {t.again}
              </button>
            ) : (
              <button type="button" className={ui.secondary} onClick={exit}>
                {t.done}
              </button>
            )}
          </div>
        </section>
      )}
    </main>
  )
}

/* ——— Помехи ——— */

function StaticGame({ seconds, onFinish }: { seconds: number; onFinish: (o: Outcome) => void }) {
  const t = ru.games
  const [pool, setPool] = useState<StaticItem[] | null>(null)
  const [base, setBase] = useState(1)
  const [item, setItem] = useState<StaticItem | null>(null)
  const [options, setOptions] = useState<string[]>([])
  const [given, setGiven] = useState<number | null>(null)
  const [left, setLeft] = useState(seconds)
  const [streak, setStreak] = useState(0)
  const [score, setScore] = useState(0)
  const stats = useRef({ correct: 0, wrong: 0, best: 0 })
  const random = useMemo(() => gameRandom(), [])
  const stopNoise = useRef<() => void>(() => {})
  const ended = useRef(false)
  const started = useRef(Date.now())

  useEffect(() => {
    void (async () => {
      const [progress, intake] = await Promise.all([loadProgress(), lastIntake()])
      setBase(await currentSpeed(intake))
      setPool(staticPool(progress))
    })()
    return () => {
      stopNoise.current()
      stopAudio()
    }
  }, [])

  const speed = staticSpeed(base, streak)
  const next = (after?: StaticItem, st = streak) => {
    if (!pool) return
    const rate = staticSpeed(base, st)
    const cand = pool.filter((p) => p.id !== after?.id)
    const it = cand[Math.floor(random() * cand.length)]!
    setItem(it)
    setOptions(shuffle(it.options, rng(Math.floor(random() * 1e9))))
    setGiven(null)
    stopNoise.current()
    stopNoise.current = startStatic(staticNoise(st))
    void playText(it.say ?? it.text, { voice: it.voice, rate })
      .catch(() => {})
      .finally(() => stopNoise.current())
  }

  useEffect(() => {
    if (pool && !item) next()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool])

  useEffect(() => {
    if (!pool) return
    const timer = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000)
    return () => clearInterval(timer)
  }, [pool])

  useEffect(() => {
    if (left > 0 || ended.current) return
    ended.current = true
    stopNoise.current()
    stopAudio()
    onFinish({ score, correct: stats.current.correct, wrong: stats.current.wrong, bestStreak: stats.current.best, seconds: (Date.now() - started.current) / 1000, spokenMs: 0, onTime: 0 })
  }, [left, score, onFinish])

  if (!pool || !item) return null
  const right = options.indexOf(item.text)
  const answer = (k: number) => {
    if (given !== null || ended.current) return
    setGiven(k)
    const ok = k === right
    void recordAnswer({ kind: 'listen', source: 'game', track: 'air', item: item.id, expected: item.text, given: options[k] ?? '', correct: ok, speed, accent: accentOf(item.voice), tag: 'static' })
    const s2 = ok ? streak + 1 : 0
    if (ok) {
      stats.current.correct++
      stats.current.best = Math.max(stats.current.best, s2)
      setScore((x) => x + comboPoints(comboMultiplier(s2)))
      setStreak(s2)
      sfx(s2 === 5 || s2 === 10 ? 'combo' : 'correct')
    } else {
      stats.current.wrong++
      setStreak(0)
      sfx('wrong')
    }
    setTimeout(() => !ended.current && next(item, s2), ok ? 650 : 1400)
  }
  return (
    <section className={s.play}>
      <div className={s.hud}>
        <span className="mono" aria-label={t.secondsLeft(left)}>
          {String(left).padStart(2, '0')} с
        </span>
        <SignalMeter value={Math.min(10, streak)} label={`${t.combo(comboMultiplier(streak))}`} />
        <span className={`${s.score} mono`}>
          {score} <span className={s.combo}>{t.combo(comboMultiplier(streak))}</span>
        </span>
      </div>
      <p className={`${s.speed} mono`}>
        {t.speed} {speed.toFixed(2)}×
      </p>
      <button type="button" className={s.replay} onClick={() => void playText(item.say ?? item.text, { voice: item.voice, rate: speed }).catch(() => {})} aria-label={ru.steps.listen.replay}>
        <Mascot mood={given === null ? 'thinking' : given === right ? 'happy' : 'oops'} size={96} />
      </button>
      <div className={s.options} role="group" aria-label={ru.steps.listen.title}>
        {options.map((o, k) => (
          <button
            key={o}
            type="button"
            lang="en"
            className={s.option}
            data-state={given === null ? undefined : k === right ? 'right' : k === given ? 'wrong' : undefined}
            onClick={() => answer(k)}
          >
            {o}
          </button>
        ))}
      </div>
    </section>
  )
}

/* ——— Быстрый ответ ——— */

function QuickGame({ onFinish }: { onFinish: (o: Outcome) => void }) {
  const t = ru.games
  const settings = useSettings()
  const questions = useMemo(() => quickQuestions(Date.now()), [])
  const [i, setI] = useState(0)
  const [result, setResult] = useState<VoiceResult | undefined>(undefined)
  const [self, setSelf] = useState<{ onTime?: boolean; clean?: boolean }>({})
  const acc = useRef({ score: 0, onTime: 0, spokenMs: 0, rounds: 0, clean: 0 })
  const started = useRef(Date.now())
  const [line, setLine] = useState('')
  const q = questions[i]!
  const measured = !!result && (result.recorded || result.recognized)

  const score = (): ReturnType<typeof quickPoints> | null => {
    if (result === undefined) return null
    if (measured) return quickPoints({ onTime: !!result!.onTime, speechMs: result!.speechMs, longPauses: result!.longPauses, measured: true })
    if (self.onTime === undefined || self.clean === undefined) return null
    return quickPoints({ onTime: self.onTime, speechMs: 0, longPauses: self.clean ? 0 : 1, measured: false })
  }
  const pts = score()

  const next = () => {
    if (!pts) return
    const a = acc.current
    a.score += pts.total
    a.rounds++
    if (pts.onTime) a.onTime++
    if (pts.clean) a.clean++
    a.spokenMs += measured ? result!.speechMs : 20_000
    void recordAnswer({ kind: 'quick', source: 'game', track: 'call', item: q.id, expected: '', given: result?.transcript ?? '', correct: pts.onTime > 0 && pts.clean > 0, latencyMs: result?.startMs, speechMs: measured ? result!.speechMs : undefined, tag: 'quick-game' })
    if (i + 1 >= questions.length) {
      onFinish({ score: a.score, correct: a.clean, wrong: a.rounds - a.clean, bestStreak: a.onTime, seconds: (Date.now() - started.current) / 1000, spokenMs: a.spokenMs, onTime: a.onTime })
      return
    }
    setI(i + 1)
    setResult(undefined)
    setSelf({})
    setLine('')
  }

  useEffect(() => {
    if (pts) setLine(pick(pts.total >= 70 ? ru.lines.correct : ru.lines.wrong))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts?.total])

  return (
    <section className={s.play}>
      <div className={s.hud}>
        <span className="mono">{t.quickRound(i + 1, questions.length)}</span>
        <span className={`${s.score} mono`}>{acc.current.score + (pts?.total ?? 0)}</span>
      </div>
      <div className={s.question}>
        <p lang="en">{q.q}</p>
        <p className={s.rules}>{q.ru}</p>
      </div>
      {result === undefined ? (
        <VoiceAnswer key={q.id} timed={settings.answerSeconds} maxSeconds={45} prompt={{ text: q.q, voice: q.voice }} autoStart={i > 0} label={ru.intake.listenPlay} onResult={setResult} />
      ) : (
        <>
          <VoiceReport result={result} />
          {!measured && (
            <div className={s.selfCheck}>
              <p>{t.selfOnTime}</p>
              <div className={ui.row}>
                {[true, false].map((v) => (
                  <button key={String(v)} type="button" className={ui.secondary} aria-pressed={self.onTime === v} onClick={() => setSelf((x) => ({ ...x, onTime: v }))}>
                    {v ? t.yes : t.no}
                  </button>
                ))}
              </div>
              <p>{t.selfClean}</p>
              <div className={ui.row}>
                {[true, false].map((v) => (
                  <button key={String(v)} type="button" className={ui.secondary} aria-pressed={self.clean === v} onClick={() => setSelf((x) => ({ ...x, clean: v }))}>
                    {v ? t.yes : t.no}
                  </button>
                ))}
              </div>
            </div>
          )}
          {pts && (
            <>
              <p className={`${s.points} mono`}>{t.quickPoints(pts.onTime, pts.duration, pts.clean)}</p>
              {line && (
                <PingSays mood={pts.total >= 70 ? 'celebrate' : 'thinking'} size={56}>
                  {line}
                </PingSays>
              )}
            </>
          )}
          <button type="button" className={ui.primary} disabled={!pts} onClick={next}>
            {ru.run.next}
          </button>
        </>
      )}
    </section>
  )
}
