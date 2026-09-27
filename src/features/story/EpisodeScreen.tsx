/* Эпизод сюжета «Международный проект» (ТЗ §7.3). Маршрут /episode/:id. */
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ClaudeButton } from '../../components/ClaudeButton'
import { IconClose } from '../../components/Icons'
import { StepTicks } from '../../components/Instruments'
import { Mascot } from '../../components/Mascot'
import { PlayButton } from '../../components/Play'
import { PingSays, Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { VoiceAnswer, VoiceReport, type VoiceResult } from '../../components/Voice'
import { characterById, content, episodeById, moduleById } from '../../content'
import { isMyLine, type Episode } from '../../content/types'
import { pick, ru } from '../../i18n/ru'
import { defaultVoice, playText, stopAudio } from '../../lib/audio/audio'
import { sfx } from '../../lib/audio/sfx'
import { practicePrompt } from '../../lib/claude/prompt'
import { db } from '../../lib/db/db'
import { rng, shuffle } from '../../lib/intake/plan'
import { lastIntake } from '../../lib/intake/store'
import { evaluateAchievements } from '../../lib/progress/achievements'
import { addToday, recordAnswer } from '../../lib/progress/record'
import { signalFor } from '../../lib/progress/signal'
import { hash } from '../../lib/session/session'
import s from '../run/run.module.css'
import st from './story.module.css'

/** Чанки, которые сейчас учишь (последние в повторении), — для практики с Claude. */
async function learnedChunks(): Promise<string[]> {
  const ids = (await db.cards.where('kind').equals(1).toArray()).filter((c) => c.itemId.startsWith('c-')).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  const out = ids.slice(0, 6).map((c) => c.itemId)
  return out.length ? out : ['c-clarify-05', 'c-time-01', 'c-clarify-01']
}

/** Список эпизодов — в «Треках». */
export function EpisodeList() {
  const t = ru.episode
  const done = useLiveQuery(async () => new Map((await db.episodes.toArray()).map((e) => [e.id, e])), [])
  return (
    <section className={st.section}>
      <h2>{t.title}</h2>
      <p className={ui.note}>{t.subtitle}</p>
      <ul className={st.list}>
        {content.episodes.map((e) => (
          <li key={e.id}>
            <Link to={`/episode/${e.id}`} className={st.item} aria-label={`${t.ep(e.n)}: ${e.title}`}>
              <span className={st.itemMain}>
                <span className={st.itemQ}>
                  {t.ep(e.n)} · {e.title}
                </span>
                <span className={st.itemMeta}>{e.place}</span>
                <span className={`${st.itemMeta} mono`}>{done?.get(e.id) ? `✓ ${t.done}` : t.after(moduleById.get(e.after)?.title ?? '')}</span>
              </span>
              <span className={ui.link}>{done?.get(e.id) ? t.again : t.open}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className={ui.note}>{t.soon}</p>
    </section>
  )
}

export function EpisodeScreen() {
  const id = useParams().id ?? ''
  const e = episodeById.get(id)
  const [round, setRound] = useState(0)
  if (!e) return <Screen title={ru.run.notFound} back />
  return <EpisodePlay key={round} e={e} onAgain={() => setRound((n) => n + 1)} />
}

function EpisodePlay({ e, onAgain }: { e: Episode; onAgain: () => void }) {
  const t = ru.episode
  const navigate = useNavigate()
  const [i, setI] = useState(-1) // -1 — вступление
  const [picked, setPicked] = useState<number | null>(null)
  const [said, setSaid] = useState<VoiceResult | undefined>(undefined)
  const [showRu, setShowRu] = useState(false)
  const [score, setScore] = useState({ ok: 0, n: 0, spokenMs: 0 })
  const [started] = useState(() => Date.now())
  const [finished, setFinished] = useState(false)
  const line = e.lines[i]
  const people = [...new Set(e.lines.filter((l) => !isMyLine(l)).map((l) => l.speaker))].map((sp) => characterById.get(sp)!).filter(Boolean)
  const mine = line && isMyLine(line) ? line : null
  const theirs = line && !isMyLine(line) ? line : null
  const options = useMemo(() => (mine ? shuffle(mine.options.map((o, k) => ({ ...o, k })), rng(hash(`${e.id}:${i}`))) : []), [mine, e.id, i])

  useEffect(() => {
    setPicked(null)
    setSaid(undefined)
    if (theirs) void playText(theirs.text, { voice: theirs.voice }).catch(() => {})
    return () => stopAudio()
  }, [line])

  const finishing = useRef(false)
  const finish = async () => {
    if (finishing.current) return
    finishing.current = true
    const seconds = (Date.now() - started) / 1000
    const best = score.n ? score.ok / score.n : 1
    await db.transaction('rw', db.episodes, async () => {
      const cur = await db.episodes.get(e.id)
      await db.episodes.put({ id: e.id, completedAt: Date.now(), best: Math.max(best, cur?.best ?? 0), times: (cur?.times ?? 0) + 1 })
    })
    await addToday({ seconds, spokenMs: score.spokenMs, spoken: score.n, signal: signalFor({ seconds, correct: score.ok, wrong: score.n - score.ok, spokenMs: score.spokenMs, complete: true }) })
    await evaluateAchievements()
    sfx('combo')
    setFinished(true)
  }
  const next = () => (i + 1 < e.lines.length ? setI(i + 1) : void finish())

  const top = (
    <div className={s.top}>
      <button type="button" className={s.close} onClick={() => navigate('/more')} aria-label={ru.run.close}>
        <IconClose size={24} />
      </button>
      <StepTicks total={e.lines.length} done={Math.max(0, i)} label={t.ep(e.n)} />
    </div>
  )

  if (finished)
    return (
      <div className={s.runner}>
        <section className={s.body}>
          <Mascot mood="celebrate" size={104} />
          <h1>
            {t.ep(e.n)} · {e.title}
          </h1>
          <p className="mono">{t.score(score.ok, score.n)}</p>
          <div className={s.feedback} data-ok>
            <b>
              {t.culture}: {e.culture.title}
            </b>
            <p>{e.culture.text}</p>
          </div>
          <ClaudeButton
            label={t.practice}
            build={async () => {
              const intake = await lastIntake()
              const weak = intake ? Object.entries(intake.tracks).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([k]) => ru.tracks[k as keyof typeof ru.tracks].what) : []
              return practicePrompt({
                situation: `${e.title}. ${e.intro}`,
                role: people.map((c) => `${c.name} (${c.role})`).join(', '),
                level: intake?.cefr,
                weak,
                chunks: await learnedChunks(),
              })
            }}
          />
        </section>
        <div className={s.actions}>
          <button type="button" className={ui.signalButton} onClick={() => navigate('/more')}>
            {t.toTracks}
          </button>
          <button type="button" className={ui.secondary} onClick={onAgain}>
            {t.again}
          </button>
        </div>
      </div>
    )

  if (i < 0)
    return (
      <div className={s.runner}>
        {top}
        <section className={s.body}>
          <p className={`${s.kicker} mono`}>
            {t.ep(e.n)} · {e.place}
          </p>
          <h1>{e.title}</h1>
          <p className={s.lead}>{e.intro}</p>
          <h2 className={s.h2}>{t.characters}</h2>
          <div className={s.speakers}>
            {people.map((c) => (
              <span key={c.id} className={s.speaker}>
                <b>{c.name}</b> · {c.role}
              </span>
            ))}
          </div>
          <div className={s.actions}>
            <button type="button" className={ui.signalButton} onClick={() => setI(0)}>
              {t.next}
            </button>
          </div>
        </section>
      </div>
    )

  if (theirs) {
    const who = characterById.get(theirs.speaker)
    return (
      <div className={s.runner}>
        {top}
        <section className={s.body}>
          <p className={`${s.kicker} mono`}>{who?.name}</p>
          <div className={st.card}>
            <div className={ui.row} style={{ alignItems: 'center', flexWrap: 'nowrap' }}>
              <PlayButton text={theirs.text} voice={theirs.voice} label={theirs.text} size="s" />
              <span className={st.q} lang="en" style={{ flex: 1 }}>
                {theirs.text}
              </span>
            </div>
            {showRu && <p>{theirs.ru}</p>}
          </div>
          <button type="button" className={ui.link} onClick={() => setShowRu((v) => !v)}>
            {t.showRu}
          </button>
          <div className={s.actions}>
            <button type="button" className={ui.primary} onClick={next}>
              {t.next}
            </button>
          </div>
        </section>
      </div>
    )
  }

  const right = mine!.options[0]!
  const choice = picked === null ? null : options.find((o) => o.k === picked)!
  return (
    <div className={s.runner}>
      {top}
      <section className={s.body}>
        <p className={s.prompt}>{t.yourReply}</p>
        <div className={s.options} role="group" aria-label={t.yourReply}>
          {options.map((o) => (
            <button
              key={o.k}
              type="button"
              lang="en"
              className={s.option}
              data-choice
              disabled={picked !== null}
              data-state={picked === null ? undefined : o.k === 0 ? 'right' : o.k === picked ? 'wrong' : undefined}
              onClick={() => {
                setPicked(o.k)
                sfx(o.k === 0 ? 'correct' : 'wrong')
                setScore((x) => ({ ...x, ok: x.ok + (o.k === 0 ? 1 : 0), n: x.n + 1 }))
                void recordAnswer({ kind: 'episode', source: 'lesson', track: 'call', item: `${e.id}#${i}`, expected: right.text, given: o.text, correct: o.k === 0, tag: 'episode' })
              }}
            >
              {o.text}
            </button>
          ))}
        </div>
        {choice && (
          <>
            {choice.k === 0 ? (
              <PingSays mood="happy" size={52}>
                {t.right} {pick(ru.lines.correct)}
              </PingSays>
            ) : (
              <div className={s.feedback}>
                <p>{choice.why}</p>
                <p className={s.hint}>{t.rightWas}</p>
              </div>
            )}
            <div className={s.feedback} data-ok>
              <p className={s.phrase}>
                <PlayButton text={right.text} voice={defaultVoice()} label={right.text} size="s" /> <span lang="en">{right.text}</span>
              </p>
              <p className={s.ru}>{right.ru}</p>
            </div>
            {said === undefined ? (
              <VoiceAnswer maxSeconds={15} label={t.sayIt} onResult={(r) => {
                setSaid(r)
                setScore((x) => ({ ...x, spokenMs: x.spokenMs + (r && (r.recorded || r.recognized) ? r.speechMs : 3000) }))
              }} />
            ) : (
              <>
                <VoiceReport result={said} target={right.text} sample={{ text: right.text, voice: defaultVoice() }} />
                <div className={s.actions}>
                  <button type="button" className={ui.primary} onClick={next}>
                    {t.next}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}
