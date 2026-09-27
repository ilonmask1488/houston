/* Шаги Телеграммы (ТЗ §6.4): регистр, «слишком по-русски», собрать письмо из блоков, написать самому. */
import { useMemo, useState } from 'react'
import { ClaudeButton } from '../../components/ClaudeButton'
import { PingSays } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { mailFixById, mailOrderById, mailRegisterById, mailWriteById } from '../../content'
import { pick, ru } from '../../i18n/ru'
import { sfx } from '../../lib/audio/sfx'
import { letterPrompt } from '../../lib/claude/prompt'
import { rng, shuffle } from '../../lib/intake/plan'
import type { Step } from '../../lib/run/steps'
import { hash } from '../../lib/session/session'
import { countWords } from '../../lib/speech/recognize'
import { Choice } from './Choice'
import m from './mail.module.css'
import type { StepProps } from './result'
import s from './run.module.css'

type S<K extends Step['kind']> = Extract<Step, { kind: K }>

function Next({ onClick, label = ru.run.next }: { onClick: () => void; label?: string }) {
  return (
    <div className={s.actions}>
      <button type="button" className={ui.primary} onClick={onClick}>
        {label}
      </button>
    </div>
  )
}

/* ——— Регистр ——— */

export function MailRegisterStep({ step, onDone }: StepProps<S<'mailRegister'>>) {
  const x = mailRegisterById.get(step.item)!
  const [res, setRes] = useState<{ given: string; ok: boolean } | null>(null)
  return (
    <section className={s.body}>
      <p className={`${s.kicker} mono`}>{ru.mail.registerKicker(ru.mail.register[x.want]!)}</p>
      <p className={s.prompt}>{x.situation}</p>
      <Choice label={ru.mail.pick} options={x.options} right={x.options[0]!} seed={x.id} onAnswer={(given, ok) => setRes({ given, ok })} />
      {res && (
        <>
          <PingSays mood={res.ok ? 'happy' : 'oops'} size={48}>
            {x.why}
          </PingSays>
          <Next
            onClick={() =>
              onDone({
                correct: res.ok,
                answer: { kind: 'register', track: 'mail', item: x.id, expected: x.options[0]!, given: res.given, correct: res.ok, tag: x.want },
                done: res.ok ? [{ module: x.module, item: x.id }] : undefined,
              })
            }
          />
        </>
      )}
    </section>
  )
}

/* ——— «Слишком по-русски» ——— */

export function MailFixStep({ step, onDone }: StepProps<S<'mailFix'>>) {
  const x = mailFixById.get(step.item)!
  const [res, setRes] = useState<{ given: string; ok: boolean } | null>(null)
  return (
    <section className={s.body}>
      <p className={`${s.kicker} mono`}>
        {ru.mail.fixKicker} · {x.context}
      </p>
      <p className={m.bad} lang="en">
        {x.bad}
      </p>
      <p className={s.prompt}>{ru.mail.fixPrompt}</p>
      <Choice label={ru.mail.fixPrompt} options={x.options} right={x.options[0]!} seed={x.id} onAnswer={(given, ok) => setRes({ given, ok })} />
      {res && (
        <>
          <PingSays mood={res.ok ? 'happy' : 'oops'} size={48}>
            {x.why}
          </PingSays>
          <Next
            onClick={() =>
              onDone({
                correct: res.ok,
                answer: { kind: 'fix', track: 'mail', item: x.id, expected: x.options[0]!, given: res.given, correct: res.ok, tag: x.module },
                done: res.ok ? [{ module: x.module, item: x.id }] : undefined,
              })
            }
          />
        </>
      )}
    </section>
  )
}

/* ——— Собрать письмо из блоков ——— */

export function MailOrderStep({ step, onDone }: StepProps<S<'mailOrder'>>) {
  const x = mailOrderById.get(step.item)!
  const [round, setRound] = useState(0)
  const pool = useMemo(() => shuffle(x.blocks, rng(hash(`${x.id}:${round}`))), [x, round])
  const [placed, setPlaced] = useState<string[]>([])
  const [checked, setChecked] = useState(false)
  const [firstTry, setFirstTry] = useState<boolean | null>(null)
  const ok = placed.every((b, i) => x.blocks[i] === b)
  const left = pool.filter((b) => !placed.includes(b))
  const check = () => {
    setChecked(true)
    sfx(ok ? 'correct' : 'wrong')
    if (firstTry === null) setFirstTry(ok)
  }
  return (
    <section className={s.body}>
      <p className={s.prompt}>{x.title}</p>
      <p className={s.hint}>{ru.mail.orderHint}</p>
      <ol className={m.letter} aria-label={ru.mail.yourLetter}>
        {placed.length === 0 && <li className={m.empty}>{ru.mail.orderEmpty}</li>}
        {placed.map((b, i) => (
          <li key={b}>
            <button
              type="button"
              lang="en"
              className={m.placed}
              disabled={checked}
              data-state={checked ? (x.blocks[i] === b ? 'right' : 'wrong') : undefined}
              onClick={() => setPlaced(placed.filter((p) => p !== b))}
            >
              {b}
            </button>
          </li>
        ))}
      </ol>
      {!checked && left.length > 0 && (
        <div className={m.pool} role="group" aria-label={ru.mail.orderKicker}>
          {left.map((b) => (
            <button key={b} type="button" lang="en" className={m.block} onClick={() => setPlaced([...placed, b])}>
              {b}
            </button>
          ))}
        </div>
      )}
      {!checked && left.length === 0 && (
        <Next label={ru.mail.check} onClick={check} />
      )}
      {checked && (
        <>
          <PingSays mood={ok ? 'celebrate' : 'oops'} size={48}>
            {ok ? ru.mail.orderOk : ru.mail.orderWrong}
          </PingSays>
          {!ok && (
            <ol className={m.model} lang="en">
              {x.blocks.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ol>
          )}
          {!ok && (
            <button
              type="button"
              className={ui.secondary}
              onClick={() => {
                setPlaced([])
                setChecked(false)
                setRound((n) => n + 1)
              }}
            >
              {ru.mail.retry}
            </button>
          )}
          <Next
            onClick={() =>
              onDone({
                correct: !!firstTry,
                answer: { kind: 'order', track: 'mail', item: x.id, expected: '', given: placed.join(' | '), correct: !!firstTry, tag: x.module },
                done: ok ? [{ module: x.module, item: x.id }] : undefined,
              })
            }
          />
        </>
      )}
    </section>
  )
}

/* ——— Написать самому ——— */

export function MailWriteStep({ step, onDone }: StepProps<S<'mailWrite'>>) {
  const x = mailWriteById.get(step.item)!
  const [text, setText] = useState('')
  const [compared, setCompared] = useState(false)
  const [ticks, setTicks] = useState<Set<number>>(new Set())
  const [line] = useState(() => pick(ru.lines.correct))
  const words = countWords(text)
  const situation = x.incoming ? `${x.task}\nВходящее письмо:\n${x.incoming}` : x.task
  return (
    <section className={s.body}>
      <p className={s.prompt}>{x.task}</p>
      {x.incoming && (
        <figure className={m.incoming}>
          <figcaption className={s.hint}>{ru.mail.incoming}</figcaption>
          <p className={m.pre} lang="en">
            {x.incoming}
          </p>
        </figure>
      )}
      <label className={m.label}>
        <span className="mono">
          {ru.mail.yourLetter} · {ru.mail.words(words)}
        </span>
        <textarea className={m.area} lang="en" rows={9} value={text} readOnly={compared} placeholder={ru.mail.placeholder} onChange={(e) => setText(e.target.value)} />
      </label>
      {!compared ? (
        <Next label={ru.mail.compare} onClick={() => setCompared(true)} />
      ) : (
        <>
          <figure className={m.incoming} data-model>
            <figcaption className={s.hint}>{ru.mail.model}</figcaption>
            <p className={m.pre} lang="en">
              {x.model}
            </p>
          </figure>
          <fieldset className={m.checklist}>
            <legend>{ru.mail.checklist}</legend>
            {x.checklist.map((c, i) => (
              <label key={c}>
                <input
                  type="checkbox"
                  checked={ticks.has(i)}
                  onChange={() => {
                    const n = new Set(ticks)
                    if (n.has(i)) n.delete(i)
                    else n.add(i)
                    setTicks(n)
                  }}
                />{' '}
                {c}
              </label>
            ))}
          </fieldset>
          {text.trim() && (
            <ClaudeButton
              label={ru.mail.checkClaude}
              build={() => letterPrompt({ situation, register: x.module === 'boss-mail' ? 'формальный, но тёплый' : 'нейтральный деловой', letter: text.trim() })}
            />
          )}
          {ticks.size === x.checklist.length && <PingSays size={48}>{line}</PingSays>}
          <Next
            onClick={() =>
              onDone({
                correct: ticks.size >= Math.ceil(x.checklist.length * 0.7),
                answer: { kind: 'letter', track: 'mail', item: x.id, expected: String(x.checklist.length), given: text, correct: ticks.size >= Math.ceil(x.checklist.length * 0.7), tag: x.module },
                done: text.trim() ? [{ module: x.module, item: x.id }] : undefined,
              })
            }
          />
        </>
      )}
    </section>
  )
}
