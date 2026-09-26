import { describe, expect, it } from 'vitest'
import { extractPitch, median, semitones, toCurve } from './pitch'

const SR = 16000

/** Синтетический «голос»: основной тон с парой гармоник, частота меняется от f0 к f1. */
function glide(f0: number, f1: number, seconds: number): Float32Array {
  const n = Math.round(SR * seconds)
  const out = new Float32Array(n)
  let phase = 0
  for (let i = 0; i < n; i++) {
    const f = f0 + ((f1 - f0) * i) / n
    phase += (2 * Math.PI * f) / SR
    out[i] = 0.5 * Math.sin(phase) + 0.25 * Math.sin(2 * phase) + 0.1 * Math.sin(3 * phase)
  }
  return out
}

describe('кривая основного тона', () => {
  it('ровный тон 200 Гц находится точно', () => {
    const pts = extractPitch(glide(200, 200, 0.5), SR)
    expect(pts.length).toBeGreaterThan(20)
    expect(median(pts.map((p) => p.hz))).toBeCloseTo(200, -0.5)
  })

  it('восходящий (2-й тон) идёт вверх, нисходящий (4-й) — вниз', () => {
    const up = toCurve(extractPitch(glide(160, 260, 0.5), SR)).filter((p) => p !== null)
    const down = toCurve(extractPitch(glide(300, 150, 0.5), SR)).filter((p) => p !== null)
    expect(up.at(-1)!.st - up[0]!.st).toBeGreaterThan(5)
    expect(down.at(-1)!.st - down[0]!.st).toBeLessThan(-7)
  })

  it('мужской и женский голос с одинаковой мелодией дают одну кривую', () => {
    const man = toCurve(extractPitch(glide(110, 165, 0.4), SR)).filter((p) => p !== null)
    const woman = toCurve(extractPitch(glide(220, 330, 0.4), SR)).filter((p) => p !== null)
    expect(man.at(-1)!.st - man[0]!.st).toBeCloseTo(woman.at(-1)!.st - woman[0]!.st, 0)
  })

  it('тишина — пустой график, пауза — разрыв линии', () => {
    expect(extractPitch(new Float32Array(SR / 2), SR)).toEqual([])
    const withPause = new Float32Array([...glide(200, 200, 0.3), ...new Float32Array(SR * 0.3), ...glide(250, 250, 0.3)])
    const curve = toCurve(extractPitch(withPause, SR))
    expect(curve).toContain(null)
    expect(curve[0]!.x).toBe(0)
    expect(curve.at(-1)!.x).toBe(1)
  })

  it('полутоны: октава = 12', () => {
    expect(semitones(440, 220)).toBeCloseTo(12)
    expect(semitones(220, 220)).toBe(0)
  })
})
