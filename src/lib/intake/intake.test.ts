import { describe, expect, it } from 'vitest'
import { content, modulesByTrack } from '../../content'
import type { BandId } from '../../content/types'
import { newDraft, rng, shouldVerify, translationOptions, vocabPlan, WORDS_PER_BAND, PSEUDO_PER_BAND } from './plan'
import {
  bandRates,
  computeResult,
  continueAfterBand,
  listeningScore,
  needsHarderText,
  nextSpeed,
  speakingScore,
  startModule,
  trackLevel,
  type IntakeDraft,
  type VocabAnswer,
} from './score'

const bands = () => content.intake.bands

function vocab(band: BandId, yes: number, total: number, verified?: boolean): VocabAnswer[] {
  return Array.from({ length: total }, (_, i) => ({ w: `${band}${i}`, band, yes: i < yes, verified: i < yes ? verified : undefined }))
}

describe('план теста словаря', () => {
  it('по 8 слов и 2 псевдослова на полосу, псевдослова не повторяются', () => {
    const plan = vocabPlan(content.intake, 42)
    expect(plan).toHaveLength(bands().length * (WORDS_PER_BAND + PSEUDO_PER_BAND))
    const pseudo = plan.filter((p) => p.band === 'pseudo').map((p) => p.w)
    expect(new Set(pseudo).size).toBe(pseudo.length)
    for (const b of bands()) expect(plan.filter((p) => p.band === b.id)).toHaveLength(WORDS_PER_BAND)
  })

  it('разный seed — разные слова, одинаковый — тот же план', () => {
    expect(vocabPlan(content.intake, 1)).toEqual(vocabPlan(content.intake, 1))
    expect(vocabPlan(content.intake, 1)).not.toEqual(vocabPlan(content.intake, 2))
  })

  it('проверка перевода: первое «знаю» в полосе — всегда, дальше через одно', () => {
    const d: IntakeDraft = newDraft(content.intake, 1)
    expect(shouldVerify(d, 'ngsl1')).toBe(true)
    d.vocab.push({ w: 'a', band: 'ngsl1', yes: true, verified: true })
    expect(shouldVerify(d, 'ngsl1')).toBe(false)
    d.vocab.push({ w: 'b', band: 'ngsl1', yes: true })
    expect(shouldVerify(d, 'ngsl1')).toBe(true)
    expect(shouldVerify(d, 'pseudo')).toBe(false)
  })

  it('варианты перевода: 4 разных, верный на месте answer', () => {
    const { options, answer } = translationOptions(content.intake, 'country', rng(3))
    expect(options).toHaveLength(4)
    expect(new Set(options).size).toBe(4)
    expect(options[answer]).toBe('страна')
  })
})

describe('подсчёт словаря', () => {
  it('без ложных «знаю» доля полосы — доля «знаю»', () => {
    const r = bandRates([...vocab('ngsl1', 6, 8), { w: 'x', band: 'pseudo', yes: false }], bands())
    expect(r.bands.find((b) => b.band === 'ngsl1')!.rate).toBeCloseTo(0.75)
    expect(r.falseAlarm).toBe(0)
  })

  it('«знаю» на псевдослова снижает оценку', () => {
    const answers = [...vocab('ngsl1', 6, 8), { w: 'x', band: 'pseudo' as const, yes: true }, { w: 'y', band: 'pseudo' as const, yes: false }]
    const r = bandRates(answers, bands())
    expect(r.falseAlarm).toBe(0.5)
    expect(r.bands.find((b) => b.band === 'ngsl1')!.rate).toBeCloseTo(0.5) // (0.75 − 0.5) / 0.5
  })

  it('проваленная проверка перевода не засчитывается и снижает непроверенные «знаю»', () => {
    const answers: VocabAnswer[] = [
      { w: 'a', band: 'ngsl2', yes: true, verified: false },
      { w: 'b', band: 'ngsl2', yes: true, verified: true },
      { w: 'c', band: 'ngsl2', yes: true },
      { w: 'd', band: 'ngsl2', yes: false },
    ]
    const r = bandRates(answers, bands())
    expect(r.verifyPass).toBe(0.5)
    expect(r.bands.find((b) => b.band === 'ngsl2')!.rate).toBeCloseTo((1 + 0.5) / 4)
  })

  it('адаптивная остановка: первую полосу проходим всегда, дальше — от 25%', () => {
    expect(continueAfterBand({ band: 'ngsl1', asked: 8, rate: 0, known: 0, skipped: false }, 0)).toBe(true)
    expect(continueAfterBand({ band: 'ngsl3', asked: 8, rate: 0.2, known: 0, skipped: false }, 2)).toBe(false)
    expect(continueAfterBand({ band: 'ngsl3', asked: 8, rate: 0.3, known: 0, skipped: false }, 2)).toBe(true)
  })
})

describe('аудирование', () => {
  it('лестница скоростей: вверх при верном ответе, вниз при ошибке, в пределах 0.75–1.25', () => {
    expect(nextSpeed(0.75, true)).toBe(1)
    expect(nextSpeed(1, true)).toBe(1.25)
    expect(nextSpeed(1.25, true)).toBe(1.25)
    expect(nextSpeed(1, false)).toBe(0.75)
    expect(nextSpeed(0.75, false)).toBe(0.75)
  })

  it('балл и «комфортная скорость»', () => {
    const r = listeningScore([
      { id: '1', speed: 0.75, accent: 'us', tag: 'weak', correct: true },
      { id: '2', speed: 1, accent: 'gb', tag: 'linking', correct: true },
      { id: '3', speed: 1.25, accent: 'us', tag: 'elision', correct: false },
      { id: '4', speed: 1, accent: 'gb', tag: 'weak', correct: true },
    ])
    expect(r.comfort).toBe(1)
    expect(r.byAccent.gb).toEqual({ correct: 2, total: 2 })
    expect(r.score).toBeGreaterThan(40)
    expect(r.score).toBeLessThan(60)
  })

  it('ничего не понял — комфортной скорости нет', () => {
    expect(listeningScore([{ id: '1', speed: 0.75, accent: 'us', tag: 'weak', correct: false }]).comfort).toBeNull()
  })
})

describe('чтение и говорение', () => {
  it('второй текст — только если первый понят на 2 из 3', () => {
    expect(needsHarderText({ id: 'a', level: 1, correct: 2, total: 3, seconds: 60, words: 100 })).toBe(true)
    expect(needsHarderText({ id: 'a', level: 1, correct: 1, total: 3, seconds: 60, words: 100 })).toBe(false)
  })

  it('говорение без микрофона — по самооценке, с записью — учитывает паузу до начала и длительность', () => {
    expect(speakingScore([{ id: '1', self: 4 }]).score).toBe(100)
    expect(speakingScore([{ id: '1', self: 1 }]).score).toBe(0)
    const fast = speakingScore([{ id: '1', self: 3, latencyMs: 1500, speechMs: 35_000 }])
    const slow = speakingScore([{ id: '1', self: 3, latencyMs: 9000, speechMs: 4000 }])
    expect(fast.score).toBeGreaterThan(slow.score)
    expect(fast.measured).toBe(true)
  })
})

describe('итоговый профиль', () => {
  function draft(strength: 'weak' | 'strong'): IntakeDraft {
    const d = newDraft(content.intake, 7)
    const s = strength === 'strong'
    for (const b of bands()) d.vocab.push(...vocab(b.id, s ? 8 : b.id === 'ngsl1' ? 4 : 0, 8, true))
    d.vocab.push({ w: 'p', band: 'pseudo', yes: false })
    d.listening = content.intake.listening.map((l, i) => ({ id: l.id, speed: s ? 1.25 : 0.75, accent: l.voice.slice(0, 2), tag: l.tag, correct: s || i === 0 }))
    d.pairs = content.intake.pairs.map((p) => ({ id: p.id, tag: p.tag, correct: s }))
    d.reading = s
      ? [
          { id: 'ir-1', level: 1, correct: 3, total: 3, seconds: 40, words: 100 },
          { id: 'ir-2', level: 2, correct: 3, total: 3, seconds: 60, words: 130 },
        ]
      : [{ id: 'ir-1', level: 1, correct: 1, total: 3, seconds: 120, words: 100 }]
    d.speaking = content.intake.speaking.map((q) => ({ id: q.id, self: s ? 4 : 1 }))
    return d
  }

  it('сильный профиль — C1, слабый — A1; баллы треков 0–100', () => {
    const strong = computeResult(draft('strong'), bands())
    const weak = computeResult(draft('weak'), bands())
    expect(strong.cefr).toBe('C1')
    expect(weak.cefr).toBe('A1')
    for (const r of [strong, weak]) for (const v of Object.values(r.tracks)) expect(v).toBeGreaterThanOrEqual(0)
    for (const v of Object.values(strong.tracks)) expect(v).toBeLessThanOrEqual(100)
    expect(strong.tracks.air).toBeGreaterThan(weak.tracks.air)
    expect(weak.weakTags).toContain('th')
  })

  it('уровень трека и стартовый модуль', () => {
    expect([0, 19, 20, 59, 80, 100].map(trackLevel)).toEqual([1, 1, 2, 3, 5, 5])
    const air = modulesByTrack.get('air')!
    expect(startModule(air, 0, [])?.id).toBe('air-weak')
    expect(startModule(air, 90, [])?.id).toBe('air-fast')
    // ошибка в уподоблении тянет старт назад, к этому модулю
    expect(startModule(air, 90, ['assimilation'])?.id).toBe('air-assim')
    // слабое место дальше стартового модуля старт не сдвигает
    expect(startModule(air, 0, ['contraction'])?.id).toBe('air-weak')
  })
})
