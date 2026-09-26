import { describe, expect, it } from 'vitest'
import { analyzeFrames, statsFromText, threshold, type Frame } from './vad'

/** Кадры каждые 50 мс: тишина −60 дБ, голос −25 дБ на интервалах speech. */
function frames(totalMs: number, speech: [number, number][]): Frame[] {
  const out: Frame[] = []
  for (let t = 0; t <= totalMs; t += 50) out.push({ t, db: speech.some(([a, b]) => t >= a && t < b) ? -25 : -60 })
  return out
}

describe('детектор речи', () => {
  it('порог — от шума в начале записи', () => {
    expect(threshold(frames(1000, []))).toBe(-48)
  })

  it('начало ответа, длительность и длинные паузы', () => {
    const s = analyzeFrames(frames(20_000, [[2000, 6000], [6200, 9000], [12_000, 15_000]]))
    expect(s.startMs).toBe(2000)
    expect(s.longPauses).toBe(1) // 9000 → 12000
    expect(s.maxPauseMs).toBe(3000)
    expect(s.speechMs).toBe(10_000) // 2000–9000 склеено (пауза 200 мс) + 3000
  })

  it('короткие щелчки не считаются речью', () => {
    const s = analyzeFrames(frames(5000, [[1000, 1100]]))
    expect(s.startMs).toBeUndefined()
    expect(s.speechMs).toBe(0)
  })

  it('без записи — оценка по моментам распознанного текста', () => {
    const s = statsFromText(1500, [1500, 2000, 2600, 6000, 6500])
    expect(s).toMatchObject({ startMs: 1500, speechMs: 5000, longPauses: 1 })
    expect(statsFromText(undefined, []).speechMs).toBe(0)
  })
})
