/*
  Вводный тест (ТЗ §5): словарь → на слух → близнецы → чтение → вслух → профиль.
  После каждого ответа черновик сохраняется в базу: можно выйти и продолжить.
*/
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconClose, IconMic } from '../../components/Icons'
import { LevelMeter, SpeedScale, StepTicks } from '../../components/Instruments'
import { PlayButton } from '../../components/Play'
import { PingSays } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { content } from '../../content'
import { accentOf, type BandId, type IntakeReading } from '../../content/types'
import { pick, ru } from '../../i18n/ru'
import { playText, stopAudio } from '../../lib/audio/audio'
import { captureSupported, startCapture, type Capture, type CaptureResult } from '../../lib/audio/capture'
import { player } from '../../lib/audio/player'
import { RecorderError } from '../../lib/audio/recorder'
import { sfx } from '../../lib/audio/sfx'
import { db } from '../../lib/db/db'
import { newDraft, rng, shouldVerify, shuffle, translationOptions } from '../../lib/intake/plan'
import { bandRates, continueAfterBand, needsHarderText, nextSpeed, SPEEDS, type IntakeDraft, type Speed } from '../../lib/intake/score'
import { dropDraft, finishIntake, loadDraft, saveDraft } from '../../lib/intake/store'
import { useSettings } from '../../lib/settings/settings'
import { countWords } from '../../lib/speech/recognize'
import s from './intake.module.css'

const BLOCKS = ['vocab', 'listening', 'pairs', 'reading', 'speaking'] as const

export function IntakeScreen() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<IntakeDraft | null>(null)
  const [resume, setResume] = useState<IntakeDraft | null>(null)
  const [finishing, setFinishing] = useState(false)

  useEffect(() => {
    void loadDraft().then((d) => {
      if (d && d.step !== 'intro') setResume(d)
      else setDraft(d ?? newDraft(content.intake))
    })
    return () => stopAudio()
  }, [])

  const update = useCallback((fn: (d: IntakeDraft) => IntakeDraft) => {
    setDraft((cur) => {
      if (!cur) return cur
      const next = fn(structuredClone(cur))
      void saveDraft(next)
      return next
    })
  }, [])

  useEffect(() => {
    if (draft?.step !== 'done' || finishing) return
    setFinishing(true)
    void finishIntake(draft).then(() => navigate('/profile?fresh=1', { replace: true }))
  }, [draft, finishing, navigate])

  if (resume)
    return (
      <main className={s.screen}>
        <PingSays mood="thinking">{ru.intake.resumeTitle}</PingSays>
        <div className={s.actions}>
          <button type="button" className={ui.signalButton} onClick={() => (setDraft(resume), setResume(null))}>
            {ru.intake.continue}
          </button>
          <button
            type="button"
            className={ui.secondary}
            onClick={() => {
              void dropDraft()
              setDraft(newDraft(content.intake))
              setResume(null)
            }}
          >
            {ru.intake.restart}
          </button>
        </div>
      </main>
    )
  if (!draft) return <main className={s.screen} />

  const blockIndex = BLOCKS.indexOf(draft.step as (typeof BLOCKS)[number])
  return (
    <main className={s.screen}>
      <header className={s.top}>
        <button type="button" className={s.close} aria-label={ru.intake.close} title={ru.intake.closeHint} onClick={() => navigate('/')}>
          <IconClose />
        </button>
        <div className={s.topMain}>
          <span className={s.stepName}>{blockIndex >= 0 ? ru.intake.steps[draft.step] : ru.intake.title}</span>
          <StepTicks total={BLOCKS.length} done={Math.max(0, blockIndex)} label={ru.intake.title} />
        </div>
      </header>
      {draft.step === 'intro' && <Intro onStart={() => update((d) => ({ ...d, step: 'vocab' }))} />}
      {draft.step === 'vocab' && <VocabStep draft={draft} update={update} />}
      {draft.step === 'listening' && <ListeningStep draft={draft} update={update} />}
      {draft.step === 'pairs' && <PairsStep draft={draft} update={update} />}
      {draft.step === 'reading' && <ReadingStep draft={draft} update={update} />}
      {draft.step === 'speaking' && <SpeakingStep draft={draft} update={update} />}
      {draft.step === 'done' && <PingSays mood="celebrate">{ru.lines.intake.done}</PingSays>}
    </main>
  )
}

type StepProps = { draft: IntakeDraft; update: (fn: (d: IntakeDraft) => IntakeDraft) => void }

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <section className={s.body}>
      <h1>{ru.intake.title}</h1>
      <PingSays mood="wink" size={88}>
        {ru.home.intakeText}
      </PingSays>
      <ol className={s.plan}>
        {ru.home.intakeParts.map((p) => (
          <li key={p} className="mono">
            {p}
          </li>
        ))}
      </ol>
      <div className={s.actions}>
        <button type="button" className={ui.signalButton} onClick={onStart}>
          {ru.intake.start}
        </button>
      </div>
    </section>
  )
}

/* ——— Словарь ——— */

function VocabStep({ draft, update }: StepProps) {
  const c = content.intake
  const i = draft.vocab.length
  const item = draft.vocabPlan[i]
  const [verify, setVerify] = useState<{ options: string[]; answer: number } | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const random = useMemo(() => rng(draft.startedAt + i), [draft.startedAt, i])

  useEffect(() => {
    if (!item) update((d) => ({ ...d, step: 'listening' }))
  }, [item, update])
  if (!item) return null

  const answer = (yes: boolean, verified?: boolean) => {
    update((d) => {
      d.vocab.push({ w: item.w, band: item.band, yes, verified })
      // Конец полосы — решаем, идти ли дальше.
      const next = d.vocabPlan[d.vocab.length]
      if (!next || next.after !== item.after) {
        const bands = c.bands
        const idx = bands.findIndex((b) => b.id === item.after)
        const r = bandRates(d.vocab, bands).bands.find((b) => b.band === item.after)!
        if (next && !continueAfterBand(r, idx)) {
          const skipped = bands.slice(idx + 1).map((b) => b.id)
          d.skipped = skipped
          d.vocabPlan = d.vocabPlan.filter((p, k) => k < d.vocab.length || !skipped.includes(p.after as BandId))
        }
      }
      return d
    })
    setVerify(null)
    setPicked(null)
  }

  const onKnow = () => {
    if (item.band !== 'pseudo' && shouldVerify(draft, item.band)) {
      setVerify(translationOptions(c, item.w, random))
      return
    }
    answer(true)
  }

  const total = draft.vocabPlan.length
  return (
    <section className={s.body}>
      {i === 0 && <PingSays mood="wink">{ru.lines.intake.vocab}</PingSays>}
      <p className={`${s.counter} mono`}>{ru.intake.wordOf(i + 1, total)}</p>
      <p className={s.word} lang="en">
        {item.w}
      </p>
      {!verify ? (
        <div className={s.pair}>
          <button type="button" className={ui.secondary} onClick={() => answer(false)}>
            {ru.intake.dontKnow}
          </button>
          <button type="button" className={ui.primary} onClick={onKnow}>
            {ru.intake.know}
          </button>
        </div>
      ) : (
        <div className={s.options} role="group" aria-label={ru.intake.verify(item.w)}>
          <p className={s.prompt}>{ru.intake.verify(item.w)}</p>
          {verify.options.map((o, k) => (
            <button
              key={o}
              type="button"
              className={s.option}
              data-state={picked === null ? undefined : k === verify.answer ? 'right' : k === picked ? 'wrong' : undefined}
              disabled={picked !== null}
              onClick={() => {
                setPicked(k)
                sfx(k === verify.answer ? 'correct' : 'wrong')
                setTimeout(() => answer(true, k === verify.answer), 700)
              }}
            >
              {o}
            </button>
          ))}
          <button type="button" className={ui.link} disabled={picked !== null} onClick={() => answer(true, false)}>
            {ru.intake.notSure}
          </button>
        </div>
      )}
    </section>
  )
}

/* ——— На слух: лестница скоростей ——— */

function ListeningStep({ draft, update }: StepProps) {
  const items = content.intake.listening
  const i = draft.listening.length
  const item = items[i]
  const last = draft.listening[i - 1]
  const speed: Speed = last ? nextSpeed(last.speed, last.correct) : 0.75
  const [plays, setPlays] = useState(0)
  const [given, setGiven] = useState<number | null>(null)
  const [line, setLine] = useState('')
  const options = useMemo(() => (item ? shuffle(item.options, rng(draft.startedAt + i * 7)) : []), [item, draft.startedAt, i])

  useEffect(() => {
    if (!item) update((d) => ({ ...d, step: 'pairs' }))
  }, [item, update])
  if (!item) return null
  const audio = item.say ?? item.text
  const correctIdx = options.indexOf(item.options[0]!)

  const play = () => {
    setPlays((n) => n + 1)
    void playText(audio, { voice: item.voice, rate: speed }).catch(() => {})
  }
  const choose = (k: number) => {
    setGiven(k)
    const ok = k === correctIdx
    sfx(ok ? 'correct' : 'wrong')
    setLine(pick(ok ? ru.lines.correct : ru.lines.wrong))
  }
  const next = () => {
    const ok = given === correctIdx
    update((d) => {
      d.listening.push({ id: item.id, speed, accent: accentOf(item.voice), tag: item.tag, correct: ok })
      return d
    })
    setPlays(0)
    setGiven(null)
  }

  return (
    <section className={s.body}>
      {i === 0 && plays === 0 && <PingSays mood="happy">{ru.lines.intake.listening}</PingSays>}
      <div className={s.listenHead}>
        <span className={`${s.counter} mono`}>
          {i + 1} / {items.length} · {ru.intake.accentNames[accentOf(item.voice)]}
        </span>
        <SpeedScale speeds={SPEEDS} current={speed} label={ru.intake.speed(speed)} />
      </div>
      <div className={s.center}>
        {plays === 0 ? (
          <button type="button" className={ui.signalButton} onClick={play}>
            {ru.intake.listenPlay} · {ru.intake.speed(speed)}
          </button>
        ) : (
          // Переслушать до ответа можно один раз (кнопка ниже); после ответа — сколько угодно.
          given !== null && <PlayButton text={audio} voice={item.voice} rate={speed} label={ru.intake.listenPlay} size="l" />
        )}
      </div>
      {plays > 0 && (
        <div className={s.options} role="group" aria-label={ru.intake.listenPrompt}>
          <p className={s.prompt}>{ru.intake.listenPrompt}</p>
          {options.map((o, k) => (
            <button
              key={o}
              type="button"
              lang="en"
              className={s.option}
              disabled={given !== null}
              data-state={given === null ? undefined : k === correctIdx ? 'right' : k === given ? 'wrong' : undefined}
              onClick={() => choose(k)}
            >
              {o}
            </button>
          ))}
          <button type="button" className={s.option} data-quiet disabled={given !== null} onClick={() => choose(-1)}>
            {ru.intake.notCaught}
          </button>
          {given === null && plays < 2 && (
            <button type="button" className={ui.link} onClick={play}>
              {ru.intake.listenReplay}
            </button>
          )}
        </div>
      )}
      {given !== null && (
        <div className={s.feedback} data-ok={given === correctIdx || undefined}>
          <PingSays mood={given === correctIdx ? 'happy' : 'oops'} size={56}>
            {line}
          </PingSays>
          {given !== correctIdx && (
            <p>
              {ru.intake.was} <span lang="en">«{item.text}»</span>
            </p>
          )}
          <button type="button" className={ui.primary} onClick={next}>
            {ru.intake.next}
          </button>
        </div>
      )}
    </section>
  )
}

/* ——— Близнецы ——— */

function PairsStep({ draft, update }: StepProps) {
  const items = content.intake.pairs
  const i = draft.pairs.length
  const item = items[i]
  const [given, setGiven] = useState<string | null>(null)

  useEffect(() => {
    if (!item) update((d) => ({ ...d, step: 'reading' }))
  }, [item, update])
  useEffect(() => {
    if (item) void playText(item.answer, { voice: item.voice }).catch(() => {})
  }, [item])
  if (!item) return null

  const choose = (o: string) => {
    setGiven(o)
    sfx(o === item.answer ? 'correct' : 'wrong')
    setTimeout(() => {
      update((d) => {
        d.pairs.push({ id: item.id, tag: item.tag, correct: o === item.answer })
        return d
      })
      setGiven(null)
    }, 900)
  }

  return (
    <section className={s.body}>
      {i === 0 && <PingSays mood="thinking">{ru.lines.intake.pairs}</PingSays>}
      <p className={`${s.counter} mono`}>
        {i + 1} / {items.length}
      </p>
      <div className={s.center}>
        <PlayButton text={item.answer} voice={item.voice} label={ru.intake.listenPlay} size="l" />
      </div>
      <p className={s.prompt}>{ru.intake.pairPrompt}</p>
      <div className={s.pair}>
        {item.options.map((o) => (
          <button
            key={o}
            type="button"
            lang="en"
            className={`${s.option} ${s.big}`}
            disabled={given !== null}
            data-state={given === null ? undefined : o === item.answer ? 'right' : o === given ? 'wrong' : undefined}
            onClick={() => choose(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </section>
  )
}

/* ——— Чтение ——— */

function ReadingStep({ draft, update }: StepProps) {
  const texts = content.intake.reading
  const done = draft.reading
  const text: IntakeReading | undefined =
    done.length === 0 ? texts[0] : done.length === 1 && needsHarderText(done[0]!) ? texts.find((t) => t.level === 2) : undefined

  useEffect(() => {
    if (!text) update((d) => ({ ...d, step: 'speaking' }))
  }, [text, update])
  if (!text) return null
  return <ReadText key={text.id} text={text} first={done.length === 0} onDone={(r) => update((d) => ({ ...d, reading: [...d.reading, r] }))} />
}

function ReadText({ text, first, onDone }: { text: IntakeReading; first: boolean; onDone: (r: IntakeDraft['reading'][number]) => void }) {
  const started = useRef(Date.now())
  const [readSeconds, setReadSeconds] = useState<number | null>(null)
  const [answers, setAnswers] = useState<(number | null)[]>(text.questions.map(() => null))
  const all = answers.every((a) => a !== null)
  return (
    <section className={s.body}>
      {first && <PingSays mood="thinking">{ru.lines.intake.reading}</PingSays>}
      <article className={s.article} lang="en">
        <h2>{text.title}</h2>
        <p>{text.text}</p>
      </article>
      {readSeconds === null ? (
        <>
          <p className={s.hint}>{ru.intake.readHint}</p>
          <button type="button" className={ui.primary} onClick={() => setReadSeconds((Date.now() - started.current) / 1000)}>
            {ru.intake.toQuestions}
          </button>
        </>
      ) : (
        <>
          <p className={`${s.hint} mono`}>{ru.intake.readTime(readSeconds)}</p>
          {text.questions.map((q, qi) => (
            <div key={q.q} className={s.options} role="group" aria-label={q.q}>
              <p className={s.prompt} lang="en">
                {qi + 1}. {q.q}
              </p>
              {q.options.map((o, k) => (
                <button
                  key={o}
                  type="button"
                  lang="en"
                  className={s.option}
                  aria-pressed={answers[qi] === k}
                  data-state={answers[qi] === k ? 'picked' : undefined}
                  onClick={() => setAnswers((a) => a.map((x, n) => (n === qi ? k : x)))}
                >
                  {o}
                </button>
              ))}
            </div>
          ))}
          <button
            type="button"
            className={ui.primary}
            disabled={!all}
            onClick={() =>
              onDone({
                id: text.id,
                level: text.level,
                correct: text.questions.filter((q, qi) => answers[qi] === q.answer).length,
                total: text.questions.length,
                seconds: readSeconds,
                words: countWords(text.text),
              })
            }
          >
            {ru.intake.next}
          </button>
        </>
      )}
    </section>
  )
}

/* ——— Вслух ——— */

type SpeakPhase = 'explain' | 'question' | 'recording' | 'rate' | 'nomic'

function SpeakingStep({ draft, update }: StepProps) {
  const settings = useSettings()
  const items = content.intake.speaking
  const i = draft.speaking.length
  const item = items[i]
  const can = captureSupported()
  const hasCapture = can.record || (settings.asr && can.asr)
  const [phase, setPhase] = useState<SpeakPhase | null>(null)
  const [showRu, setShowRu] = useState(false)
  const [level, setLevel] = useState(0)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [started, setStarted] = useState(false)
  const [result, setResult] = useState<CaptureResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [noMic, setNoMic] = useState(!hasCapture)
  const cap = useRef<Capture | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (!item) update((d) => ({ ...d, step: 'done' }))
  }, [item, update])
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
      cap.current?.cancel()
    },
    [],
  )
  // Новый вопрос: сначала объяснение про микрофон (один раз), потом вопрос.
  useEffect(() => {
    if (!item) return
    setResult(null)
    setShowRu(false)
    setStarted(false)
    void db.getMeta('micExplained').then((ok) => setPhase(noMic ? 'question' : ok ? 'question' : 'explain'))
  }, [item, noMic])

  if (!item || !phase) return null

  const begin = async () => {
    setError(null)
    stopAudio()
    await playText(item.q, { voice: item.voice }).catch(() => {})
    if (noMic) return setPhase('nomic')
    try {
      setStarted(false)
      cap.current = await startCapture({
        asr: settings.asr,
        onLevel: setLevel,
        onSpeechStart: () => {
          setStarted(true)
          setCountdown(null)
        },
      })
      setPhase('recording')
      let n = settings.answerSeconds
      setCountdown(n)
      const tick = () => {
        n -= 1
        setCountdown((c) => (c === null ? null : Math.max(0, n)))
        if (n > 0) timers.current.push(setTimeout(tick, 1000))
      }
      timers.current.push(setTimeout(tick, 1000))
      timers.current.push(setTimeout(() => void stop(), 60_000))
    } catch (e) {
      const reason = e instanceof RecorderError ? e.reason : 'failed'
      setError(reason === 'denied' ? ru.check.denied : reason === 'no-device' ? ru.check.noDevice : ru.check.failed)
      setNoMic(true)
      setPhase('nomic')
    }
  }

  const stop = async () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setCountdown(null)
    const c = cap.current
    cap.current = null
    if (!c) return
    const r = await c.stop()
    setResult(r)
    setPhase('rate')
  }

  const rate = (self: 1 | 2 | 3 | 4) => {
    const r = result
    update((d) => {
      d.speaking.push({
        id: item.id,
        self,
        latencyMs: r?.startMs,
        speechMs: r && (r.recorded || r.recognized) ? r.speechMs : undefined,
        longPauses: r?.longPauses,
        words: r?.transcript ? countWords(r.transcript) : undefined,
        transcript: r?.transcript || undefined,
      })
      return d
    })
    if (r?.url) URL.revokeObjectURL(r.url)
  }

  return (
    <section className={s.body}>
      {i === 0 && phase !== 'rate' && <PingSays mood="happy">{ru.lines.intake.speaking}</PingSays>}
      <p className={`${s.counter} mono`}>
        {i + 1} / {items.length}
      </p>
      <div className={s.question}>
        <p lang="en" className={s.qText}>
          {item.q}
        </p>
        <button type="button" className={ui.link} onClick={() => setShowRu((v) => !v)}>
          {ru.intake.speakRu}
        </button>
        {showRu && <p className={s.hint}>{item.ru}</p>}
      </div>

      {phase === 'explain' && (
        <div className={s.explain} role="dialog" aria-label={ru.check.explainTitle}>
          <p>{ru.check.explain}</p>
          <div className={s.pair}>
            <button type="button" className={ui.secondary} onClick={() => (setNoMic(true), setPhase('question'))}>
              {ru.check.notNow}
            </button>
            <button
              type="button"
              className={ui.primary}
              onClick={() => {
                void db.setMeta('micExplained', true)
                setPhase('question')
              }}
            >
              {ru.check.allow}
            </button>
          </div>
        </div>
      )}

      {phase === 'question' && (
        <>
          <p className={s.hint}>{noMic ? ru.intake.speakNoMic : ru.intake.speakHint(settings.answerSeconds)}</p>
          <button type="button" className={ui.signalButton} onClick={() => void begin()}>
            <IconMic /> {ru.intake.listenPlay}
          </button>
        </>
      )}

      {phase === 'recording' && (
        <div className={s.recording}>
          <LevelMeter level={level} label={ru.check.mic} />
          <p className={s.countdown} aria-live="polite">
            {started ? '●  REC' : countdown !== null && countdown > 0 ? countdown : '…'}
          </p>
          <button type="button" className={ui.primary} data-rec onClick={() => void stop()}>
            {ru.intake.speakStop}
          </button>
        </div>
      )}

      {phase === 'nomic' && (
        <>
          <p className={s.hint}>{ru.intake.speakNoMic}</p>
          <button type="button" className={ui.primary} onClick={() => setPhase('rate')}>
            {ru.intake.speakSaid}
          </button>
        </>
      )}

      {phase === 'rate' && (
        <div className={s.options} role="group" aria-label={ru.intake.selfTitle}>
          {result && (result.recorded || result.recognized) && (
            <p className={`${s.hint} mono`}>{ru.intake.measured(result.startMs, result.speechMs)}</p>
          )}
          {result?.transcript && (
            <p className={s.transcript}>
              {ru.intake.heard} <span lang="en">{result.transcript}</span>
            </p>
          )}
          {result?.url && (
            <button type="button" className={ui.secondary} onClick={() => void playUrl(result.url!)}>
              {ru.check.playMine}
            </button>
          )}
          <p className={s.prompt}>{ru.intake.selfTitle}</p>
          {([1, 2, 3, 4] as const).map((k) => (
            <button key={k} type="button" className={s.option} onClick={() => rate(k)}>
              {ru.intake.self[k]}
            </button>
          ))}
        </div>
      )}
      {error && <p className={ui.error}>{error}</p>}
    </section>
  )
}

async function playUrl(url: string) {
  await player.play(url).catch(() => {})
}
