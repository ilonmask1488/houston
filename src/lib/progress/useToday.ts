/*
  Сегодняшняя дата (YYYY-MM-DD, местное время), которая сама меняется в полночь.
  PWA живёт в фоне сутками: без этого главный экран после полуночи показывал вчерашний план.
  Обновляется по таймеру на ближайшую полночь и при возврате в приложение (visibilitychange, focus) —
  таймеры в фоне на телефоне засыпают.
*/
import { useEffect, useState } from 'react'
import { localDate } from './streak'

/** Сколько мс до следующей местной полуночи (с запасом в секунду). */
export function msToMidnight(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return next.getTime() - now.getTime() + 1000
}

export function useToday(): string {
  const [today, setToday] = useState(() => localDate())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const check = () => {
      setToday(localDate())
      clearTimeout(timer)
      timer = setTimeout(check, msToMidnight())
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    check()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
    }
  }, [])
  return today
}
