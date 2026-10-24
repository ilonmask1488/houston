import { describe, expect, it } from 'vitest'
import { rng } from '../intake/plan'
import { decimalWords, intWords, NUMBER_KINDS, numberItem, ordinalWords } from './numbers'

describe('цифры на слух', () => {
  it('числа словами', () => {
    expect(intWords(0)).toBe('zero')
    expect(intWords(15)).toBe('fifteen')
    expect(intWords(50)).toBe('fifty')
    expect(intWords(42)).toBe('forty-two')
    expect(intWords(105)).toBe('one hundred and five')
    expect(intWords(1250)).toBe('one thousand two hundred and fifty')
    expect(intWords(2015)).toBe('two thousand and fifteen')
    expect(decimalWords('3.05')).toBe('three point zero five')
    expect(decimalWords('0.02')).toBe('zero point zero two')
    expect(ordinalWords(3)).toBe('third')
    expect(ordinalWords(13)).toBe('thirteenth')
    expect(ordinalWords(21)).toBe('twenty-first')
    expect(ordinalWords(30)).toBe('thirtieth')
  })

  it('каждое задание: три разных варианта, верный первым, фраза озвучивается словами', () => {
    const r = rng(7)
    for (let k = 0; k < NUMBER_KINDS * 60; k++) {
      const it = numberItem(r, k)
      expect(it.options).toHaveLength(3)
      expect(new Set(it.options).size).toBe(3)
      // озвучка без цифр — телефон не прочитает «3.5 mm» как «three point five millimetres» сам
      expect(it.say).not.toMatch(/\d/)
      expect(it.ru.length).toBeGreaterThan(0)
    }
  })

  it('ловушки: 15 против 50, «quarter to three» — это 14:45', () => {
    const r = rng(11)
    const seen = new Map<string, string[]>()
    for (let k = 0; k < NUMBER_KINDS * 200; k++) {
      const it = numberItem(r, k)
      seen.set(it.say, it.options)
    }
    const teen = [...seen].find(([say]) => say.includes(' fifteen kilonewtons'))
    if (teen) expect(teen[1].slice(0, 2)).toEqual(['15 kN', '50 kN'])
    const q = [...seen].find(([say]) => say.endsWith('a quarter to three.'))
    if (q) expect(q[1][0]).toBe('2:45')
    const half = [...seen].find(([say]) => say.endsWith('half past two.'))
    if (half) expect(half[1][0]).toBe('2:30')
    const big = [...seen].find(([say]) => say.endsWith('thousand and fourteen newtons.'))
    if (big) expect(big[1][1]).toMatch(/,040 N$/)
  })
  it('даты только существующие: ни «31 апреля», ни «30 февраля»', () => {
    const DAYS: Record<string, number> = { января: 31, февраля: 28, марта: 31, апреля: 30, мая: 31, июня: 30, июля: 31, августа: 31, сентября: 30, октября: 31, ноября: 30, декабря: 31 }
    const r = rng(23)
    for (let k = 0; k < NUMBER_KINDS * 2000; k++) {
      const it = numberItem(r, k)
      if (!it.id.startsWith('date-')) continue
      for (const o of it.options) {
        const [d, m] = o.split(' ')
        expect(Number(d), o).toBeLessThanOrEqual(DAYS[m!]!)
      }
    }
  })
})
