/*
  Между блоками занятия (UX §3.3): «Дальше: Быстрая речь на слух · 3 мин», кнопка «Дальше»
  и мелкая «Пропустить этот блок». Когда блоков не осталось — «Занятие выполнено» и возврат на главный.
*/
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import ui from '../../components/ui.module.css'
import { ru } from '../../i18n/ru'
import { db } from '../../lib/db/db'
import { useToday } from '../../lib/progress/useToday'
import { skipBlock } from '../../lib/session/session'
import { nextSegment, segmentBlockTitle, segmentUrl } from './segments'
import s from './NextBlock.module.css'

export function NextBlock({ afterId }: { afterId: string }) {
  const navigate = useNavigate()
  const date = useToday()
  const row = useLiveQuery(() => db.sessions.get(date).then((x) => x ?? null), [date])
  if (row === undefined) return null
  // Новый день начался, а плана на него ещё нет — его соберёт главный экран.
  if (row === null)
    return (
      <button type="button" className={ui.signalButton} onClick={() => navigate('/')}>
        {ru.session.toHome}
      </button>
    )
  const next = nextSegment(row, afterId)
  const t = ru.session
  if (!next)
    return (
      <>
        <p className={s.done}>{t.doneTitle}</p>
        <button type="button" className={ui.signalButton} onClick={() => navigate('/')}>
          {t.toHome}
        </button>
      </>
    )
  // Сколько минут у следующего блока — все его оставшиеся сегменты
  const minutes = row.segments.filter((x) => x.block === next.block && x.status === 'pending').reduce((n, x) => n + x.minutes, 0)
  return (
    <>
      <p className={s.next}>{t.nextBlock(segmentBlockTitle(next), minutes)}</p>
      <button type="button" className={ui.signalButton} onClick={() => navigate(segmentUrl(next))}>
        {t.next}
      </button>
      <div className={s.row}>
        <button
          type="button"
          className={ui.link}
          onClick={() =>
            void skipBlock(next.block).then(async () => {
              const fresh = await db.sessions.get(date)
              const after = nextSegment(fresh, afterId)
              navigate(after ? segmentUrl(after) : '/')
            })
          }
        >
          {t.skipThis}
        </button>
        <Link to="/session" className={ui.link}>
          {t.toPlan}
        </Link>
      </div>
    </>
  )
}
