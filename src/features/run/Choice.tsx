/* Выбор одного варианта из нескольких: варианты перемешаны детерминированно, после ответа подсвечены верный и ошибка. */
import { useMemo, useState } from 'react'
import { sfx } from '../../lib/audio/sfx'
import { rng, shuffle } from '../../lib/intake/plan'
import { hash } from '../../lib/session/session'
import s from './run.module.css'

export function Choice({
  label,
  options,
  right,
  seed,
  lang = 'en',
  onAnswer,
}: {
  label: string
  options: string[]
  right: string
  seed: string
  lang?: string
  onAnswer: (given: string, ok: boolean) => void
}) {
  const shown = useMemo(() => shuffle(options, rng(hash(seed))), [options, seed])
  const [given, setGiven] = useState<string | null>(null)
  return (
    <div className={s.options} role="group" aria-label={label}>
      {shown.map((o) => (
        <button
          key={o}
          type="button"
          lang={lang}
          className={s.option}
          disabled={given !== null}
          data-state={given === null ? undefined : o === right ? 'right' : o === given ? 'wrong' : undefined}
          onClick={() => {
            setGiven(o)
            sfx(o === right ? 'correct' : 'wrong')
            onAnswer(o, o === right)
          }}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
