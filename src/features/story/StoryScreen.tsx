/* «Мой рассказ»: вопросы собеседования, редактор своего ответа, тренировка, 4/3/2. */
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ClaudeButton } from '../../components/ClaudeButton'
import { IconChevron } from '../../components/Icons'
import { ScoreBar } from '../../components/Instruments'
import { Term } from '../../components/Sheet'
import { PlayButton } from '../../components/Play'
import { ConfirmDialog, Placeholder, Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { VoiceAnswer, type VoiceResult } from '../../components/Voice'
import { chunkById, content, storyQuestionById } from '../../content'
import { formatDate, ru } from '../../i18n/ru'
import { defaultVoice } from '../../lib/audio/audio'
import { editStoryPrompt } from '../../lib/claude/prompt'
import { db } from '../../lib/db/db'
import { lastIntake } from '../../lib/intake/store'
import { addToday, recordAnswer } from '../../lib/progress/record'
import { evaluateAchievements } from '../../lib/progress/achievements'
import { signalFor } from '../../lib/progress/signal'
import { storyTraining } from '../../lib/run/steps'
import { countWords } from '../../lib/speech/recognize'
import { deleteStory, markTrained, MIN_WORDS, saveStory } from '../../lib/story/store'
import { hasCyrillic, speakingSeconds, wordCount } from '../../lib/story/text'
import { Runner } from '../run/Runner'
import st from './story.module.css'

/**
  «Собеседование» (UX §5): как это работает (свёрнуто), готовность ответов, «Начни с этого» у первого вопроса,
  статусы «не написан → написан → отрепетирован ✓», STAR объясняется тапом. Пробное собеседование — наверху.
*/
export function StoryScreen() {
  const t = ru.story
  const stories = useLiveQuery(async () => new Map((await db.stories.toArray()).map((x) => [x.id, x])), [])
  const lastInterview = useLiveQuery(() => db.interviews.orderBy('at').last(), [])
  const total = content.storyQuestions.length
  const written = content.storyQuestions.filter((q) => (stories?.get(q.id) ? wordCount(stories.get(q.id)!.text) >= MIN_WORDS : false)).length
  const first = content.storyQuestions.find((q) => !stories?.get(q.id) || wordCount(stories.get(q.id)!.text) < MIN_WORDS)
  return (
    <Screen title={t.title} subtitle={t.subtitle}>
      <details className={st.how} open={written === 0 || undefined}>
        <summary>{t.howTitle}</summary>
        <ol>
          {t.howSteps.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ol>
      </details>
      <Link to="/interview" className={`${st.card} ${st.item}`} style={{ textDecoration: 'none' }}>
        <span className={st.itemMain}>
          <span className={st.itemQ}>{t.interview}</span>
          <span className={st.itemMeta}>{t.interviewWhat}</span>
          {written < 3 && <span className={st.itemMeta}>{t.interviewHint}</span>}
          {lastInterview && <span className={`${st.itemMeta} mono`}>{t.lastInterview(formatDate(lastInterview.at))}</span>}
        </span>
        <IconChevron />
      </Link>
      <section className={st.section}>
        <h2 className={st.h2}>{t.questions}</h2>
        <p className={`${st.itemMeta} mono`}>{t.ready(written, total)}</p>
        <ScoreBar value={(100 * written) / total} label={t.ready(written, total)} />
        <ul className={st.list}>
          {content.storyQuestions.map((q) => {
            const row = stories?.get(q.id)
            const words = row ? wordCount(row.text) : 0
            const status = words < MIN_WORDS ? 'empty' : row!.trained > 0 ? 'trained' : 'written'
            return (
              <li key={q.id} className={st.row}>
                <Link to={`/story/${q.id}`} className={st.item} data-start={q.id === first?.id || undefined}>
                  <span className={st.itemMain}>
                    <span className={st.itemQ} lang="en">
                      {q.q}
                    </span>
                    <span className={st.itemMeta}>{q.ru}</span>
                    <span className={`${st.itemMeta} mono`} data-status={status}>
                      {q.id === first?.id && <span className={st.startTag}>{t.startHere}</span>}
                      {t.statuses[status]}
                      {words > 0 && ` · ${t.status(words, speakingSeconds(row!.text), row!.trained)}`}
                    </span>
                  </span>
                  <IconChevron />
                </Link>
                {q.star && (
                  <Term k="star" className={st.badge}>
                    {t.star}
                  </Term>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </Screen>
  )
}

export function StoryEditor() {
  const t = ru.story
  const id = useParams().id ?? ''
  const navigate = useNavigate()
  const q = storyQuestionById.get(id)
  const row = useLiveQuery(() => db.stories.get(id), [id])
  const [text, setText] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    if (row !== undefined && text === null) setText(row?.text ?? '')
  }, [row, text])
  useEffect(() => () => clearTimeout(timer.current), [])
  if (!q)
    return (
      <Screen title={t.title} back>
        <Placeholder text={t.notFound} />
      </Screen>
    )
  const value = text ?? ''
  const change = (v: string) => {
    setText(v)
    setSaved(false)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void saveStory(id, v).then(() => setSaved(true)), 600)
  }
  const insert = (chunk: string) => {
    const el = ref.current
    const pos = el ? el.selectionStart : value.length
    const next = `${value.slice(0, pos)}${pos && !/\s$/.test(value.slice(0, pos)) ? ' ' : ''}${chunk} ${value.slice(pos)}`
    change(next)
  }
  const words = wordCount(value)
  const voice = defaultVoice()
  return (
    <Screen title={t.title} back>
      <div className={st.card}>
        <div className={ui.row} style={{ alignItems: 'center', flexWrap: 'nowrap' }}>
          <PlayButton text={q.q} voice={q.voice} label={q.q} size="s" />
          <span className={st.q} lang="en" style={{ flex: 1 }}>
            {q.q}
          </span>
        </div>
        <p>{q.ru}</p>
      </div>
      <section className={st.section}>
        <h2 className={st.h2}>{t.tip}</h2>
        <p className={ui.note}>{q.tip}</p>
        <details className={st.example}>
          <summary>{t.example}</summary>
          <p className={ui.note}>{t.exampleNote}</p>
          <p lang="en" style={{ marginTop: 8 }}>
            <PlayButton text={q.example} voice="gb-f" label={t.example} size="s" /> {q.example}
          </p>
        </details>
        {q.chunks.length > 0 && (
          <>
            <h3 className={st.h2}>{t.chunks}</h3>
            <ul className={st.chunkList}>
              {q.chunks.map((cid) => {
                const c = chunkById.get(cid)
                return c ? (
                  <li key={cid}>
                    <span>
                      <PlayButton text={c.en} voice={voice} label={c.en} size="s" /> <span lang="en">{c.en}</span>
                    </span>
                    <button type="button" className={ui.link} onClick={() => insert(c.en.replace(/[.?!]$/, ''))}>
                      {t.insert}
                    </button>
                  </li>
                ) : null
              })}
            </ul>
          </>
        )}
      </section>
      <section className={st.section}>
        <label htmlFor="story-text" className={st.h2} style={{ fontWeight: 600 }}>
          {t.answer}
        </label>
        <textarea
          id="story-text"
          ref={ref}
          className={st.editor}
          lang="en"
          value={value}
          placeholder={q.star ? t.placeholderStar : t.placeholder}
          spellCheck
          onChange={(e) => change(e.target.value)}
        />
        <div className={st.meta}>
          <span className="mono">{t.counters(words, speakingSeconds(value))}</span>
          <span aria-live="polite">{saved ? t.saved : ''}</span>
        </div>
        {hasCyrillic(value) && <p className={st.warn}>{t.cyrillic}</p>}
      </section>
      <div className={st.actions}>
        {words < MIN_WORDS && <p className={ui.note}>{t.tooShort}</p>}
        <button type="button" className={ui.signalButton} disabled={words < MIN_WORDS} onClick={() => void saveStory(id, value).then(() => navigate(`/story/${id}/train`))}>
          {t.train}
        </button>
        <button type="button" className={ui.secondary} disabled={words < 40} onClick={() => void saveStory(id, value).then(() => navigate(`/story/${id}/432`))}>
          {t.fluency}
        </button>
        <ClaudeButton
          label={t.claude}
          build={async () => editStoryPrompt({ question: q.q, answer: value, level: (await lastIntake())?.cefr, star: q.star })}
        />
        {row && (
          <button type="button" className={ui.danger} onClick={() => setConfirm(true)}>
            {t.remove}
          </button>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title={t.removeTitle}
        confirm={t.removeConfirm}
        cancel={t.cancel}
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false)
          void deleteStory(id).then(() => {
            setText('')
            navigate('/story')
          })
        }}
      >
        {t.removeText}
      </ConfirmDialog>
    </Screen>
  )
}

export function StoryTrain() {
  const id = useParams().id ?? ''
  const navigate = useNavigate()
  const [round, setRound] = useState(0)
  if (!storyQuestionById.has(id)) return <Screen title={ru.story.notFound} back />
  return (
    <Runner
      key={round}
      steps={storyTraining(id)}
      source="drill"
      onExit={() => navigate(`/story/${id}`)}
      onFinish={() => markTrained(id)}
      actions={() => (
        <>
          <button type="button" className={ui.signalButton} onClick={() => setRound((n) => n + 1)}>
            {ru.run.summary.again}
          </button>
          <button type="button" className={ui.secondary} onClick={() => navigate('/story')}>
            {ru.interview.toStory}
          </button>
        </>
      )}
    />
  )
}

/* ——— 4/3/2 ——— */

const LIMITS = [4, 3, 2]
type RoundStat = { speechMs: number; pauses: number; words: number | null; seconds: number }

export function Fluency432() {
  const t = ru.story.f432
  const id = useParams().id ?? ''
  const navigate = useNavigate()
  const q = storyQuestionById.get(id)
  const [round, setRound] = useState(0)
  const [started, setStarted] = useState(false)
  const [left, setLeft] = useState(LIMITS[0]! * 60)
  const [stats, setStats] = useState<RoundStat[]>([])
  const t0 = useRef(0)
  useEffect(() => {
    if (!started) return
    t0.current = Date.now()
    const timer = setInterval(() => setLeft(Math.max(0, LIMITS[round]! * 60 - Math.round((Date.now() - t0.current) / 1000))), 500)
    return () => clearInterval(timer)
  }, [started, round])
  if (!q) return <Screen title={ru.story.notFound} back />
  const done = stats.length === 3
  const onResult = (r: VoiceResult) => {
    const seconds = (Date.now() - t0.current) / 1000
    const measured = !!r && (r.recorded || r.recognized)
    const stat: RoundStat = { speechMs: measured ? r!.speechMs : seconds * 1000 * 0.8, pauses: r?.longPauses ?? 0, words: r?.transcript ? countWords(r.transcript) : null, seconds }
    const next = [...stats, stat]
    setStats(next)
    setStarted(false)
    void recordAnswer({ kind: '432', source: 'drill', track: 'call', item: id, expected: String(LIMITS[round]), given: r?.transcript ?? '', correct: true, speechMs: stat.speechMs, tag: 'fluency' })
    if (next.length < 3) {
      setRound(round + 1)
      setLeft(LIMITS[round + 1]! * 60)
    } else {
      const spokenMs = next.reduce((s, x) => s + x.speechMs, 0)
      void addToday({ seconds: next.reduce((s, x) => s + x.seconds, 0), spokenMs, spoken: 3, signal: signalFor({ seconds: 0, correct: 3, wrong: 0, spokenMs, complete: true }) }).then(() => evaluateAchievements())
    }
  }
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const wpm = (x: RoundStat) => (x.words !== null && x.speechMs > 0 ? Math.round(x.words / (x.speechMs / 60000)) : null)
  const better = done && (wpm(stats[2]!) ?? 0) >= (wpm(stats[0]!) ?? 0) && stats[2]!.pauses <= stats[0]!.pauses
  return (
    <Screen title={t.title} back subtitle={t.what}>
      <p className={st.q} lang="en">
        {q.q}
      </p>
      {!done && (
        <section className={st.section}>
          <p className="mono">{t.round(round + 1, LIMITS[round]!)}</p>
          <p className={st.timer} aria-live="off">
            {mmss(started ? left : LIMITS[round]! * 60)}
          </p>
          {!started ? (
            <button type="button" className={ui.signalButton} onClick={() => setStarted(true)}>
              {t.start(LIMITS[round]!)}
            </button>
          ) : (
            <VoiceAnswer key={round} autoStart maxSeconds={LIMITS[round]! * 60} onResult={onResult} />
          )}
        </section>
      )}
      {stats.length > 0 && (
        <section className={st.section}>
          <h2 className={st.h2}>{t.result}</h2>
          <table className={st.rounds}>
            <thead>
              <tr>
                <th />
                <th>{t.speech}</th>
                <th>{t.pauses}</th>
                <th>{t.wpm}</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((x, i) => (
                <tr key={i} className="mono">
                  <td>{LIMITS[i]} мин</td>
                  <td>{Math.round(x.speechMs / 1000)} с</td>
                  <td>{x.pauses}</td>
                  <td>{wpm(x) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {done && <p className={ui.note}>{better ? t.better : t.same}</p>}
          {done && (
            <button type="button" className={ui.secondary} onClick={() => navigate(`/story/${id}`)}>
              {ru.interview.toStory}
            </button>
          )}
        </section>
      )}
    </Screen>
  )
}
