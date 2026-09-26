/*
  Раскладка ежедневного «Сеанса связи» по блокам (ТЗ §8). Базовая пропорция — 30 минут:
  разминка 3, повторение 7, Эфир 6, Позывной 8, ротация 6.
  Для 20 и 45 минут минуты делятся пропорционально (метод наибольших остатков),
  каждый блок получает хотя бы 2 минуты.
*/

export type BlockId = 'warmup' | 'review' | 'air' | 'call' | 'rotation'

export type PlannedBlock = { id: BlockId; minutes: number; startsAt: number }

const BASE: [BlockId, number][] = [
  ['warmup', 3],
  ['review', 7],
  ['air', 6],
  ['call', 8],
  ['rotation', 6],
]
const BASE_TOTAL = 30
const MIN_BLOCK = 2

export function planSession(totalMinutes: number): PlannedBlock[] {
  const raw = BASE.map(([id, m]) => ({ id, exact: (m * totalMinutes) / BASE_TOTAL }))
  const minutes = raw.map((b) => Math.max(MIN_BLOCK, Math.floor(b.exact)))
  let left = totalMinutes - minutes.reduce((a, b) => a + b, 0)

  const byRemainder = raw
    .map((b, i) => ({ i, rem: b.exact - Math.floor(b.exact) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i)
  for (let k = 0; left > 0; k = (k + 1) % byRemainder.length, left--) minutes[byRemainder[k]!.i]! += 1
  while (left < 0) {
    const longest = minutes.indexOf(Math.max(...minutes))
    minutes[longest]! -= 1
    left++
  }

  let t = 0
  return raw.map((b, i) => {
    const block = { id: b.id, minutes: minutes[i]!, startsAt: t }
    t += minutes[i]!
    return block
  })
}
