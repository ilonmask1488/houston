/*
  Приборы пульта связи: индикатор уровня сигнала, табло, индикатор громкости, шкала скоростей.
  Янтарный «сигнал» — единственный яркий цвет интерфейса, и живёт он здесь.
*/
import type { ReactNode } from 'react'
import s from './Instruments.module.css'

/** Столбики уровня сигнала (как на телефоне, но на пульте). value — сколько из total горит. */
export function SignalMeter({ value, total = 10, label, size = 'm' }: { value: number; total?: number; label: string; size?: 's' | 'm' | 'l' }) {
  return (
    <span className={`${s.meter} ${s[size]}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={s.bar} data-on={i < value || undefined} style={{ height: `${30 + (70 * (i + 1)) / total}%` }} />
      ))}
    </span>
  )
}

/** Табло: подпись сверху, показание моноширинным. */
export function Readout({ label, value, unit, hint }: { label: string; value: ReactNode; unit?: string; hint?: string }) {
  return (
    <div className={s.readout}>
      <span className={s.readoutLabel}>{label}</span>
      <span className={s.readoutValue}>
        {value}
        {unit && <span className={s.unit}> {unit}</span>}
      </span>
      {hint && <span className={s.readoutHint}>{hint}</span>}
    </div>
  )
}

/** Живой индикатор громкости микрофона: level 0..1. */
export function LevelMeter({ level, label }: { level: number; label: string }) {
  const n = 16
  const on = Math.round(level * n)
  return (
    <span className={s.level} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} data-on={i < on || undefined} data-hot={i >= n - 3 || undefined} />
      ))}
    </span>
  )
}

/** Шкала скоростей 0.75 → 1.0 → 1.25 со стрелкой на текущей. */
export function SpeedScale({ speeds, current, label }: { speeds: number[]; current: number; label: string }) {
  const i = Math.max(0, speeds.indexOf(current))
  return (
    <div className={s.scale} aria-label={label}>
      <div className={`${s.scaleTrack} scale-rule`}>
        <span className={s.needle} style={{ left: `${(100 * (i + 0.5)) / speeds.length}%` }} aria-hidden />
      </div>
      <div className={s.scaleLabels}>
        {speeds.map((sp) => (
          <span key={sp} data-on={sp === current || undefined} className="mono">
            {sp.toFixed(2).replace(/0$/, '')}×
          </span>
        ))}
      </div>
    </div>
  )
}

/** Полоса прогресса по делениям — шаги теста или упражнения. */
export function StepTicks({ total, done, label }: { total: number; done: number; label: string }) {
  return (
    <span className={s.ticks} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} data-on={i < done || undefined} />
      ))}
    </span>
  )
}

/** Горизонтальная шкала балла 0–100 (профиль трека). */
export function ScoreBar({ value, label, marker }: { value: number; label: string; marker?: number }) {
  return (
    <span className={s.scoreBar} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <span className={s.scoreFill} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      {marker !== undefined && <span className={s.scoreMarker} style={{ left: `${marker}%` }} />}
    </span>
  )
}
