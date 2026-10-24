/*
  Игры на материал, которого раньше не было в «Тренировке»:
  «Цифры на слух» — генерируемые числа с единицами (не кончаются),
  «Термин на слух» — 350+ озвученных технических терминов словаря,
  «Грамматика» — пропуски и «найди ошибку» с правилом после каждого ответа.
*/
import { useEffect, useMemo, useRef, useState } from 'react'
import { Mascot } from '../../components/Mascot'
import ui from '../../components/ui.module.css'
import { content } from '../../content'
import type { DictWord, GrammarFixItem, GrammarGap, VoiceId } from '../../content/types'
import { ru } from '../../i18n/ru'
import { defaultVoice, playText, stopAudio } from '../../lib/audio/audio'
import { sfx } from '../../lib/audio/sfx'
import { fieldWords, loadDictionary } from '../../lib/dict/dict'
import { loadDeck, type Deck } from '../../lib/games/deck'
import { comboPoints, gameRandom, twinsVoice } from '../../lib/games/games'
import { numberItem, NUMBER_KINDS, type NumberItem } from '../../lib/games/numbers'
import { rng, shuffle } from '../../lib/intake/plan'
import { recordAnswer } from '../../lib/progress/record'
import { comboMultiplier } from '../../lib/progress/signal'
import { addWordCards } from '../../lib/srs/cards'
import s from './games.module.css'
import { useTimed, type TimedOutcome } from './timed'
import { Hud } from './Twins'

const STD: VoiceId[] = ['us-f', 'us-m', 'gb-f', 'gb-m']

/* ——— Цифры на слух ——— */

export function NumbersGame({ seconds, onFinish }: { seconds: number; onFinish: (o: TimedOutcome) => void }) {
  const t = ru.games
  const random = useMemo(() => gameRandom(), [])
  const offset = useMemo(() => Math.floor(random() * NUMBER_KINDS), [random])
  const g = useTimed(seconds, onFinish)
  const k = useRef(0)
  const make = (): { item: NumberItem; options: string[]; voice: VoiceId } => {
    const item = numberItem(random, k.current++, offset)
    return { item, options: shuffle(item.options, rng(Math.floor(random() * 1e9))), voice: STD[k.current % STD.length]! }
  }
  const [round, setRound] = useState(make)
  const [given, setGiven] = useState<string | null>(null)
  const rate = Math.min(1.25, 0.9 + 0.05 * g.streak)
  const play = () => void playText(round.item.say, { voice: round.voice, rate }).catch(() => {})
  useEffect(() => {
    play()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round])
  const right = round.item.options[0]!
  const choose = (o: string) => {
    if (given !== null || g.ended.current) return
    setGiven(o)
    const ok = o === right
    void recordAnswer({ kind: 'number', source: 'game', track: 'air', item: round.item.id, expected: right, given: o, correct: ok, speed: rate, tag: round.item.id.split('-')[0] })
    g.answer(ok)
    setTimeout(
      () => {
        if (g.ended.current) return
        setGiven(null)
        setRound(make())
      },
      ok ? 700 : 2600,
    )
  }
  return (
    <section className={s.play}>
      <Hud left={g.left} streak={g.streak} score={g.score} />
      <p className={`${s.speed} mono`}>
        {round.item.ru} · {t.speed} {rate.toFixed(2)}×
      </p>
      <button type="button" className={s.replay} onClick={play} aria-label={ru.steps.listen.replay}>
        <Mascot mood={given === null ? 'thinking' : given === right ? 'happy' : 'oops'} size={96} />
      </button>
      <div className={s.options} role="group" aria-label={t.numbers.title}>
        {round.options.map((o) => (
          <button key={o} type="button" className={`${s.option} mono`} data-state={given === null ? undefined : o === right ? 'right' : o === given ? 'wrong' : undefined} onClick={() => choose(o)}>
            {o}
          </button>
        ))}
      </div>
      {given !== null && given !== right && (
        <div className={s.feedback} data-ok="false">
          <span className={s.feedbackNote}>{t.heard}</span>
          <span lang="en" className={s.feedbackEn}>
            {round.item.say}
          </span>
        </div>
      )}
    </section>
  )
}

/* ——— Термин на слух ——— */

type TermRound = { w: DictWord; options: string[]; voice: VoiceId }

export function TermsGame({ seconds, onFinish }: { seconds: number; onFinish: (o: TimedOutcome) => void }) {
  const t = ru.games
  const random = useMemo(() => gameRandom(), [])
  const [deck, setDeck] = useState<Deck<DictWord> | null>(null)
  const [round, setRound] = useState<TermRound | null>(null)
  const [given, setGiven] = useState<string | null>(null)
  const g = useTimed(seconds, onFinish, !!round)

  const make = (d: Deck<DictWord>, streak: number, after?: string): TermRound => {
    const w = d.draw(random, after)
    // Отвлекающие переводы — из той же темы: ракета-носитель против разгонного блока, а не против «болта»
    const same = d.pool.filter((x) => x.id !== w.id && x.topic === w.topic && x.ru !== w.ru)
    const other = d.pool.filter((x) => x.id !== w.id && x.ru !== w.ru)
    const traps = [...new Set(shuffle(same.length >= 3 ? same : other, rng(Math.floor(random() * 1e9))).map((x) => x.ru))].slice(0, 3)
    const voices = w.voices?.length ? w.voices : STD
    const v = twinsVoice(streak, defaultVoice(), random)
    return { w, options: shuffle([w.ru, ...traps], rng(Math.floor(random() * 1e9))), voice: voices.includes(v) ? v : voices[0]! }
  }

  useEffect(() => {
    let alive = true
    void (async () => {
      await loadDictionary()
      const pool = fieldWords().filter((w) => w.band === 'tech' && w.voices?.length)
      const d = await loadDeck('terms', pool, ['term'])
      if (!alive) return
      setDeck(d)
      setRound(make(d, 0))
    })()
    return () => {
      alive = false
      stopAudio()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (round) void playText(round.w.text, { voice: round.voice }).catch(() => {})
  }, [round])

  if (!deck || !round) return <p className={s.rules}>{t.termsLoading}</p>
  const right = round.w.ru
  const choose = (o: string) => {
    if (given !== null || g.ended.current) return
    setGiven(o)
    const ok = o === right
    deck.result(round.w.id, ok)
    void recordAnswer({ kind: 'term', source: 'game', track: 'doc', item: round.w.id, expected: right, given: o, correct: ok, tag: round.w.topic })
    if (!ok) void addWordCards(round.w.id).catch(() => {})
    const s2 = g.answer(ok)
    void deck.save().catch(() => {})
    setTimeout(
      () => {
        if (g.ended.current) return
        setGiven(null)
        setRound(make(deck, s2, round.w.id))
      },
      ok ? 900 : 2400,
    )
  }
  return (
    <section className={s.play}>
      <Hud left={g.left} streak={g.streak} score={g.score} />
      <button type="button" className={s.replay} onClick={() => void playText(round.w.text, { voice: round.voice }).catch(() => {})} aria-label={ru.steps.listen.replay}>
        <Mascot mood={given === null ? 'thinking' : given === right ? 'happy' : 'oops'} size={96} />
      </button>
      {given !== null && (
        <div className={s.feedback} data-ok={String(given === right)}>
          <span lang="en" className={s.feedbackEn}>
            {round.w.text}
          </span>
          {round.w.ipa && <span className={`${s.feedbackNote} mono`}>/{round.w.ipa}/</span>}
        </div>
      )}
      <div className={s.options} role="group" aria-label={t.terms.title}>
        {round.options.map((o) => (
          <button key={o} type="button" className={s.option} data-state={given === null ? undefined : o === right ? 'right' : o === given ? 'wrong' : undefined} onClick={() => choose(o)}>
            {o}
          </button>
        ))}
      </div>
    </section>
  )
}

/* ——— Грамматика ——— */

export const GRAMMAR_ROUNDS = 12

type GItem = { id: string; gap?: GrammarGap; fix?: GrammarFixItem }

/** Показ «∅» словами: ученик не обязан знать значок. */
function optLabel(o: string): string {
  return o === '∅' ? `— (${ru.games.nothing})` : o
}

export function GrammarGame({ onFinish }: { onFinish: (o: TimedOutcome) => void }) {
  const t = ru.games
  const random = useMemo(() => gameRandom(), [])
  const [deck, setDeck] = useState<Deck<GItem> | null>(null)
  const [i, setI] = useState(0)
  const [item, setItem] = useState<GItem | null>(null)
  const [options, setOptions] = useState<string[]>([])
  const [given, setGiven] = useState<string | null>(null)
  const acc = useRef({ score: 0, correct: 0, wrong: 0, streak: 0, best: 0, started: Date.now() })

  const take = (d: Deck<GItem>, after?: string) => {
    const it = d.draw(random, after)
    setItem(it)
    setOptions(it.gap ? shuffle(it.gap.options, rng(Math.floor(random() * 1e9))) : shuffle([it.fix!.right, it.fix!.wrong], rng(Math.floor(random() * 1e9))))
    setGiven(null)
  }

  useEffect(() => {
    let alive = true
    void (async () => {
      const pool: GItem[] = [...content.grammarGaps.map((gap) => ({ id: gap.id, gap })), ...content.grammarFix.map((fix) => ({ id: fix.id, fix }))]
      if (!pool.length) return
      const d = await loadDeck('grammar', pool, ['grammar'])
      if (!alive) return
      setDeck(d)
      take(d)
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!deck || !item) return null
  const right = item.gap ? item.gap.options[0]! : item.fix!.right
  const topic = (item.gap ?? item.fix)!.topic
  const why = (item.gap ?? item.fix)!.why
  const full = item.gap ? item.gap.text.replace('___', right === '∅' ? '' : right).replace(/\s{2,}/g, ' ').replace(/\s([.,?!])/g, '$1') : item.fix!.right
  const choose = (o: string) => {
    if (given !== null) return
    setGiven(o)
    const ok = o === right
    const a = acc.current
    deck.result(item.id, ok)
    void deck.save().catch(() => {})
    void recordAnswer({ kind: 'grammar', source: 'game', item: item.id, expected: right, given: o, correct: ok, tag: topic })
    if (ok) {
      a.correct++
      a.streak++
      a.best = Math.max(a.best, a.streak)
      a.score += comboPoints(comboMultiplier(a.streak))
      sfx(a.streak === 5 || a.streak === 10 ? 'combo' : 'correct')
    } else {
      a.wrong++
      a.streak = 0
      sfx('wrong')
    }
  }
  const next = () => {
    const a = acc.current
    if (i + 1 >= GRAMMAR_ROUNDS) {
      onFinish({ score: a.score, correct: a.correct, wrong: a.wrong, bestStreak: a.best, seconds: (Date.now() - a.started) / 1000, spokenMs: 0, onTime: 0 })
      return
    }
    setI(i + 1)
    take(deck, item.id)
  }
  const parts = item.gap?.text.split('___')
  return (
    <section className={s.play}>
      <div className={s.hud}>
        <span className="mono">{t.grammarRound(i + 1, GRAMMAR_ROUNDS)}</span>
        <span className={`${s.score} mono`}>
          {acc.current.score} <span className={s.combo}>{t.combo(comboMultiplier(acc.current.streak))}</span>
        </span>
      </div>
      <div className={s.question}>
        <span className={s.topic}>{t.topic[topic] ?? topic}</span>
        {item.gap ? (
          <p lang="en">
            {parts![0]}
            <span className={s.gap}>{given === null ? '…' : optLabel(right)}</span>
            {parts![1]}
          </p>
        ) : (
          <p className={s.rules}>{t.fixAsk}</p>
        )}
        {item.gap && <p className={s.rules}>{t.gapAsk}</p>}
      </div>
      <div className={s.options} role="group" aria-label={item.gap ? t.gapGroup : t.fixGroup}>
        {options.map((o) => (
          <button key={o} type="button" lang="en" className={s.option} data-state={given === null ? undefined : o === right ? 'right' : o === given ? 'wrong' : undefined} onClick={() => choose(o)}>
            {optLabel(o)}
          </button>
        ))}
      </div>
      {given !== null && (
        <>
          <div className={s.feedback} data-ok={String(given === right)}>
            <span lang="en" className={s.feedbackEn}>
              {full}
            </span>
            <span className={s.feedbackNote}>{(item.gap ?? item.fix)!.ru}</span>
            <span>{why}</span>
          </div>
          <button type="button" className={ui.primary} onClick={next}>
            {t.nextRound}
          </button>
        </>
      )}
    </section>
  )
}
