/*
  Проверка звука и микрофона: два голоса (US и UK), запись с индикатором уровня,
  распознавание фразы «Houston, we have a problem».
*/
import { useEffect, useRef, useState } from 'react'
import { IconMic } from '../../components/Icons'
import { LevelMeter } from '../../components/Instruments'
import { PingSays, Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { content } from '../../content'
import { ru } from '../../i18n/ru'
import { playSeries, stopAudio } from '../../lib/audio/audio'
import { captureSupported, startCapture, type Capture, type CaptureResult } from '../../lib/audio/capture'
import { player } from '../../lib/audio/player'
import { RecorderError } from '../../lib/audio/recorder'
import { db } from '../../lib/db/db'
import { detectPlatform } from '../../lib/pwa/install'
import { useSettings } from '../../lib/settings/settings'
import s from './check.module.css'

export function CheckScreen() {
  return (
    <Screen title={ru.check.title} back>
      <SoundPanel />
      <MicPanel />
    </Screen>
  )
}

export function SoundPanel({ onOk }: { onOk?: () => void }) {
  const t = ru.check
  const [played, setPlayed] = useState(false)
  const [help, setHelp] = useState(false)
  useEffect(() => () => stopAudio(), [])
  return (
    <section className={s.panel}>
      <h2>{t.sound}</h2>
      <p className={ui.note}>{t.soundText}</p>
      <button
        type="button"
        className={ui.primary}
        onClick={() => {
          setPlayed(true)
          void playSeries(content.intake.soundCheck, 500).catch(() => {})
          void db.setMeta('soundChecked', true)
        }}
      >
        {t.listen}
      </button>
      {detectPlatform() === 'ios' && <p className={ui.note}>{t.iphone}</p>}
      {played && (
        <div className={ui.row}>
          <button type="button" className={ui.secondary} onClick={() => setHelp(true)}>
            {t.notHeard}
          </button>
          <button type="button" className={ui.secondary} onClick={() => (setHelp(false), onOk?.())}>
            {t.heard}
          </button>
        </div>
      )}
      {help && <p className={ui.note}>{t.notHeardHelp}</p>}
    </section>
  )
}

function MicPanel() {
  const t = ru.check
  const settings = useSettings()
  const can = captureSupported()
  const [phase, setPhase] = useState<'idle' | 'explain' | 'rec' | 'done'>('idle')
  const [level, setLevel] = useState(0)
  const [result, setResult] = useState<CaptureResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [asrOnly, setAsrOnly] = useState(false)
  const cap = useRef<Capture | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const phrase = content.intake.micPhrase

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      cap.current?.cancel()
    },
    [],
  )
  useEffect(() => {
    void db.getMeta('captureMode').then((m) => setAsrOnly(m === 'asr-only'))
  }, [result])

  if (!can.record && !(settings.asr && can.asr))
    return (
      <section className={s.panel}>
        <h2>{t.mic}</h2>
        <p className={ui.note}>{t.micNone}</p>
      </section>
    )

  const record = async () => {
    setError(null)
    setResult(null)
    stopAudio()
    try {
      cap.current = await startCapture({ asr: settings.asr, onLevel: setLevel })
      setPhase('rec')
      timer.current = setTimeout(() => void stop(), 8000)
    } catch (e) {
      const reason = e instanceof RecorderError ? e.reason : 'failed'
      setError(reason === 'denied' ? t.denied : reason === 'no-device' ? t.noDevice : t.failed)
      setPhase('idle')
    }
  }
  const stop = async () => {
    clearTimeout(timer.current)
    const c = cap.current
    cap.current = null
    if (!c) return
    const r = await c.stop()
    setResult(r)
    setLevel(0)
    setPhase('done')
    void db.setMeta('micChecked', true)
  }
  const begin = async () => ((await db.getMeta('micExplained')) ? void record() : setPhase('explain'))

  return (
    <section className={s.panel}>
      <h2>{t.mic}</h2>
      <p className={ui.note}>{t.micText(phrase)}</p>
      {phase === 'explain' && (
        <div className={s.explain} role="dialog" aria-label={t.explainTitle}>
          <p>{t.explain}</p>
          <div className={ui.row}>
            <button type="button" className={ui.secondary} onClick={() => setPhase('idle')}>
              {t.notNow}
            </button>
            <button
              type="button"
              className={ui.primary}
              onClick={() => {
                void db.setMeta('micExplained', true)
                void record()
              }}
            >
              {t.allow}
            </button>
          </div>
        </div>
      )}
      <LevelMeter level={level} label={t.mic} />
      {phase === 'rec' ? (
        <button type="button" className={`${ui.primary} ${s.rec}`} onClick={() => void stop()}>
          {t.stop}
        </button>
      ) : (
        phase !== 'explain' && (
          <button type="button" className={ui.secondary} onClick={() => void begin()}>
            <IconMic /> {t.record}
          </button>
        )
      )}
      {result && (
        <div className={s.result} role="status">
          {result.recorded && <p>{result.speechMs > 400 ? t.micOk : t.micSilent}</p>}
          {result.url && (
            <button type="button" className={ui.secondary} onClick={() => void player.play(result.url!).catch(() => {})}>
              {t.playMine}
            </button>
          )}
          {!settings.asr ? (
            <p className={ui.note}>{t.asrOff}</p>
          ) : !can.asr ? (
            <p className={ui.note}>{t.asrNone}</p>
          ) : result.asrError ? (
            <p className={ui.note}>{t.asrFailed(result.asrError)}</p>
          ) : (
            result.transcript && <p lang="en">{t.asrOk(result.transcript)}</p>
          )}
          {asrOnly && <p className={ui.note}>{t.asrOnlyNote}</p>}
        </div>
      )}
      {error && (
        <PingSays mood="oops" size={56}>
          {error}
        </PingSays>
      )}
    </section>
  )
}
