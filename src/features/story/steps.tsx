/*
  Шаги тренировки своего ответа (ТЗ §6.1): озвучка → шэдоуинг → по опорным словам → без подсказок.
  Свой текст озвучивает синтез браузера: заранее его не сгенерировать.
*/
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PingSays } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { VoiceAnswer, VoiceReport, type VoiceResult } from '../../components/Voice'
import { storyQuestionById } from '../../content'
import { ru } from '../../i18n/ru'
import { stopAudio, wait } from '../../lib/audio/audio'
import { hasEnglishVoice, speakEnglish, stopSpeaking } from '../../lib/audio/speech'
import { db } from '../../lib/db/db'
import type { Step } from '../../lib/run/steps'
import { useSettings } from '../../lib/settings/settings'
import { bestAlternative } from '../../lib/speech/recognize'
import { keyLines, speakingSeconds, splitSentences } from '../../lib/story/text'
import type { StepProps } from '../run/result'
import s from '../run/run.module.css'
import st from './story.module.css'

type S<K extends Step['kind']> = Extract<Step, { kind: K }>

function useStoryText(id: string): string | undefined {
  return useLiveQuery(async () => (await db.stories.get(id))?.text ?? '', [id])
}

function useSpeakOpts() {
  const settings = useSettings()
  return { lang: settings.variant === 'gb' ? 'en-GB' : 'en-US', gender: settings.voice }
}

function useHasVoice(): boolean | null {
  const [v, setV] = useState<boolean | null>(null)
  useEffect(() => {
    void hasEnglishVoice().then(setV)
  }, [])
  return v
}

function Head({ story, title }: { story: string; title: string }) {
  const q = storyQuestionById.get(story)
  return (
    <>
      <p className={`${s.kicker} mono`}>{title}</p>
      <p className={st.q} lang="en">
        {q?.q}
      </p>
    </>
  )
}

/* ——— Послушать свой ответ ——— */

export function StoryListenStep({ step, onDone }: StepProps<S<'storyListen'>>) {
  const t = ru.story.training
  const text = useStoryText(step.story)
  const opts = useSpeakOpts()
  const voice = useHasVoice()
  const sentences = useMemo(() => splitSentences(text ?? ''), [text])
  const [at, setAt] = useState(-1)
  const token = useRef(0)
  useEffect(() => () => {
    token.current++
    stopSpeaking()
  }, [])
  const play = async () => {
    const my = ++token.current
    for (let i = 0; i < sentences.length; i++) {
      if (my !== token.current) return
      setAt(i)
      await speakEnglish(sentences[i]!, opts).catch(() => {})
    }
    if (my === token.current) setAt(-1)
  }
  return (
    <section className={s.body}>
      <Head story={step.story} title={t.listen} />
      <p className={st.text} lang="en">
        {sentences.map((x, i) => (
          <span key={i} data-on={i === at || undefined}>
            {x}{' '}
          </span>
        ))}
      </p>
      {voice === false ? (
        <p className={s.hint}>{t.noVoice}</p>
      ) : (
        <>
          <button type="button" className={ui.signalButton} disabled={at >= 0} onClick={() => void play()}>
            {t.listenPlay}
          </button>
          <p className={s.hint}>{t.listenNote}</p>
        </>
      )}
      <div className={s.actions}>
        <button type="button" className={ui.primary} onClick={() => (token.current++, stopSpeaking(), onDone({}))}>
          {ru.run.next}
        </button>
      </div>
    </section>
  )
}

/* ——— Шэдоуинг: фраза → пауза «твоя очередь» ——— */

export function StoryShadowStep({ step, onDone }: StepProps<S<'storyShadow'>>) {
  const t = ru.story.training
  const text = useStoryText(step.story)
  const opts = useSpeakOpts()
  const voice = useHasVoice()
  const sentences = useMemo(() => splitSentences(text ?? ''), [text])
  const [at, setAt] = useState(-1)
  const [turn, setTurn] = useState(false)
  const [played, setPlayed] = useState(false)
  const token = useRef(0)
  useEffect(() => () => {
    token.current++
    stopSpeaking()
  }, [])
  const play = async () => {
    const my = ++token.current
    setPlayed(true)
    for (let i = 0; i < sentences.length; i++) {
      if (my !== token.current) return
      setAt(i)
      setTurn(false)
      const started = Date.now()
      await speakEnglish(sentences[i]!, opts).catch(() => {})
      const dur = Math.max(1200, Date.now() - started, speakingSeconds(sentences[i]!, 150) * 1000)
      if (my !== token.current) return
      setTurn(true)
      await wait(dur * 1.2)
    }
    if (my === token.current) {
      setAt(-1)
      setTurn(false)
    }
  }
  const spokenMs = sentences.reduce((sum, x) => sum + speakingSeconds(x, 150) * 1000, 0)
  return (
    <section className={s.body}>
      <Head story={step.story} title={t.shadow} />
      <p className={s.hint}>{t.shadowHint}</p>
      <div className={st.shadow}>
        {at >= 0 ? (
          <>
            <p className={`${st.turn} mono`} data-on={turn || undefined}>
              {turn ? t.yourTurn : `${at + 1} / ${sentences.length}`}
            </p>
            <p className={st.sentence} lang="en">
              {sentences[at]}
            </p>
          </>
        ) : (
          <p className={s.hint}>{played ? '✓' : ''}</p>
        )}
      </div>
      {voice === false ? (
        <p className={s.hint}>{t.noVoice}</p>
      ) : (
        <button type="button" className={ui.signalButton} disabled={at >= 0} onClick={() => void play()}>
          {t.shadowPlay}
        </button>
      )}
      <div className={s.actions}>
        <button type="button" className={ui.primary} onClick={() => (token.current++, stopSpeaking(), onDone({ spokenMs: played ? spokenMs : undefined }))}>
          {ru.run.next}
        </button>
      </div>
    </section>
  )
}

/* ——— По опорным словам ——— */

export function StoryKeysStep({ step, onDone }: StepProps<S<'storyKeys'>>) {
  const t = ru.story.training
  const text = useStoryText(step.story) ?? ''
  const lines = useMemo(() => keyLines(text), [text])
  const [result, setResult] = useState<VoiceResult | undefined>(undefined)
  const [show, setShow] = useState(false)
  const cover = result && result.alts.length ? bestAlternative(text, result.alts) : null
  return (
    <section className={s.body}>
      <Head story={step.story} title={t.keys} />
      <p className={s.hint}>{t.keysHint}</p>
      <ol className={st.keys} lang="en">
        {lines.map((l, i) => (
          <li key={i}>{l.join(' · ') || '…'}</li>
        ))}
      </ol>
      {result === undefined ? (
        <VoiceAnswer maxSeconds={150} onResult={(r) => (stopAudio(), setResult(r))} />
      ) : (
        <>
          <VoiceReport result={result} />
          {cover && <p className="mono">{t.coverage(Math.round((100 * cover.match.ok) / Math.max(1, cover.match.total)))}</p>}
          <button type="button" className={ui.link} onClick={() => setShow((v) => !v)}>
            {t.showText}
          </button>
          {show && (
            <p className={st.text} lang="en">
              {text}
            </p>
          )}
          <div className={s.actions}>
            <button
              type="button"
              className={ui.primary}
              onClick={() =>
                onDone({
                  spokenMs: result && (result.recorded || result.recognized) ? result.speechMs : speakingSeconds(text) * 1000,
                  answer: { kind: 'story-keys', track: 'call', item: step.story, expected: '', given: result?.transcript ?? '', correct: true, speechMs: result?.speechMs, tag: 'story' },
                })
              }
            >
              {ru.run.next}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

/* ——— Без подсказок: вопрос → таймер → ответ ——— */

export function StoryColdStep({ step, onDone }: StepProps<S<'storyCold'>>) {
  const t = ru.story.training
  const settings = useSettings()
  const q = storyQuestionById.get(step.story)
  const text = useStoryText(step.story) ?? ''
  const [result, setResult] = useState<VoiceResult | undefined>(undefined)
  const [line] = useState(() => ru.lines.summaryHigh[Math.floor(Math.random() * ru.lines.summaryHigh.length)]!)
  return (
    <section className={s.body}>
      <p className={`${s.kicker} mono`}>{t.cold}</p>
      <div className={s.question}>
        <p className={s.qText} lang="en">
          {q?.q}
        </p>
      </div>
      {result === undefined ? (
        <>
          <p className={s.hint}>{t.coldHint(settings.answerSeconds)}</p>
          <VoiceAnswer timed={settings.answerSeconds} maxSeconds={150} prompt={q ? { text: q.q, voice: q.voice } : undefined} label={ru.intake.listenPlay} onResult={setResult} />
        </>
      ) : (
        <>
          <VoiceReport result={result} target={text} />
          {result?.onTime && <PingSays mood="celebrate" size={52}>{line}</PingSays>}
          <div className={s.actions}>
            <button
              type="button"
              className={ui.primary}
              onClick={() =>
                onDone({
                  onTime: result?.onTime,
                  spokenMs: result && (result.recorded || result.recognized) ? result.speechMs : speakingSeconds(text) * 1000,
                  answer: { kind: 'story', track: 'call', item: step.story, expected: '', given: result?.transcript ?? '', correct: !!result?.onTime, latencyMs: result?.startMs, speechMs: result?.speechMs, tag: 'story' },
                })
              }
            >
              {ru.run.next}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
