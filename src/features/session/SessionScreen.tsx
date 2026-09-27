/*
  План занятия (UX §3.3): только превью блоков — без кнопок у каждого, текущий выделен; одна кнопка
  «Начать / Продолжить занятие». Блоки дальше идут подряд сами, между ними — экран «Готово → Дальше».
  Маршрут /session.
*/
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
import { getTodaySession } from '../../lib/session/today'
import { useSettings } from '../../lib/settings/settings'
import { nextSegment, planBlocks, segmentUrl } from './segments'
import s from './SessionScreen.module.css'

/** Что внутри блока: виды упражнений без повторов и модуль один раз. */
function blockWhat(segs: SessionSegment[]): string {
  const cards = segs.filter((x) => x.label === 'cards').reduce((n, x) => n + (x.steps?.length ?? 0), 0)
  const labels = [...new Set(segs.filter((x) => x.label !== 'cards').map((x) => ru.session.labels[x.label] ?? x.label))]
  const modules = [...new Set(segs.map((x) => (x.module ? moduleById.get(x.module)?.title : undefined)).filter((x): x is string => !!x))]
  return [...(cards ? [ru.session.cardsN(cards)] : []), ...labels, ...modules.map((m) => ru.session.module(m))].join(' · ')
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

  const next = nextSegment(row)
  let t0 = 0
  return (
    <Screen title={t.title} back subtitle={loaded && !last ? t.needIntake : t.planHint}>
      <ol className={s.segments}>
        {planBlocks(row).map((b) => {
          const start = t0
          t0 += b.minutes
          return (
            <li key={b.block} className={s.segment} data-status={b.status} data-current={b.status === 'current' || undefined}>
              <span className={`${s.mark} mono`} aria-hidden>
                {b.status !== 'done' ? `T+${String(start).padStart(2, '0')}` : b.segments.every((x) => x.status === 'skipped') ? '—' : '✓'}
              </span>
              <span className={s.text}>
                <span className={s.title}>
                  {b.title} <span className={`${s.min} mono`}>· {b.minutes} мин</span>
                  {b.status === 'current' && <span className={s.now}>{t.current}</span>}
                </span>
                <span className={s.what}>{blockWhat(b.segments)}</span>
              </span>
            </li>
          )
        })}
      </ol>
      {!row.segments.some((x) => x.block === 'review') && <p className={s.honest}>{t.noReview}</p>}

      {next ? (
        <div className={s.launch}>
          <button type="button" className={ui.signalButton} onClick={() => navigate(segmentUrl(next))}>
            {row.seconds > 0 || next.pos || row.segments.some((x) => x.status !== 'pending') ? t.continue : t.start}
          </button>
        </div>
      ) : (
        <div className={s.done}>
          <Mascot mood="celebrate" size={104} />
          <h2>{t.doneTitle}</h2>
          <p className="mono">{t.doneStats(Math.round(row.seconds / 60), row.signal, row.spokenMs / 1000)}</p>
          <p className={s.honest}>{t.extra}</p>
          <button type="button" className={ui.secondary} onClick={() => navigate('/more')}>
            {t.toTraining}
          </button>
        </div>
      )}
    </Screen>
  )
}
