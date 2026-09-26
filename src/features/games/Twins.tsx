/*
  «Близнецы» — минимальные пары на слух (ship/sheep, west/vest, think/sink) и «Ложные друзья» —
  инженерные ловушки перевода (конструкция ≠ construction). Обе — 60 секунд, серия даёт множитель.
*/
import { useEffect, useMemo, useRef, useState } from 'react'
import { SignalMeter } from '../../components/Instruments'
import { Mascot } from '../../components/Mascot'
import { content } from '../../content'
import type { FalseFriend, MinimalPair, VoiceId } from '../../content/types'
import { ru } from '../../i18n/ru'
import { defaultVoice, playText, stopAudio } from '../../lib/audio/audio'
import { sfx } from '../../lib/audio/sfx'
import { comboPoints, gameRandom, twinsRound, twinsVoice } from '../../lib/games/games'
import { rng, shuffle } from '../../lib/intake/plan'
import { recordAnswer } from '../../lib/progress/record'
import { comboMultiplier } from '../../lib/progress/signal'
import { addFalseFriendCard } from '../../lib/srs/cards'
import c from '../run/clean.module.css'
import s from './games.module.css'

export type TimedOutcome = { score: number; correct: number; wrong: number; bestStreak: number; seconds: number; spokenMs: number; onTime: number }

/** Общий каркас игры на время: таймер, счёт, серия. */
function useTimed(seconds: number, onFinish: (o: TimedOutcome) => void) {
  const [left, setLeft] = useState(seconds)
  const [streak, setStreak] = useState(0)
  const [score, setScore] = useState(0)
  const stats = useRef({ correct: 0, wrong: 0, best: 0 })
  const ended = useRef(false)
  const started = useRef(0)
  useEffect(() => {
    started.current = Date.now()
    const timer = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (left > 0 || ended.current) return
    ended.current = true
    stopAudio()
    onFinish({ score, correct: stats.current.correct, wrong: stats.current.wrong, bestStreak: stats.current.best, seconds: (Date.now() - started.current) / 1000, spokenMs: 0, onTime: 0 })
  }, [left, score, onFinish])
  const answer = (ok: boolean): number => {
    const s2 = ok ? streak + 1 : 0
    if (ok) {
      stats.current.correct++
      stats.current.best = Math.max(stats.current.best, s2)
      setScore((x) => x + comboPoints(comboMultiplier(s2)))
      sfx(s2 === 5 || s2 === 10 ? 'combo' : 'correct')
    } else {
      stats.current.wrong++
      sfx('wrong')
    }
    setStreak(s2)
    return s2
  }
  return { left, streak, score, answer, ended }
}

function Hud({ left, streak, score }: { left: number; streak: number; score: number }) {
  const t = ru.games
  return (
    <div className={s.hud}>
      <span className="mono" aria-label={t.secondsLeft(left)}>
        {String(left).padStart(2, '0')} с
      </span>
      <SignalMeter value={Math.min(10, streak)} label={t.combo(comboMultiplier(streak))} />
      <span className={`${s.score} mono`}>
        {score} <span className={s.combo}>{t.combo(comboMultiplier(streak))}</span>
      </span>
    </div>
  )
}

/* ——— Близнецы ——— */

export function TwinsGame({ seconds, onFinish }: { seconds: number; onFinish: (o: TimedOutcome) => void }) {
  const random = useMemo(() => gameRandom(), [])
  const g = useTimed(seconds, onFinish)
  const [round, setRound] = useState<{ pair: MinimalPair; pick: 0 | 1; voice: VoiceId }>(() => ({ ...twinsRound(random), voice: defaultVoice() }))
  const [given, setGiven] = useState<string | null>(null)
  const target = round.pick === 0 ? round.pair.a : round.pair.b
  useEffect(() => {
    void playText(target, { voice: round.voice }).catch(() => {})
  }, [round, target])
  const choose = (w: string) => {
    if (given !== null || g.ended.current) return
    setGiven(w)
    const ok = w === target
    void recordAnswer({ kind: 'pair', source: 'game', track: 'clean', item: round.pair.id, expected: target, given: w, correct: ok, tag: round.pair.module })
    const s2 = g.answer(ok)
    setTimeout(() => {
      if (g.ended.current) return
      setGiven(null)
      setRound({ ...twinsRound(random, round.pair.id), voice: twinsVoice(s2, defaultVoice(), random) })
    }, ok ? 600 : 1300)
  }
  return (
    <section className={s.play}>
      <Hud left={g.left} streak={g.streak} score={g.score} />
      <button type="button" className={s.replay} onClick={() => void playText(target, { voice: round.voice }).catch(() => {})} aria-label={ru.clean.replay}>
        <Mascot mood={given === null ? 'thinking' : given === target ? 'happy' : 'oops'} size={96} />
      </button>
      <div className={`${c.pair} ${s.options}`} role="group" aria-label={ru.clean.hearGroup}>
        {[round.pair.a, round.pair.b].map((w) => (
          <button
            key={w}
            type="button"
            lang="en"
            className={c.choice}
            data-state={given === null ? undefined : w === target ? 'right' : w === given ? 'wrong' : undefined}
            onClick={() => choose(w)}
          >
            {w}
          </button>
        ))}
      </div>
    </section>
  )
}

/* ——— Ложные друзья ——— */

export function FalseFriendsGame({ seconds, onFinish }: { seconds: number; onFinish: (o: TimedOutcome) => void }) {
  const random = useMemo(() => gameRandom(), [])
  const g = useTimed(seconds, onFinish)
  const next = (after?: string): { f: FalseFriend; options: string[] } => {
    const pool = content.falseFriends.filter((x) => x.id !== after)
    const f = pool[Math.floor(random() * pool.length)]!
    return { f, options: shuffle(f.options, rng(Math.floor(random() * 1e9))) }
  }
  const [round, setRound] = useState(() => next())
  const [given, setGiven] = useState<string | null>(null)
  const right = round.f.options[0]!
  const choose = (o: string) => {
    if (given !== null || g.ended.current) return
    setGiven(o)
    const ok = o === right
    void recordAnswer({ kind: 'ff', source: 'game', track: 'clean', item: round.f.id, expected: right, given: o, correct: ok, tag: 'false-friends' })
    if (!ok) void addFalseFriendCard(round.f.id).catch(() => {})
    g.answer(ok)
    setTimeout(
      () => {
        if (g.ended.current) return
        setGiven(null)
        setRound(next(round.f.id))
      },
      ok ? 700 : 2600,
    )
  }
  return (
    <section className={s.play}>
      <Hud left={g.left} streak={g.streak} score={g.score} />
      <div className={s.question}>
        <p>{round.f.ru}</p>
        <p className={s.rules}>«{round.f.context}»</p>
      </div>
      {given !== null && given !== right && <p className={s.rules}>{round.f.why}</p>}
      <div className={s.options} role="group" aria-label={ru.clean.ffGroup}>
        {round.options.map((o) => (
          <button
            key={o}
            type="button"
            lang="en"
            className={s.option}
            data-state={given === null ? undefined : o === right ? 'right' : o === given ? 'wrong' : undefined}
            onClick={() => choose(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </section>
  )
}
