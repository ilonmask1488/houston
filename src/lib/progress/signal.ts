/*
  «Уровень сигнала» — очки прогресса. Растёт вместе с понятностью речи: больше всего дают
  сказанное вслух и понятое на слух на настоящей скорости. Вся формула здесь, чтобы её было легко менять.
*/

export const SIGNAL = {
  perMinute: 2,
  correct: 5,
  /** попытка тоже считается: ошибка — не проигрыш */
  wrong: 1,
  /** за каждые 10 секунд, сказанных вслух */
  spoken10s: 3,
  /** начал отвечать вовремя (быстрый ответ) */
  onTime: 4,
  /** понял на скорости 1.0 и выше — бонус к верному ответу */
  fastBonus: 3,
  exerciseComplete: 20,
  bossPassed: 150,
  intake: 100,
  comboStep: 1,
} as const

export function signalFor(r: { seconds: number; correct: number; wrong: number; spokenMs?: number; onTime?: number; fast?: number; complete?: boolean }): number {
  return Math.round(
    (r.seconds / 60) * SIGNAL.perMinute +
      r.correct * SIGNAL.correct +
      r.wrong * SIGNAL.wrong +
      Math.floor((r.spokenMs ?? 0) / 10_000) * SIGNAL.spoken10s +
      (r.onTime ?? 0) * SIGNAL.onTime +
      (r.fast ?? 0) * SIGNAL.fastBonus +
      (r.complete ? SIGNAL.exerciseComplete : 0),
  )
}

/** Множитель комбо в играх: ×2 после 5 верных подряд, ×3 после 10. */
export function comboMultiplier(streak: number): 1 | 2 | 3 {
  return streak >= 10 ? 3 : streak >= 5 ? 2 : 1
}

/** Шкала индикатора на главном экране: 0–10 делений по сумме сигнала (логарифмически — растёт всю жизнь). */
export function signalBars(total: number): number {
  if (total <= 0) return 0
  return Math.max(1, Math.min(10, Math.floor(Math.log2(total / 50 + 1) * 1.6)))
}
