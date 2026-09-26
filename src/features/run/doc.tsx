/* Шаги Техдока (ТЗ §6.3). */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ClaudeButton } from '../../components/ClaudeButton'
import { PlayButton } from '../../components/Play'
import { TapText } from '../../components/TapText'
import { PingSays } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { VoiceAnswer, VoiceReport, type VoiceResult } from '../../components/Voice'
import { textById } from '../../content'
import type { DocText } from '../../content/types'
import { pick, ru } from '../../i18n/ru'
import { defaultVoice, durationOf } from '../../lib/audio/audio'
import { sfx } from '../../lib/audio/sfx'
import { explainPrompt } from '../../lib/claude/prompt'
import { rng, shuffle } from '../../lib/intake/plan'
import type { Step } from '../../lib/run/steps'
import { hash } from '../../lib/session/session'
import { countWords } from '../../lib/speech/recognize'
import { splitSentences } from '../../lib/story/text'
import type { StepProps } from './result'
import s from './run.module.css'
import d from './doc.module.css'

type S<K extends Step['kind']> = Extract<Step, { kind: K }>

export function Meta({ t }: { t: DocText }) {
  return (
    <p className={`${s.kicker} mono`}>
      {t.kind} · {ru.doc.level(t.level)} · {ru.topics[t.topic]}
    </p>
  )
}

/** Время на поиск ответа: чем сложнее текст, тем меньше — как в реальном чтении по диагонали. */
function findSeconds(t: DocText): number {
  return t.level === 1 ? 60 : t.level === 2 ? 45 : 30
}

/* ——— Чтение ——— */

export function DocReadStep({ step, onDone }: StepProps<S<'docRead'>>) {
  const t = textById.get(step.text)!
  const started = useRef(Date.now())
  const [sec, setSec] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setSec(Math.round((Date.now() - started.current) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])
  const words = useMemo(() => countWords(t.paragraphs.join(' ')), [t])
  return (
    <section className={s.body}>
      <Meta t={t} />
      <h1 lang="en">{t.title}</h1>
      <p className={s.hint}>{ru.doc.readHint}</p>
      <article className={d.article}>
        {t.paragraphs.map((p, i) => (
          <div key={i} className={d.para}>
            <p>
              <TapText text={p} />
            </p>
            <ClaudeButton label={ru.doc.explain} build={() => explainPrompt(p)} />
          </div>
        ))}
      </article>
      <p className={`${d.source}`}>
        {ru.doc.source}: {t.source}
      </p>
      <div className={s.actions}>
        <p className={`${s.hint} mono`}>{ru.doc.timer(sec, words)}</p>
        <button
          type="button"
          className={ui.primary}
          onClick={() =>
            onDone({
              answer: { kind: 'read', track: 'doc', item: t.id, expected: String(words), given: String(sec), correct: true, speechMs: sec * 1000, tag: t.kind },
            })
          }
        >
          {ru.doc.read}
        </button>
      </div>
    </section>
  )
}

/* ——— Найти ответ на время ——— */

export function DocFindStep({ step, onDone }: StepProps<S<'docFind'>>) {
  const t = textById.get(step.text)!
  const f = t.find[step.i]!
  const limit = step.seconds ?? findSeconds(t)
  const sentences = useMemo(() => t.paragraphs.map((p) => splitSentences(p)), [t])
  const [left, setLeft] = useState(limit)
  const [picked, setPicked] = useState<string | null>(null)
  const [timeout, setTimeoutHit] = useState(false)
  const started = useRef(Date.now())
  useEffect(() => {
    if (picked !== null) return
    const timer = setInterval(() => {
      const l = Math.max(0, limit - Math.floor((Date.now() - started.current) / 1000))
      setLeft(l)
      if (l === 0) {
        setTimeoutHit(true)
        clearInterval(timer)
      }
    }, 250)
    return () => clearInterval(timer)
  }, [limit, picked])
  const isAnswer = (x: string) => x.toLowerCase().includes(f.key.toLowerCase())
  const answered = picked !== null || timeout
  const ok = picked !== null && isAnswer(picked)
  const [wrongLine] = useState(() => pick(ru.lines.wrong))
  // Текст длинный — после ответа показать итог и «Дальше», не заставляя листать
  const feedback = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (answered) feedback.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [answered])
  return (
    <section className={s.body}>
      <Meta t={t} />
      <div className={d.findHead}>
        <p className={s.prompt} lang="en">
          {f.q}
        </p>
        <span className={`${d.clock} mono`} data-low={left <= 10 || undefined} aria-label={ru.doc.left(left)}>
          {String(left).padStart(2, '0')}
        </span>
      </div>
      <p className={s.hint}>{ru.doc.findHint}</p>
      <article className={d.article} lang="en" role="group" aria-label={ru.doc.findGroup}>
        {sentences.map((ps, pi) => (
          <p key={pi}>
            {ps.map((x, k) => (
              <button
                key={k}
                type="button"
                className={d.sentence}
                disabled={answered}
                data-state={answered ? (isAnswer(x) ? 'right' : x === picked ? 'wrong' : undefined) : undefined}
                onClick={() => {
                  setPicked(x)
                  sfx(isAnswer(x) ? 'correct' : 'wrong')
                }}
              >
                {x}{' '}
              </button>
            ))}
          </p>
        ))}
      </article>
      {answered && (
        <>
          <PingSays mood={ok ? 'happy' : 'oops'} size={48}>
            {ok ? ru.doc.found(limit - left) : timeout && picked === null ? ru.doc.timeUp : wrongLine}
          </PingSays>
          <div className={s.actions} ref={feedback}>
            <button
              type="button"
              className={ui.primary}
              onClick={() =>
                onDone({
                  correct: ok,
                  answer: { kind: 'find', track: 'doc', item: `${t.id}#${step.i}`, expected: f.key, given: picked ?? '', correct: ok, latencyMs: (limit - left) * 1000, tag: t.module },
                })
              }
            >
              {ru.run.next}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

/* ——— Лучшее краткое содержание абзаца ——— */

export function DocSummaryStep({ step, onDone }: StepProps<S<'docSummary'>>) {
  const t = textById.get(step.text)!
  const p = t.paragraphs[step.p]!
  const right = t.summaries[step.p]![0]!
  const options = useMemo(() => shuffle(t.summaries[step.p]!, rng(hash(`${t.id}:${step.p}`))), [t, step.p])
  const [given, setGiven] = useState<string | null>(null)
  return (
    <section className={s.body}>
      <Meta t={t} />
      <p className={s.prompt}>{ru.doc.summary}</p>
      <article className={d.article}>
        <p>
          <TapText text={p} />
        </p>
      </article>
      <div className={s.options} role="group" aria-label={ru.doc.summary}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            lang="en"
            className={s.option}
            disabled={given !== null}
            data-state={given === null ? undefined : o === right ? 'right' : o === given ? 'wrong' : undefined}
            onClick={() => {
              setGiven(o)
              sfx(o === right ? 'correct' : 'wrong')
            }}
          >
            {o}
          </button>
        ))}
      </div>
      {given !== null && (
        <div className={s.actions}>
          <button
            type="button"
            className={ui.primary}
            onClick={() => onDone({ correct: given === right, answer: { kind: 'summary', track: 'doc', item: `${t.id}#${step.p}`, expected: right, given, correct: given === right, tag: t.module } })}
          >
            {ru.run.next}
          </button>
        </div>
      )}
    </section>
  )
}

/* ——— Перескажи абзац вслух ——— */

export function DocRetellStep({ step, onDone }: StepProps<S<'docRetell'>>) {
  const t = textById.get(step.text)!
  const p = t.paragraphs[step.p]!
  const model = t.retell[step.p]!
  const voice = defaultVoice()
  const [result, setResult] = useState<VoiceResult | undefined>(undefined)
  return (
    <section className={s.body}>
      <Meta t={t} />
      <p className={s.prompt}>{ru.doc.retell}</p>
      <article className={d.article}>
        <p>
          <TapText text={p} />
        </p>
      </article>
      {result === undefined ? (
        <>
          <p className={s.hint}>{ru.doc.retellHint}</p>
          <VoiceAnswer maxSeconds={45} onResult={setResult} />
        </>
      ) : (
        <>
          <VoiceReport result={result} />
          <div className={s.feedback} data-ok>
            <span className={s.hint}>{ru.doc.model}</span>
            <p className={s.phrase}>
              <PlayButton text={model} voice={voice} label={model} size="s" /> <span lang="en">{model}</span>
            </p>
          </div>
          <div className={s.actions}>
            <button
              type="button"
              className={ui.primary}
              onClick={() =>
                onDone({
                  spokenMs: result && (result.recorded || result.recognized) ? result.speechMs : durationOf(model, voice),
                  answer: { kind: 'retell', track: 'doc', item: `${t.id}#${step.p}`, expected: model, given: result?.transcript ?? '', correct: true, speechMs: result?.speechMs, tag: t.module },
                  done: [{ module: t.module, item: t.id }],
                })
              }
            >
              {ru.run.next}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

/* ——— Разбор сложного предложения ——— */

export function DocParseStep({ step, onDone }: StepProps<S<'docParse'>>) {
  const t = textById.get(step.text)!
  const x = t.parse
  const right = x.options[x.answer]!
  const options = useMemo(() => shuffle(x.options, rng(hash(`${t.id}:parse`))), [t, x])
  const [given, setGiven] = useState<string | null>(null)
  return (
    <section className={s.body}>
      <p className={`${s.kicker} mono`}>{ru.doc.parse}</p>
      <p className={d.bigSentence} lang="en">
        {x.sentence}
      </p>
      <div className={s.options} role="group" aria-label={ru.doc.parseGroup}>
        <p className={s.prompt} lang="en">
          {x.q}
        </p>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            lang="en"
            className={s.option}
            disabled={given !== null}
            data-state={given === null ? undefined : o === right ? 'right' : o === given ? 'wrong' : undefined}
            onClick={() => {
              setGiven(o)
              sfx(o === right ? 'correct' : 'wrong')
            }}
          >
            {o}
          </button>
        ))}
      </div>
      {given !== null && (
        <>
          <table className={d.parts}>
            <tbody>
              {x.parts.map(([en, expl]) => (
                <tr key={en}>
                  <th lang="en">{en}</th>
                  <td>{expl}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={s.actions}>
            <button
              type="button"
              className={ui.primary}
              onClick={() =>
                onDone({
                  correct: given === right,
                  answer: { kind: 'parse', track: 'doc', item: t.id, expected: right, given, correct: given === right, tag: 'doc-grammar' },
                  done: given === right && t.module === 'doc-grammar' ? [{ module: 'doc-grammar', item: t.id }] : undefined,
                })
              }
            >
              {ru.run.next}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
