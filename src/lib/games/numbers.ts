/*
  «Цифры на слух»: размеры, допуски, нагрузки, давление, температура, даты, время, номера чертежей.
  Задания генерируются — не кончаются. Звучит текст словами (say), выбрать — запись цифрами.
  Ловушки — то, что русскоязычные путают на слух: 13/30, 15/50, 0.2/0.02, «quarter to / past», 7042/7024.
*/

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

/** Целое 0…999 999 словами (британское «and» после сотен — так говорят обе стороны в технике). */
export function intWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999) throw new Error(`intWords: ${n}`)
  if (n < 20) return ONES[n]!
  if (n < 100) return TENS[Math.floor(n / 10)]! + (n % 10 ? `-${ONES[n % 10]}` : '')
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${intWords(n % 100)}` : ''}`
  const rest = n % 1000
  return `${intWords(Math.floor(n / 1000))} thousand${rest ? (rest < 100 ? ` and ${intWords(rest)}` : ` ${intWords(rest)}`) : ''}`
}

/** Десятичное словами: 3.05 → three point zero five (после точки — по цифре). */
export function decimalWords(s: string): string {
  const [int, frac] = s.split('.')
  const head = intWords(Number(int))
  return frac ? `${head} point ${[...frac].map((d) => ONES[Number(d)]).join(' ')}` : head
}

const ORD: Record<number, string> = { 1: 'first', 2: 'second', 3: 'third', 5: 'fifth', 8: 'eighth', 9: 'ninth', 12: 'twelfth', 20: 'twentieth', 30: 'thirtieth' }
export function ordinalWords(n: number): string {
  if (ORD[n]) return ORD[n]!
  if (n > 20 && n % 10) return `${TENS[Math.floor(n / 10)]}-${ordinalWords(n % 10)}`
  return `${intWords(n)}th`
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const MONTHS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

export type NumberItem = {
  id: string
  /** что звучит */
  say: string
  /** варианты цифрами; [0] — верный */
  options: string[]
  /** подсказка, что за величина */
  ru: string
}

type Gen = (r: () => number) => NumberItem

const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
const pick = <T,>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length)]!
const fmt = (n: number) => n.toLocaleString('en-US')
const uniq = (xs: string[]) => [...new Set(xs)]

/** 13 ↔ 30, 14 ↔ 40… — главная ловушка на слух. */
function teenTwin(n: number): number {
  if (n >= 13 && n <= 19) return (n - 10) * 10
  if (n >= 30 && n <= 90 && n % 10 === 0) return n / 10 + 10
  return n + 10
}

/** Три разных варианта, первый верный; если ловушки совпали — добираем соседними числами. */
function three(right: string, traps: string[], fill: () => string): string[] {
  const out = uniq([right, ...traps.filter((x) => x !== right)])
  let guard = 0
  while (out.length < 3 && guard++ < 20) {
    const x = fill()
    if (!out.includes(x)) out.push(x)
  }
  return out.slice(0, 3)
}

const GENS: Gen[] = [
  // Нагрузка: 15 kN / 50 kN
  (r) => {
    const n = pick(r, [13, 14, 15, 16, 17, 18, 19, 30, 40, 50, 60, 70, 80, 90])
    const unit = pick(r, [
      ['kN', 'kilonewtons', 'нагрузка'],
      ['kg', 'kilograms', 'масса'],
      ['bar', 'bar', 'давление'],
      ['V', 'volts', 'напряжение'],
      ['mm', 'millimetres', 'размер'],
    ] as const)
    return {
      id: `teen-${n}-${unit[0]}`,
      say: `${pick(r, ['The limit is', 'We need', "It's about", 'Set it to'])} ${intWords(n)} ${unit[1]}.`,
      options: three(`${n} ${unit[0]}`, [`${teenTwin(n)} ${unit[0]}`], () => `${int(r, 11, 99)} ${unit[0]}`),
      ru: unit[2],
    }
  },
  // Десятичные размеры: 3.5 / 3.05 / 35
  (r) => {
    const a = int(r, 1, 9)
    const b = int(r, 1, 9)
    const s = `${a}.${b}`
    return {
      id: `dec-${s}`,
      say: `${pick(r, ['The wall thickness is', 'The hole diameter is', 'The gap should be'])} ${decimalWords(s)} millimetres.`,
      options: three(`${s} mm`, [`${a}.0${b} mm`, `${a}${b} mm`], () => `${int(r, 1, 9)}.${int(r, 1, 9)} mm`),
      ru: 'размер',
    }
  },
  // Допуск: ±0.02 / ±0.2 / ±0.002
  (r) => {
    const d = int(r, 1, 9)
    const k = pick(r, [1, 2])
    const s = `0.${'0'.repeat(k - 1)}${d}`
    return {
      id: `tol-${s}`,
      say: `The tolerance is plus or minus ${decimalWords(s)} millimetres.`,
      options: three(`±${s} mm`, [`±0.${'0'.repeat(k)}${d} mm`, k === 2 ? `±0.${d} mm` : `±${d} mm`], () => `±0.${int(r, 1, 9)} mm`),
      ru: 'допуск',
    }
  },
  // Давление: 2.5 MPa / 25 MPa / 2.5 kPa
  (r) => {
    const a = int(r, 1, 9)
    const b = pick(r, [2, 5, 8])
    const s = `${a}.${b}`
    return {
      id: `mpa-${s}`,
      say: `Test pressure: ${decimalWords(s)} megapascals.`,
      options: three(`${s} MPa`, [`${a}${b} MPa`, `${s} kPa`], () => `${int(r, 1, 9)}.${b} MPa`),
      ru: 'давление испытаний',
    }
  },
  // Температура со знаком
  (r) => {
    const n = pick(r, [13, 14, 15, 16, 17, 18, 19, 30, 40, 50, 60, 70, 80])
    const neg = r() < 0.6
    const sign = neg ? '−' : '+'
    return {
      id: `temp-${sign}${n}`,
      // фраза по знаку: «охладили до плюс сорока» звучит нелепо
      say: `${pick(r, neg ? ['The chamber goes down to', 'Operating range starts at', 'The sample was cooled to'] : ['The oven heats up to', 'Operating range goes up to', 'The sample was heated to'])} ${neg ? 'minus' : 'plus'} ${intWords(n)} degrees Celsius.`,
      options: three(`${sign}${n} °C`, [`${sign}${teenTwin(n)} °C`, `${neg ? '+' : '−'}${n} °C`], () => `${sign}${int(r, 11, 90)} °C`),
      ru: 'температура',
    }
  },
  // Большие числа: 1,250 N
  (r) => {
    const n = int(r, 1, 9) * 1000 + pick(r, [150, 250, 350, 450, 500, 750, 15, 50, 40, 14])
    // ловушка 13/30 по последним двум цифрам: 1,014 ↔ 1,040, 1,250 ↔ 1,215
    const t = n % 100
    const twist = (t >= 13 && t <= 19) || (t >= 30 && t % 10 === 0) ? n - t + teenTwin(t) : n + 35
    return {
      id: `big-${n}`,
      say: `The force reached ${intWords(n)} newtons.`,
      options: three(`${fmt(n)} N`, [`${fmt(twist)} N`, `${fmt(n * 10)} N`], () => `${fmt(n + int(r, 1, 9) * 100)} N`),
      ru: 'сила',
    }
  },
  // Даты: the 13th of March / the 30th of March / the 13th of May — только существующие даты
  (r) => {
    const m = int(r, 0, 11)
    const days = DAYS_IN_MONTH[m]!
    const d = pick(r, [3, 13, 30, 14, 4, 15, 5, 16, 20, 2, 12, 21].filter((x) => x <= days))
    const TWIN: Record<number, number> = { 3: 13, 13: 30, 30: 13, 4: 14, 14: 4, 5: 15, 15: 5, 16: 6, 2: 12, 12: 20, 20: 2, 21: 20 }
    const tw = TWIN[d]!
    const months = [...Array(12).keys()].filter((k) => k !== m && d <= DAYS_IN_MONTH[k]!)
    const m2 = pick(r, months)
    const ok = (x: string) => {
      const [dd, mm] = x.split(' ')
      return Number(dd) <= DAYS_IN_MONTH[MONTHS_RU.indexOf(mm!)]!
    }
    return {
      id: `date-${d}-${m}`,
      say: `${pick(r, ['The review is on', 'Please send it by', 'The test is scheduled for'])} the ${ordinalWords(d)} of ${MONTHS[m]}.`,
      options: three(`${d} ${MONTHS_RU[m]}`, [`${tw} ${MONTHS_RU[m]}`, `${d} ${MONTHS_RU[m2]}`].filter(ok), () => `${int(r, 1, 28)} ${MONTHS_RU[m]}`),
      ru: 'дата',
    }
  },
  // Время: a quarter to three = 2:45, a quarter past three = 3:15, half past three = 3:30 (не «половина третьего»!)
  // Варианты — в 12-часовом виде, как и звучит фраза: утро или вечер из неё не понять.
  (r) => {
    const h = int(r, 1, 12)
    const kind = pick(r, ['to', 'past', 'half'] as const)
    const at = (hh: number, mm: number) => `${hh}:${String(mm).padStart(2, '0')}`
    const prev = h === 1 ? 12 : h - 1
    const say = kind === 'to' ? `a quarter to ${intWords(h)}` : kind === 'past' ? `a quarter past ${intWords(h)}` : `half past ${intWords(h)}`
    const right = kind === 'to' ? at(prev, 45) : kind === 'past' ? at(h, 15) : at(h, 30)
    const traps = kind === 'to' ? [at(h, 45), at(h, 15)] : kind === 'past' ? [at(prev, 45), at(h, 45)] : [at(prev, 30), at(h, 50)]
    return {
      id: `time-${kind}-${h}`,
      say: `${pick(r, ["Let's meet at", 'The call starts at', 'The bench is free at'])} ${say}.`,
      options: three(right, traps, () => at(int(r, 1, 12), 0)),
      ru: 'время',
    }
  },

  // Номер чертежа по цифрам: seven oh four two
  (r) => {
    const digits = Array.from({ length: 4 }, () => int(r, 0, 9))
    if (digits[0] === 0) digits[0] = int(r, 1, 9)
    const s = digits.join('')
    const swap = (i: number) => {
      const d = [...digits]
      ;[d[i], d[i + 1]] = [d[i + 1]!, d[i]!]
      return d.join('')
    }
    const spoken = digits.map((d) => (d === 0 ? 'oh' : ONES[d])).join(' ')
    return {
      id: `dwg-${s}`,
      say: `Drawing number ${spoken}, revision ${pick(r, ['A', 'B', 'C'])}.`,
      options: three(s, [swap(2), swap(1)], () => String(int(r, 1000, 9999))),
      ru: 'номер чертежа',
    }
  },
]

/** Задание: тип выбирается по кругу со случайным сдвигом, чтобы подряд не шли одинаковые. */
export function numberItem(r: () => number, round: number, offset = 0): NumberItem {
  const gen = GENS[(round + offset) % GENS.length]!
  return gen(r)
}

export const NUMBER_KINDS = GENS.length
