/*
  «Близнецы» — минимальные пары на слух (ship/sheep, west/vest, think/sink) и «Ложные друзья» —
  инженерные ловушки перевода (конструкция ≠ construction). Обе — 60 секунд, серия даёт множитель.
*/
import { useEffect, useMemo, useState } from 'react'
import { SignalMeter } from '../../components/Instruments'
import { Mascot } from '../../components/Mascot'
import { content } from '../../content'
import type { FalseFriend, MinimalPair, VoiceId } from '../../content/types'
import { ru } from '../../i18n/ru'
import { defaultVoice, playText } from '../../lib/audio/audio'
import { hasAudio } from '../../lib/audio/manifest'
import ui from '../../components/ui.module.css'
import { loadDeck, type Deck } from '../../lib/games/deck'
import { gameRandom, twinsVoice } from '../../lib/games/games'
import { rng, shuffle } from '../../lib/intake/plan'
import { recordAnswer } from '../../lib/progress/record'
import { comboMultiplier } from '../../lib/progress/signal'
import { addFalseFriendCard } from '../../lib/srs/cards'
import c from '../run/clean.module.css'
import s from './games.module.css'
import { useTimed, type TimedOutcome } from './timed'

export function Hud({ left, streak, score }: { left: number; streak: number; score: number }) {
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

type TwinRound = { pair: MinimalPair; pick: 0 | 1; voice: VoiceId }

export function TwinsGame({ seconds, onFinish }: { seconds: number; onFinish: (o: TimedOutcome) => void }) {
  const random = useMemo(() => gameRandom(), [])
  const [deck, setDeck] = useState<Deck<MinimalPair> | null>(null)
  const [round, setRound] = useState<TwinRound | null>(null)
  const [given, setGiven] = useState<string | null>(null)
  const g = useTimed(seconds, onFinish, !!round)
  useEffect(() => {
    let alive = true
    // Пары с записью (оба слова): синтез телефона не гарантирует нужный звук в ship/sheep.
    // Пары без записи — только если записанных мало (пока не запущен generate_audio.py).
    const recorded = content.pairs.filter((p) => hasAudio(p.a) && hasAudio(p.b))
    const pool = recorded.length >= 30 ? recorded : content.pairs
    void loadDeck('twins', pool, ['pair']).then((d) => {
      if (!alive) return
      setDeck(d)
      setRound({ pair: d.draw(random), pick: random() < 0.5 ? 0 : 1, voice: defaultVoice() })
    })
    return () => {
      alive = false
    }
  }, [random])
  const target = round ? (round.pick === 0 ? round.pair.a : round.pair.b) : ''
  useEffect(() => {
    if (round) void playText(target, { voice: round.voice }).catch(() => {})
  }, [round, target])
  if (!deck || !round) return null
  const choose = (w: string) => {
    if (given !== null || g.ended.current) return
    setGiven(w)
    const ok = w === target
    deck.result(round.pair.id, ok)
    void deck.save().catch(() => {})
    void recordAnswer({ kind: 'pair', source: 'game', track: 'clean', item: round.pair.id, expected: target, given: w, correct: ok, tag: round.pair.module })
    const s2 = g.answer(ok)
    setTimeout(
      () => {
        if (g.ended.current) return
        setGiven(null)
        setRound({ pair: deck.draw(random, round.pair.id), pick: random() < 0.5 ? 0 : 1, voice: twinsVoice(s2, defaultVoice(), random) })
      },
      ok ? 600 : 1800,
    )
  }
  const gloss = (w: string) => (w === round.pair.a ? round.pair.ruA : round.pair.ruB)
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
      {given !== null && given !== target && (
        <div className={s.feedback} data-ok="false">
          <span>
            <b lang="en">{target}</b> /{round.pick === 0 ? round.pair.ipaA : round.pair.ipaB}/ — {gloss(target)}
          </span>
          <span className={s.feedbackNote}>
            <span lang="en">{given}</span> /{round.pick === 0 ? round.pair.ipaB : round.pair.ipaA}/ — {gloss(given)}
          </span>
        </div>
      )}
    </section>
  )
}

/* ——— Ложные друзья ——— */

export function FalseFriendsGame({ seconds, onFinish }: { seconds: number; onFinish: (o: TimedOutcome) => void }) {
  const random = useMemo(() => gameRandom(), [])
  const [deck, setDeck] = useState<Deck<FalseFriend> | null>(null)
  const [round, setRound] = useState<{ f: FalseFriend; options: string[] } | null>(null)
  const [given, setGiven] = useState<string | null>(null)
  const g = useTimed(seconds, onFinish, !!round, !!round && given !== null && given !== round.f.options[0])
  const make = (d: Deck<FalseFriend>, after?: string) => {
    const f = d.draw(random, after)
    return { f, options: shuffle(f.options, rng(Math.floor(random() * 1e9))) }
  }
  useEffect(() => {
    let alive = true
    void loadDeck('ff', content.falseFriends, ['ff']).then((d) => {
      if (!alive) return
      setDeck(d)
      setRound(make(d))
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (!deck || !round) return null
  const right = round.f.options[0]!
  const next = () => {
    if (g.ended.current) return
    setGiven(null)
    setRound(make(deck, round.f.id))
  }
  const choose = (o: string) => {
    if (given !== null || g.ended.current) return
    setGiven(o)
    const ok = o === right
    deck.result(round.f.id, ok)
    void deck.save().catch(() => {})
    void recordAnswer({ kind: 'ff', source: 'game', track: 'clean', item: round.f.id, expected: right, given: o, correct: ok, tag: 'false-friends' })
    void playText(right, { voice: defaultVoice() }).catch(() => {})
    if (!ok) void addFalseFriendCard(round.f.id).catch(() => {})
    g.answer(ok)
    // Верно — коротко и дальше; ошибка — объяснение остаётся, пока не нажмёшь «Дальше»
    if (ok) setTimeout(next, 1100)
  }
  return (
    <section className={s.play}>
      <Hud left={g.left} streak={g.streak} score={g.score} />
      <div className={s.question}>
        <p>{round.f.ru}</p>
        <p className={s.rules}>«{round.f.context}»</p>
      </div>
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
      {given !== null && (
        <div className={s.feedback} data-ok={String(given === right)}>
          <span>{round.f.why}</span>
        </div>
      )}
      {given !== null && given !== right && (
        <button type="button" className={ui.primary} onClick={next}>
          {ru.games.nextRound}
        </button>
      )}
    </section>
  )
}
