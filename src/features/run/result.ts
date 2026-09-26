import type { AnswerRow } from '../../lib/db/types'

/** Что сообщает шаг, когда закончен. Раннер записывает ответы, прогресс модулей, карточки и сигнал. */
export type StepResult = {
  /** для точности: был ли ответ верным */
  correct?: boolean
  answer?: Omit<AnswerRow, 'id' | 'at' | 'source'>
  /** сколько сказано вслух, мс (по записи; без записи — оценка) */
  spokenMs?: number
  /** начал ответ вовремя */
  onTime?: boolean
  /** понял на скорости 1.0 и выше */
  fast?: boolean
  /** упражнение модуля сделано */
  done?: { module: string; item: string }[]
  /** изучен чанк — завести карточки */
  chunkLearned?: string
  /** фраза не поймана — вернуть её карточкой на слух */
  missedPhrase?: string
}

export type StepProps<S> = { step: S; onDone: (r: StepResult) => void }
