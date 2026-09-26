/*
  График высоты тона: образец и твоя запись двумя линиями (ТЗ §7.4).
  Грузится лениво — pitchy и разбор звука нужны только тем, кто открыл график.
*/
import { useEffect, useState } from 'react'
import { ru } from '../i18n/ru'
import { curvesOf, DecodeError, type CurvePoint } from '../lib/pitch/pitch'
import s from './PitchChart.module.css'

const W = 320
const H = 150
const PAD = 12
/** Полутоны от медианы, которые помещаются на график. */
const RANGE = 9

type State = { sample: CurvePoint[]; mine: CurvePoint[] } | 'loading' | { error: string }

export default function PitchChart({ sampleUrl, mineUrl }: { sampleUrl: string; mineUrl: string }) {
  const [state, setState] = useState<State>('loading')
  useEffect(() => {
    let alive = true
    setState('loading')
    curvesOf(sampleUrl, mineUrl).then(
      (curves) => alive && setState(curves),
      (e: unknown) => {
        if (!alive) return
        const t = ru.pitch
        setState({ error: e instanceof DecodeError ? (e.what === 'mine' ? t.errorMine(e.code) : t.errorSample(e.code)) : t.errorMine(String(e)) })
      },
    )
    return () => {
      alive = false
    }
  }, [sampleUrl, mineUrl])

  const t = ru.pitch
  if (state === 'loading') return <p className={s.note}>{t.loading}</p>
  if ('error' in state) return <p className={s.note}>{state.error}</p>
  const empty = !state.mine.some(Boolean)

  return (
    <figure className={s.figure} data-testid="pitch-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className={s.svg} role="img" aria-label={t.aria}>
        {[-6, 0, 6].map((st) => (
          <line key={st} x1={PAD} x2={W - PAD} y1={y(st)} y2={y(st)} className={st === 0 ? s.mid : s.grid} />
        ))}
        <text x={PAD} y={y(6) - 4} className={s.axis}>
          {t.higher}
        </text>
        <text x={PAD} y={y(-6) + 12} className={s.axis}>
          {t.lower}
        </text>
        <path d={pathOf(state.sample)} className={s.sample} />
        <path d={pathOf(state.mine)} className={s.mine} />
      </svg>
      <figcaption className={s.caption}>
        <span className={s.legend}>
          <i className={s.keySample} aria-hidden /> {t.sample}
        </span>
        <span className={s.legend}>
          <i className={s.keyMine} aria-hidden /> {t.mine}
        </span>
        <span className={s.note}>{empty ? t.noVoice : t.hint}</span>
      </figcaption>
    </figure>
  )
}

function y(st: number): number {
  const v = Math.max(-RANGE, Math.min(RANGE, st))
  return H / 2 - (v / RANGE) * (H / 2 - PAD)
}

function pathOf(curve: CurvePoint[]): string {
  let d = ''
  let pen = false
  for (const p of curve) {
    if (!p) {
      pen = false
      continue
    }
    d += `${pen ? 'L' : 'M'}${(PAD + p.x * (W - 2 * PAD)).toFixed(1)} ${y(p.st).toFixed(1)} `
    pen = true
  }
  return d.trim()
}
