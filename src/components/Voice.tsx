/*
  Ответ голосом — общий для всех упражнений говорения.
  timed — секунд на начало ответа (быстрый ответ, перевод на лету); без него — свободная запись (повтори чанк).
  Нет микрофона и распознавания — кнопка «Сказал» и самооценка: функция не ломается, а упрощается.
*/
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ru } from '../i18n/ru'
import { playText, stopAudio, wait } from '../lib/audio/audio'
import { captureSupported, startCapture, type Capture, type CaptureResult } from '../lib/audio/capture'
import { player } from '../lib/audio/player'
import { RecorderError } from '../lib/audio/recorder'
import { db } from '../lib/db/db'
import { useSettings } from '../lib/settings/settings'
import { bestAlternative, type WordMatch } from '../lib/speech/recognize'
import { IconMic } from './Icons'
import { LevelMeter } from './Instruments'
import ui from './ui.module.css'
import s from './Voice.module.css'

/** Текст с подсвеченным «стыком»: focus вида «a … b» подсвечивает обе части. */
export function Highlight({ text, focus }: { text: string; focus?: string }) {
  const parts = (focus ?? '')
    .split('→')[0]!
    .split('…')
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return <span lang="en">{text}</span>
  const out: ReactNode[] = []
  let rest = text
  let k = 0
  for (const p of parts) {
    const i = rest.toLowerCase().indexOf(p.toLowerCase())
    if (i < 0) continue
    out.push(rest.slice(0, i), <mark key={k++} className={s.mark}>{rest.slice(i, i + p.length)}</mark>)
    rest = rest.slice(i + p.length)
  }
  out.push(rest)
  return <span lang="en">{out}</span>
}

export function WordDiff({ words }: { words: WordMatch[] }) {
  return (
    <span className={s.diff} lang="en">
      {words.map((w, i) => (
        <span key={i} data-ok={w.ok || undefined}>
          {w.word}
        </span>
      ))}
    </span>
  )
}

export type VoiceResult = (CaptureResult & { onTime?: boolean }) | null

type Props = {
  /** секунд на начало ответа; нет — без таймера */
  timed?: number
  /** максимум записи, с */
  maxSeconds?: number
  /** что сыграть перед записью (вопрос) — запись начнётся сразу после */
  prompt?: { text: string; voice?: import('../content/types').VoiceId }
  /** начать сразу при показе (после вопроса) */
  autoStart?: boolean
  label?: string
  /** показать «Сказал вслух без записи» (выключают, когда на экране уже есть свой путь без записи) */
  allowSkip?: boolean
  onResult: (r: VoiceResult) => void
}

type Phase = 'idle' | 'explain' | 'prompt' | 'rec' | 'nomic'

export function VoiceAnswer({ timed, maxSeconds = 45, prompt, autoStart, label, allowSkip = true, onResult }: Props) {
  const settings = useSettings()
  const can = captureSupported()
  const hasCapture = can.record || (settings.asr && can.asr)
  const [phase, setPhase] = useState<Phase>('idle')
  const [level, setLevel] = useState(0)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [talking, setTalking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cap = useRef<Capture | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const started = useRef(false)

  const clear = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(
    () => () => {
      clear()
      cap.current?.cancel()
    },
    [],
  )

  const begin = async () => {
    setError(null)
    if (hasCapture && !(await db.getMeta('micExplained'))) return setPhase('explain')
    void run()
  }

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true
      void begin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart])

  const run = async () => {
    stopAudio()
    if (prompt) {
      setPhase('prompt')
      await playText(prompt.text, { voice: prompt.voice }).catch(() => {})
      await wait(150)
    }
    if (!hasCapture) return setPhase('nomic')
    try {
      setTalking(false)
      cap.current = await startCapture({
        asr: settings.asr,
        onLevel: setLevel,
        onSpeechStart: () => {
          setTalking(true)
          setCountdown(null)
        },
      })
      setPhase('rec')
      if (timed) {
        let n = timed
        setCountdown(n)
        const tick = () => {
          n -= 1
          setCountdown((c) => (c === null ? null : Math.max(0, n)))
          if (n > 0) timers.current.push(setTimeout(tick, 1000))
        }
        timers.current.push(setTimeout(tick, 1000))
      }
      timers.current.push(setTimeout(() => void stop(), maxSeconds * 1000))
    } catch (e) {
      const reason = e instanceof RecorderError ? e.reason : 'failed'
      setError(reason === 'denied' ? ru.check.denied : reason === 'no-device' ? ru.check.noDevice : ru.check.failed)
      setPhase('nomic')
    }
  }

  const stop = async () => {
    clear()
    setCountdown(null)
    const c = cap.current
    cap.current = null
    if (!c) return
    const r = await c.stop()
    setLevel(0)
    setPhase('idle')
    onResult({ ...r, onTime: timed === undefined ? undefined : r.startMs !== undefined && r.startMs <= timed * 1000 })
  }

  return (
    <div className={s.voice}>
      {phase === 'explain' && (
        <div className={s.explain} role="dialog" aria-label={ru.check.explainTitle}>
          <p>{ru.check.explain}</p>
          <div className={ui.row}>
            <button type="button" className={ui.secondary} onClick={() => setPhase('nomic')}>
              {ru.check.notNow}
            </button>
            <button
              type="button"
              className={ui.primary}
              onClick={() => {
                void db.setMeta('micExplained', true)
                void run()
              }}
            >
              {ru.check.allow}
            </button>
          </div>
        </div>
      )}
      {phase === 'idle' && (
        <>
          <button type="button" className={ui.signalButton} onClick={() => void begin()}>
            <IconMic /> {label ?? ru.voice.start}
          </button>
          {/* Никогда не блокировать без выхода (UX §1.10): можно сказать вслух без записи */}
          {hasCapture && allowSkip && (
            <button type="button" className={ui.link} onClick={() => onResult(null)}>
              {ru.voice.saidNoRec}
            </button>
          )}
        </>
      )}
      {phase === 'prompt' && <p className={s.status}>…</p>}
      {phase === 'rec' && (
        <div className={s.rec}>
          <LevelMeter level={level} label={ru.check.mic} />
          {timed && countdown !== null && !talking && <CountdownRing left={countdown} total={timed} />}
          <p className={s.countdown} aria-live="polite" data-talking={talking || undefined}>
            {talking ? ru.voice.speaking : countdown !== null ? ru.voice.startIn(countdown) : '●'}
          </p>
          <button type="button" className={`${ui.primary} ${s.stop}`} onClick={() => void stop()}>
            {ru.voice.stop}
          </button>
        </div>
      )}
      {phase === 'nomic' && (
        <>
          <p className={s.status}>{ru.voice.noMic}</p>
          <button type="button" className={ui.primary} onClick={() => onResult(null)}>
            {ru.voice.said}
          </button>
        </>
      )}
      {error && <p className={ui.error}>{error}</p>}
    </div>
  )
}

/** Круговой отсчёт до начала ответа (UX §4.6): кольцо тает, в центре — секунды. */
function CountdownRing({ left, total }: { left: number; total: number }) {
  const r = 26
  const len = 2 * Math.PI * r
  return (
    <svg className={s.ring} viewBox="0 0 64 64" width="72" height="72" aria-hidden>
      <circle cx="32" cy="32" r={r} className={s.ringTrack} />
      <circle cx="32" cy="32" r={r} className={s.ringFill} strokeDasharray={len} strokeDashoffset={len * (1 - left / total)} data-low={left <= 2 || undefined} />
      <text x="32" y="38" textAnchor="middle" className={s.ringText}>
        {left}
      </text>
    </svg>
  )
}

/** После ответа: цифры, распознанный текст с разбором по образцу, «послушать себя». */
export function VoiceReport({ result, target, sample }: { result: VoiceResult; target?: string; sample?: { text: string; voice?: import('../content/types').VoiceId } }) {
  const [busy, setBusy] = useState(false)
  if (!result) return null
  const measured = result.recorded || result.recognized
  const match = target && result.alts.length ? bestAlternative(target, result.alts) : null
  const missed = match?.match.words.filter((w) => !w.ok) ?? []
  const compare = async () => {
    if (!result.url || !sample) return
    setBusy(true)
    try {
      await playText(sample.text, { voice: sample.voice })
      await wait(300)
      await player.play(result.url)
      await wait(300)
      await playText(sample.text, { voice: sample.voice })
    } catch {
      /* ошибку покажет плеер */
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={s.report} role="status">
      {measured && <p className="mono">{ru.voice.measured(result.startMs, result.speechMs, result.longPauses)}</p>}
      {result.transcript && (
        <p>
          {ru.voice.heard} <span lang="en">{result.transcript}</span>
        </p>
      )}
      {match && (
        <p>
          {missed.length ? (
            <>
              {ru.voice.missed} <WordDiff words={match.match.words} />
            </>
          ) : (
            ru.voice.allMatched
          )}
        </p>
      )}
      {result.url && (
        <div className={ui.row}>
          <button type="button" className={ui.secondary} disabled={busy} onClick={() => void player.play(result.url!).catch(() => {})}>
            {ru.voice.playMine}
          </button>
          {sample && (
            <button type="button" className={ui.secondary} disabled={busy} onClick={() => void compare()}>
              {ru.voice.compare}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
