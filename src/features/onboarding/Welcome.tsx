/*
  Обучение интерфейсу (UX §7): после вводного теста — четыре коротких экрана, их можно пропустить.
  Тем, у кого уже был прогресс до обновления, один раз — «Что изменилось» и предложение обучения.
  Прогресс не трогается. Как в «Сяо Хо».
*/
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Mascot } from '../../components/Mascot'
import ui from '../../components/ui.module.css'
import { ru } from '../../i18n/ru'
import { db } from '../../lib/db/db'
import s from './Welcome.module.css'

export function Welcome() {
  // welcomeSeen: true — показано; 'tour' — попросили показать заново; нет — первый раз
  const state = useLiveQuery(async () => {
    const flag = await db.getMeta('welcomeSeen')
    return { seen: flag === true, tour: flag === 'tour', existing: (await db.days.count()) > 0 }
  }, [])
  const [step, setStep] = useState(-1) // -1 — «что изменилось» для тех, кто уже занимался; 0..n — шаги
  if (!state || state.seen) return null
  const t = ru.welcome
  const finish = () => void db.setMeta('welcomeSeen', true)
  const i = step < 0 && (state.tour || !state.existing) ? 0 : step

  if (i < 0) {
    return (
      <div className={s.scrim} role="dialog" aria-modal="true" aria-label={t.changedTitle}>
        <div className={s.panel}>
          <Mascot mood="wink" size={64} />
          <h2>{t.changedTitle}</h2>
          {t.changedText.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <div className={s.row}>
            <button type="button" className={ui.secondary} onClick={() => setStep(0)}>
              {t.tour}
            </button>
            <button type="button" className={ui.primary} onClick={finish}>
              {t.ok}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const cur = t.steps[i]!
  const last = i === t.steps.length - 1
  return (
    <div className={s.scrim} role="dialog" aria-modal="true" aria-label={t.title}>
      <div className={s.panel}>
        <div className={s.top}>
          <span className={`${s.count} mono`}>
            {i + 1} / {t.steps.length}
          </span>
          <button type="button" className={ui.link} onClick={finish}>
            {t.skip}
          </button>
        </div>
        <Mascot mood={last ? 'celebrate' : 'happy'} size={64} />
        <h2>{cur.title}</h2>
        <p>{cur.text}</p>
        <div className={s.dots} aria-hidden>
          {t.steps.map((_, k) => (
            <span key={k} data-on={k === i || undefined} />
          ))}
        </div>
        <button type="button" className={ui.primary} onClick={() => (last ? finish() : setStep(i + 1))}>
          {last ? t.start : t.next}
        </button>
      </div>
    </div>
  )
}
