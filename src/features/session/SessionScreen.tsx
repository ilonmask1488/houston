/* «Сеанс связи» — сегодняшний план из сегментов не длиннее ~3 минут одного формата. Маршрут /session. */
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mascot } from '../../components/Mascot'
import { Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { moduleById } from '../../content'
import { ru } from '../../i18n/ru'
import { db } from '../../lib/db/db'
import type { SessionSegment } from '../../lib/db/types'
import { useIntakeState } from '../../lib/intake/store'
import { localDate } from '../../lib/progress/streak'
import { skipBlock } from '../../lib/session/session'
import { getTodaySession } from '../../lib/session/today'
import { useSettings } from '../../lib/settings/settings'
import s from './SessionScreen.module.css'

export function segmentUrl(seg: SessionSegment): string {
  if (seg.kind === 'game' && seg.game) return `/game/${seg.game}?seg=${seg.id}`
  return `/run/seg/${seg.id}`
}

function segmentWhat(seg: SessionSegment): string {
  const label = ru.session.labels[seg.label] ?? seg.label
  if (seg.label === 'cards') return ru.session.cardsN(seg.steps?.length ?? 0)
  const m = seg.module ? moduleById.get(seg.module) : undefined
  const base = m ? `${label} · ${ru.session.module(m.title)}` : label
  return seg.status === 'pending' && seg.pos ? `${base} · ${ru.session.stoppedAt(seg.pos + 1)}` : base
}

export function SessionScreen() {
  const navigate = useNavigate()
  const settings = useSettings()
  const { last, loaded } = useIntakeState()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    void getTodaySession(settings.sessionMinutes).then(() => setReady(true))
  }, [settings.sessionMinutes])
  const row = useLiveQuery(() => (ready ? db.sessions.get(localDate()) : undefined), [ready])
  const t = ru.session
  if (!row) return <Screen title={t.title} back />

  const segments = row.segments
  const next = segments.find((x) => x.status === 'pending')
  let t0 = 0
  return (
    <Screen title={t.title} back subtitle={loaded && !last ? t.needIntake : undefined}>
      <ol className={s.segments}>
        {segments.map((seg) => {
          const start = t0
          t0 += seg.minutes
          return (
            <li key={seg.id} className={s.segment} data-status={seg.status} data-current={seg === next || undefined}>
              <span className={`${s.mark} mono`} aria-hidden>
                {seg.status === 'done' ? '✓' : seg.status === 'skipped' ? '—' : `T+${String(start).padStart(2, '0')}`}
              </span>
              <span className={s.text}>
                <span className={s.title}>
                  {ru.blocks[seg.block].title} <span className={`${s.min} mono`}>· {seg.minutes} мин</span>
                </span>
                <span className={s.what}>{segmentWhat(seg)}</span>
              </span>
              {seg.status === 'pending' && seg !== next && (
                <button type="button" className={ui.link} onClick={() => navigate(segmentUrl(seg))}>
                  {t.open}
                </button>
              )}
            </li>
          )
        })}
      </ol>
      {!segments.some((x) => x.block === 'review') && <p className={s.honest}>{t.noReview}</p>}

      {next ? (
        <div className={s.launch}>
          <button type="button" className={ui.signalButton} onClick={() => navigate(segmentUrl(next))}>
            {row.seconds > 0 || next.pos ? t.continue(ru.blocks[next.block].title) : t.start(ru.blocks[next.block].title)}
          </button>
          <button type="button" className={ui.link} onClick={() => void skipBlock(next.block)}>
            {t.skip(ru.blocks[next.block].title)}
          </button>
        </div>
      ) : (
        <div className={s.done}>
          <Mascot mood="celebrate" size={104} />
          <h2>{t.doneTitle}</h2>
          <p className="mono">{t.doneStats(Math.round(row.seconds / 60), row.signal, row.spokenMs / 1000)}</p>
          <p className={s.honest}>{t.extra}</p>
          <button type="button" className={ui.secondary} onClick={() => navigate('/tracks')}>
            {t.toTracks}
          </button>
        </div>
      )}
    </Screen>
  )
}
