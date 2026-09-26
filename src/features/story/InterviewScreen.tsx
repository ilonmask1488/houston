/* Босс трека Позывной — пробное собеседование (ТЗ §6.1). Маршрут /interview. */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClaudeButton } from '../../components/ClaudeButton'
import { IconClose } from '../../components/Icons'
import { Readout } from '../../components/Instruments'
import { Mascot } from '../../components/Mascot'
import { PingSays, Segmented } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { VoiceAnswer, type VoiceResult } from '../../components/Voice'
import { characterById, content, storyQuestionById } from '../../content'
import type { VoiceId } from '../../content/types'
import { formatSeconds, pick, ru } from '../../i18n/ru'
import { player } from '../../lib/audio/player'
import { stopAudio } from '../../lib/audio/audio'
import { interviewPrompt } from '../../lib/claude/prompt'
import { db } from '../../lib/db/db'
import type { InterviewItem } from '../../lib/db/types'
import { rng, shuffle } from '../../lib/intake/plan'
import { lastIntake } from '../../lib/intake/store'
import { evaluateAchievements, type AchievementId } from '../../lib/progress/achievements'
import { addToday } from '../../lib/progress/record'
import { SIGNAL, signalFor } from '../../lib/progress/signal'
import { useSettings } from '../../lib/settings/settings'
import { readyStories } from '../../lib/story/store'
import s from '../run/run.module.css'
import st from './story.module.css'

type Q = { qid: string; q: string; voice: VoiceId }

/** Вопросы: сначала те, на которые ты написал ответы («о себе» — первым, «вопросы к нам» — последним), потом общие. */
export async function buildInterview(n: number, seed = Date.now()): Promise<Q[]> {
  const ready = new Set((await readyStories()).map((x) => x.id))
  const r = rng(seed)
  const own = shuffle(
    content.storyQuestions.filter((q) => ready.has(q.id) && q.id !== 'about' && q.id !== 'ask'),
    r,
  )
  const general = shuffle(
    content.questions.filter((q) => ['call-intro', 'call-project', 'call-explain', 'call-disagree'].includes(q.module)),
    r,
  )
  const out: Q[] = []
  const about = storyQuestionById.get('about')!
  out.push({ qid: 'about', q: about.q, voice: about.voice })
  for (const q of own) if (out.length < n - 1) out.push({ qid: q.id, q: q.q, voice: q.voice })
  for (const q of general) if (out.length < n - 1 && !out.some((x) => x.q === q.q)) out.push({ qid: q.id, q: q.q, voice: q.voice })
  const ask = storyQuestionById.get('ask')!
  out.push({ qid: 'ask', q: ask.q, voice: ask.voice })
  return out
}

export function InterviewScreen() {
  const t = ru.interview
  const navigate = useNavigate()
  const settings = useSettings()
  const [n, setN] = useState<5 | 7>(5)
  const [qs, setQs] = useState<Q[] | null>(null)
  const [i, setI] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [items, setItems] = useState<InterviewItem[]>([])
  const [urls, setUrls] = useState<(string | undefined)[]>([])
  const [finished, setFinished] = useState<{ fresh: AchievementId[]; seconds: number } | null>(null)
  const started = useRef(0)
  useEffect(
    () => () => {
      stopAudio()
      urls.forEach((u) => u && URL.revokeObjectURL(u))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const start = async () => {
    setQs(await buildInterview(n))
    started.current = Date.now()
  }

  const onResult = (r: VoiceResult) => {
    const q = qs![i]!
    setItems((xs) => [
      ...xs,
      {
        q: q.q,
        qid: q.qid,
        transcript: r?.transcript ?? '',
        latencyMs: r?.startMs,
        speechMs: r && (r.recorded || r.recognized) ? r.speechMs : undefined,
        longPauses: r?.longPauses,
        recorded: !!r && (r.recorded || r.recognized),
      },
    ])
    setUrls((u) => [...u, r?.url])
    setAnswered(true)
  }

  const next = async () => {
    if (i + 1 < qs!.length) {
      setI(i + 1)
      setAnswered(false)
      return
    }
    const seconds = (Date.now() - started.current) / 1000
    const spokenMs = items.reduce((sum, x) => sum + (x.speechMs ?? 25_000), 0)
    await db.interviews.add({ at: Date.now(), seconds, items })
    await addToday({ seconds, spokenMs, spoken: items.length, signal: signalFor({ seconds, correct: items.length, wrong: 0, spokenMs }) + SIGNAL.bossPassed })
    setFinished({ fresh: await evaluateAchievements(), seconds })
  }

  const exit = () => navigate('/story')
  const Top = (
    <div className={s.top}>
      <button type="button" className={s.close} onClick={exit} aria-label={ru.run.close}>
        <IconClose size={24} />
      </button>
      <span className={st.itemQ}>{t.title}</span>
    </div>
  )

  if (finished) return <InterviewSummary items={items} urls={urls} seconds={finished.seconds} fresh={finished.fresh} onAgain={() => location.reload()} onBack={exit} />

  if (!qs)
    return (
      <div className={s.runner}>
        {Top}
        <section className={s.body}>
          <Mascot mood="thinking" size={104} />
          <h1>{t.title}</h1>
          <p className={s.lead}>{t.intro}</p>
          <p className={s.hint}>{t.storiesHint}</p>
          <span className={s.prompt}>{t.count}</span>
          <Segmented
            label={t.count}
            value={n}
            options={[
              { value: 5, label: '5' },
              { value: 7, label: '7' },
            ]}
            onChange={setN}
          />
          <div className={s.actions}>
            <button type="button" className={ui.signalButton} onClick={() => void start()}>
              {t.start}
            </button>
          </div>
        </section>
      </div>
    )

  const q = qs[i]!
  const who = [...characterById.values()].find((c) => c.voice === q.voice)
  return (
    <div className={s.runner}>
      {Top}
      <section className={s.body}>
        <p className={`${s.kicker} mono`}>
          {t.question(i + 1, qs.length)} · {t.interviewer}: {who?.name ?? 'Mike Chen'}
        </p>
        <div className={s.question}>
          <p className={s.qText} lang="en">
            {q.q}
          </p>
        </div>
        {!answered ? (
          <VoiceAnswer key={i} timed={settings.answerSeconds} maxSeconds={120} autoStart prompt={{ text: q.q, voice: q.voice }} onResult={onResult} />
        ) : (
          <>
            <p className={s.hint}>{t.recorded}</p>
            <div className={s.actions}>
              <button type="button" className={ui.primary} onClick={() => void next()}>
                {i + 1 < qs.length ? t.next : t.finish}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function InterviewSummary({ items, urls, seconds, fresh, onAgain, onBack }: { items: InterviewItem[]; urls: (string | undefined)[]; seconds: number; fresh: AchievementId[]; onAgain: () => void; onBack: () => void }) {
  const t = ru.interview
  const lat = items.filter((x) => x.latencyMs !== undefined).map((x) => x.latencyMs!)
  const avg = lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : null
  const speech = items.reduce((a, x) => a + (x.speechMs ?? 0), 0)
  const pauses = items.reduce((a, x) => a + (x.longPauses ?? 0), 0)
  const [line] = useState(() => pick(ru.lines.summaryHigh))
  return (
    <div className={s.runner}>
      <section className={s.body}>
        <Mascot mood="celebrate" size={104} />
        <h1>{t.summary}</h1>
        <PingSays mood="wink" size={48}>
          {line}
        </PingSays>
        <div className={s.stats}>
          <Readout label={t.avgLatency} value={avg === null ? '—' : `${(avg / 1000).toFixed(1)} с`} />
          <Readout label={t.totalSpeech} value={formatSeconds(speech / 1000)} />
          <Readout label={t.pauses} value={pauses} />
          <Readout label={ru.run.summary.time} value={formatSeconds(seconds)} />
        </div>
        {fresh.map((id) => (
          <div key={id} className={s.badge} role="status">
            <span className={s.statLabel}>{ru.run.summary.achievement}</span>
            <b>{ru.achievements.list[id]?.name}</b>
          </div>
        ))}
        <h2 className={st.h2}>{t.transcript}</h2>
        <ol className={st.transcript}>
          {items.map((x, k) => (
            <li key={k}>
              <b lang="en">{x.q}</b>
              <span className={st.said} lang="en">
                {x.transcript || (x.recorded ? t.noAsr : t.noRec)}
              </span>
              {urls[k] && (
                <button type="button" className={ui.link} onClick={() => void player.play(urls[k]!).catch(() => {})}>
                  {t.playMine}
                </button>
              )}
            </li>
          ))}
        </ol>
        <ClaudeButton label={t.claude} build={async () => interviewPrompt({ items, level: (await lastIntake())?.cefr })} />
      </section>
      <div className={s.actions}>
        <button type="button" className={ui.signalButton} onClick={onAgain}>
          {t.again}
        </button>
        <button type="button" className={ui.secondary} onClick={onBack}>
          {t.toStory}
        </button>
      </div>
    </div>
  )
}
