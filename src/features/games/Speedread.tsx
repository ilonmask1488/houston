/* «Скорочтение» (ТЗ §7.2): технический абзац, найти предложение с ответом, пока идёт таймер. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { SignalMeter } from '../../components/Instruments'
import { ru } from '../../i18n/ru'
import { sfx } from '../../lib/audio/sfx'
import { speedreadPoints, speedreadRounds, speedreadSeconds } from '../../lib/games/games'
import { recordAnswer } from '../../lib/progress/record'
import { comboMultiplier } from '../../lib/progress/signal'
import { splitSentences } from '../../lib/story/text'
import d from '../run/doc.module.css'
import s from './games.module.css'

export type SpeedreadOutcome = { score: number; correct: number; wrong: number; bestStreak: number; seconds: number; spokenMs: number; onTime: number }

export function SpeedreadGame({ onFinish }: { onFinish: (o: SpeedreadOutcome) => void }) {
  const t = ru.games
  const rounds = useMemo(() => speedreadRounds(Date.now()), [])
  const [i, setI] = useState(0)
  const [streak, setStreak] = useState(0)
  const [score, setScore] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [timeUp, setTimeUp] = useState(false)
  const limit = useRef(speedreadSeconds(0))
  const [left, setLeft] = useState(limit.current)
  const roundStart = useRef(Date.now())
  const started = useRef(Date.now())
  const stats = useRef({ correct: 0, wrong: 0, best: 0 })
  const ended = useRef(false)
  const item = rounds[i]
  const answered = picked !== null || timeUp

  useEffect(() => {
    if (answered) return
    const timer = setInterval(() => {
      const l = Math.max(0, limit.current - Math.floor((Date.now() - roundStart.current) / 1000))
      setLeft(l)
      if (l === 0) {
        setTimeUp(true)
        stats.current.wrong++
        setStreak(0)
        sfx('wrong')
        if (item) void recordAnswer({ kind: 'find', source: 'game', track: 'doc', item: item.id, expected: item.key, given: '', correct: false, tag: 'speedread' })
      }
    }, 250)
    return () => clearInterval(timer)
  }, [answered, i, item])

  if (!item) return null
  const isAnswer = (x: string) => x.toLowerCase().includes(item.key.toLowerCase())

  const pick = (x: string) => {
    if (answered) return
    setPicked(x)
    const ok = isAnswer(x)
    void recordAnswer({ kind: 'find', source: 'game', track: 'doc', item: item.id, expected: item.key, given: x, correct: ok, latencyMs: Date.now() - roundStart.current, tag: 'speedread' })
    if (ok) {
      const s2 = streak + 1
      stats.current.correct++
      stats.current.best = Math.max(stats.current.best, s2)
      setScore((v) => v + speedreadPoints(left, comboMultiplier(s2)))
      setStreak(s2)
      sfx(s2 === 3 || s2 === 5 ? 'combo' : 'correct')
    } else {
      stats.current.wrong++
      setStreak(0)
      sfx('wrong')
    }
  }

  const next = () => {
    if (ended.current) return
    if (i + 1 >= rounds.length) {
      ended.current = true
      onFinish({ score, correct: stats.current.correct, wrong: stats.current.wrong, bestStreak: stats.current.best, seconds: (Date.now() - started.current) / 1000, spokenMs: 0, onTime: 0 })
      return
    }
    limit.current = speedreadSeconds(streak)
    roundStart.current = Date.now()
    setLeft(limit.current)
    setPicked(null)
    setTimeUp(false)
    setI(i + 1)
  }

  return (
    <section className={s.play}>
      <div className={s.hud}>
        <span className={`${d.clock} mono`} data-low={left <= 5 || undefined} aria-label={t.secondsLeft(left)}>
          {String(left).padStart(2, '0')}
        </span>
        <SignalMeter value={Math.min(10, streak * 2)} label={t.combo(comboMultiplier(streak))} />
        <span className={`${s.score} mono`}>
          {score} <span className={s.combo}>{t.combo(comboMultiplier(streak))}</span>
        </span>
      </div>
      <p className={`${s.speed} mono`}>{t.quickRound(i + 1, rounds.length)}</p>
      <div className={s.question}>
        <p lang="en">{item.q}</p>
      </div>
      <article className={`${d.article} ${s.speedText}`} lang="en" role="group" aria-label={ru.doc.findGroup}>
        {item.paragraphs.map((p, pi) => (
          <p key={pi}>
            {splitSentences(p).map((x, k) => (
              <button
                key={k}
                type="button"
                className={d.sentence}
                disabled={answered}
                data-state={answered ? (isAnswer(x) ? 'right' : x === picked ? 'wrong' : undefined) : undefined}
                onClick={() => pick(x)}
              >
                {x}{' '}
              </button>
            ))}
          </p>
        ))}
      </article>
      {answered && (
        <button type="button" className={s.nextRound} onClick={next} autoFocus>
          {i + 1 >= rounds.length ? t.finish : ru.run.next}
        </button>
      )}
    </section>
  )
}
