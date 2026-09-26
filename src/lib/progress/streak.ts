/*
  «Дней в эфире» — серия дней, когда занимался хотя бы 10 минут.
  «Резервный канал»: 1 пропуск в неделю (за любые 7 дней) серию не обрывает.
  Сегодняшний день, если ещё не набрал 10 минут, серию не ломает.
*/

export const AIR_DAY_SECONDS = 10 * 60
export const RESERVE_WINDOW_DAYS = 7

export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function addDays(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return localDate(new Date(y, m - 1, d + delta))
}

export type StreakInfo = {
  /** дней в эфире (засчитанных дней в текущей серии) */
  days: number
  /** использован ли резервный канал за последние 7 дней */
  reserveUsed: boolean
  /** засчитан ли уже сегодняшний день */
  todayCounted: boolean
}

export function computeStreak(secondsByDate: Map<string, number>, today: string): StreakInfo {
  const counted = (d: string) => (secondsByDate.get(d) ?? 0) >= AIR_DAY_SECONDS
  const todayCounted = counted(today)
  let day = todayCounted ? today : addDays(today, -1)
  let days = 0
  let lastReserve: string | null = null
  let reserveUsed = false
  for (let guard = 0; guard < 3660; guard++) {
    if (counted(day)) {
      days++
    } else {
      // Пропуск закрывается резервом, если в этом 7-дневном окне резерв ещё не тратили
      // и до пропуска есть засчитанный день (иначе серия и так закончилась).
      const windowFree = lastReserve === null || daysBetween(day, lastReserve) >= RESERVE_WINDOW_DAYS
      if (!windowFree || !counted(addDays(day, -1))) break
      if (daysBetween(day, today) < RESERVE_WINDOW_DAYS) reserveUsed = true
      lastReserve = day
    }
    day = addDays(day, -1)
  }
  return { days, reserveUsed, todayCounted }
}

export function daysBetween(a: string, b: string): number {
  const t = (s: string) => {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number]
    return Date.UTC(y, m - 1, d)
  }
  return Math.abs(t(a) - t(b)) / 86_400_000
}
