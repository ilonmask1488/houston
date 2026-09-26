import { describe, expect, it } from 'vitest'
import { bestAlternative, compareWords, countWords, judgePair, normalizeWords } from './recognize'

describe('нормализация слов', () => {
  it('регистр, пунктуация, сокращения, числа', () => {
    expect(normalizeWords("I'm gonna call them at 2!")).toEqual(['i', 'am', 'going', 'to', 'call', 'them', 'at', 'two'])
    expect(normalizeWords('We should’ve checked it.')).toEqual(['we', 'should', 'have', 'checked', 'it'])
  })

  it('британское написание приравнено к американскому', () => {
    expect(normalizeWords('colour behaviour centre analyse organisation')).toEqual(['color', 'behavior', 'center', 'analyse', 'organization'])
    expect(normalizeWords('four hours your exercise')).toEqual(['four', 'hours', 'your', 'exercise'])
  })
})

describe('сравнение с образцом', () => {
  it('всё совпало, несмотря на сокращения', () => {
    const r = compareWords("I'm going to call them tomorrow.", 'I am gonna call them tomorrow')
    expect(r.ok).toBe(r.total)
    expect(r.words.map((w) => w.word)).toEqual(["I'm", 'going', 'to', 'call', 'them', 'tomorrow.'])
  })

  it('пропущенные слова подсвечены', () => {
    const r = compareWords('Could you walk me through the design?', 'could you walk me the design')
    expect(r.words.filter((w) => !w.ok).map((w) => w.word)).toEqual(['through'])
    expect(r).toMatchObject({ ok: 6, total: 7 })
  })

  it('из вариантов выбирается лучший', () => {
    const best = bestAlternative('think', ['sink', 'think'])
    expect(best?.heard).toBe('think')
  })

  it('диктант прощает опечатку в длинном слове, но не в коротком', () => {
    expect(compareWords('We tested the pressure sensor.', 'we tested the presure sensor', true).ok).toBe(5)
    expect(compareWords('We tested the pressure sensor.', 'we tested the presure sensor').ok).toBe(4)
    expect(compareWords('Can you send it?', 'can you sand it', true).ok).toBe(3)
  })

  it('подсчёт слов', () => {
    expect(countWords("That's a good question, let me think.")).toBe(8)
  })
})

describe('минимальная пара вслух', () => {
  it('нужное слово — в основном варианте или в альтернативах; соседнее — только в основном', () => {
    expect(judgePair('think', 'sink', 'think', [])).toBe('right')
    expect(judgePair('think', 'sink', 'sink', ['think'])).toBe('right')
    expect(judgePair('think', 'sink', 'sink', ['zinc'])).toBe('other')
    expect(judgePair('think', 'sink', 'pink', ['sink'])).toBe('none')
    expect(judgePair('west', 'vest', 'the West', [])).toBe('right')
  })
})