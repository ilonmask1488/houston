/* Шаги Эфира: объяснение, «что прозвучало», диктант, лестница скоростей, акценты, длинный отрывок. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { SpeedScale } from '../../components/Instruments'
import { PlayButton } from '../../components/Play'
import { PingSays } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { Highlight, WordDiff } from '../../components/Voice'
import { characterById, connectedByModule, itemsByModule, moduleById, passageById, phraseById, spokenText } from '../../content'
import { accentOf, type Phrase } from '../../content/types'
import { pick, ru } from '../../i18n/ru'
import { defaultVoice, playText, stopAudio, wait } from '../../lib/audio/audio'
import { sfx } from '../../lib/audio/sfx'
import { rng, shuffle } from '../../lib/intake/plan'
import type { Step } from '../../lib/run/steps'
import { hash } from '../../lib/session/session'
import { compareWords } from '../../lib/speech/recognize'
import type { StepProps } from './result'
import s from './run.module.css'

type S<K extends Step['kind']> = Extract<Step, { kind: K }>
const fmt = (x: number) => `${x.toFixed(2).replace(/0$/, '')}×`

/* ——— Объяснение явления ——— */

export function IntroStep({ step, onDone }: StepProps<S<'intro'>>) {
  const t = ru.steps.intro
  const m = moduleById.get(step.module)
  const c = connectedByModule.get(step.module)
  const examples = (itemsByModule.get(step.module)?.phrases ?? []).slice(0, 3)
  const pairs = (itemsByModule.get(step.module)?.pairs ?? []).slice(0, 3)
  return (
    <section className={s.body}>
      <p className={s.kicker}>{m ? `${ru.tracks[m.track].title} · ${ru.tracks[m.track].alias}` : ''}</p>
      <h1>{m?.title}</h1>
      {c?.intro.map((p) => (
        <p key={p} className={s.lead}>
          {p}
        </p>
      ))}
      {!!c?.rules.length && (
        <>
          <h2 className={s.h2}>{t.rules}</h2>
          <table className={s.rules}>
            <tbody>
              {c.rules.map(([what, how, ex]) => (
                <tr key={what}>
                  <th lang="en">{what}</th>
                  <td>
                    <span className="mono">{how}</span>
                    <span className={s.ruleEx} lang="en">
                      {ex}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {examples.length > 0 && (
        <>
          <h2 className={s.h2}>{t.examples}</h2>
          <ul className={s.examples}>
            {examples.map((p) => (
              <li key={p.id}>
                <PlayButton text={spokenText(p)} voice={p.voice} label={p.text} size="s" />
                <Highlight text={p.text} focus={p.focus} />
              </li>
            ))}
          </ul>
        </>
      )}
      {pairs.length > 0 && (
        <>
          <h2 className={s.h2}>{t.examples}</h2>
          <ul className={s.examples}>
            {pairs.map((p) => (
              <li key={p.id} lang="en">
                <PlayButton text={p.a} voice={defaultVoice()} label={p.a} size="s" /> {p.a}
                <span className={s.hint}> — </span>
                <PlayButton text={p.b} voice={defaultVoice()} label={p.b} size="s" /> {p.b}
              </li>
            ))}
          </ul>
        </>
      )}
      {c?.tip && (
        <PingSays mood="wink" size={56}>
          {c.tip}
        </PingSays>
      )}
      <div className={s.actions}>
        <button type="button" className={ui.primary} onClick={() => onDone({})}>
          {t.got}
        </button>
      </div>
    </section>
  )
}

/* ——— После ответа: текст с подсветкой, перевод, послушать медленнее ——— */

function Reveal({ p, ok, speed }: { p: Phrase; ok: boolean; speed: number }) {
  const [line] = useState(() => pick(ok ? ru.lines.correct : ru.lines.wrong))
  return (
    <div className={s.feedback} data-ok={ok || undefined}>
      <PingSays mood={ok ? 'happy' : 'oops'} size={52}>
        {line}
      </PingSays>
      <p className={s.phrase}>
        <Highlight text={p.text} focus={p.focus} />
      </p>
      <p className={s.ru}>{p.ru}</p>
      <p className={s.focusNote}>
        {ru.steps.listen.focus}: <span lang="en">{p.focus}</span>
      </p>
      <div className={s.plays}>
        {[0.75, speed === 0.75 ? 1 : speed].map((sp) => (
          <span key={sp} className={s.playWith}>
            <PlayButton text={spokenText(p)} voice={p.voice} rate={sp} label={fmt(sp)} size="s" />
            <span className="mono">{fmt(sp)}</span>
          </span>
        ))}
      </div>
      <p className={s.hint}>{ru.steps.listen.shadow}</p>
    </div>
  )
}

/* ——— Что прозвучало ——— */

export function ListenStep({ step, onDone }: StepProps<S<'listen'>>) {
  const p = phraseById.get(step.phrase)!
  const voice = step.voice ?? p.voice
  const options = useMemo(() => shuffle(p.options, rng(hash(p.id))), [p])
  const [given, setGiven] = useState<number | null>(null)
  const [replays, setReplays] = useState(0)
  const play = (rate = step.speed) => void playText(spokenText(p), { voice, rate }).catch(() => {})
  useEffect(() => {
    play()
    return () => stopAudio()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const right = options.indexOf(p.text)
  const ok = given === right
  const choose = (k: number) => {
    setGiven(k)
    sfx(k === right ? 'correct' : 'wrong')
  }
  return (
    <section className={s.body}>
      <SpeedScale speeds={[0.75, 1, 1.25]} current={step.speed} label={fmt(step.speed)} />
      <div className={s.center}>
        <PlayButton text={spokenText(p)} voice={voice} rate={step.speed} label={ru.steps.listen.replay} size="l" onStart={() => setReplays((n) => n + 1)} />
      </div>
      <div className={s.options} role="group" aria-label={ru.steps.listen.title}>
        <p className={s.prompt}>{ru.steps.listen.title}</p>
        {options.map((o, k) => (
          <button
            key={o}
            type="button"
            lang="en"
            className={s.option}
            disabled={given !== null}
            data-state={given === null ? undefined : k === right ? 'right' : k === given ? 'wrong' : undefined}
            onClick={() => choose(k)}
          >
            {o}
          </button>
        ))}
        <button type="button" className={s.option} data-quiet disabled={given !== null} onClick={() => choose(-1)}>
          {ru.steps.listen.notCaught}
        </button>
        {given === null && step.speed > 0.75 && (
          <button type="button" className={ui.link} onClick={() => play(0.75)}>
            {ru.steps.listen.slower}
          </button>
        )}
      </div>
      {given !== null && (
        <>
          <Reveal p={p} ok={ok} speed={step.speed} />
          <div className={s.actions}>
            <button
              type="button"
              className={ui.primary}
              onClick={() =>
                onDone({
                  correct: ok,
                  fast: ok && step.speed >= 1,
                  answer: { kind: 'listen', track: 'air', item: p.id, expected: p.text, given: given >= 0 ? options[given]! : '', correct: ok, speed: step.speed, accent: accentOf(voice), tag: p.module },
                  done: ok ? [{ module: p.module, item: p.id }, ...(step.speed >= 1.25 ? [{ module: 'air-fast', item: p.id }] : [])] : undefined,
                  missedPhrase: ok ? undefined : p.id,
                })
              }
            >
              {ru.run.next}
            </button>
          </div>
        </>
      )}
      <span hidden data-replays={replays} />
    </section>
  )
}

/* ——— Диктант ——— */

export function DictationStep({ step, onDone }: StepProps<S<'dictation'>>) {
  const t = ru.steps.dictation
  const p = phraseById.get(step.phrase)!
  const [typed, setTyped] = useState('')
  const [checked, setChecked] = useState(false)
  useEffect(() => {
    void playText(spokenText(p), { voice: p.voice, rate: step.speed }).catch(() => {})
    return () => stopAudio()
  }, [p, step.speed])
  const diff = useMemo(() => compareWords(p.text, typed, true), [p, typed])
  const ok = diff.total > 0 && diff.ok / diff.total >= 0.8
  return (
    <section className={s.body}>
      <p className={s.prompt}>{t.title}</p>
      <div className={s.center}>
        <PlayButton text={spokenText(p)} voice={p.voice} rate={step.speed} label={fmt(step.speed)} size="l" />
        <span className={`${s.speedTag} mono`}>{fmt(step.speed)}</span>
      </div>
      <textarea
        className={s.input}
        lang="en"
        rows={3}
        value={typed}
        placeholder={t.placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        disabled={checked}
        onChange={(e) => setTyped(e.target.value)}
      />
      {!checked ? (
        <>
          <p className={s.hint}>{t.hint}</p>
          <div className={s.actions}>
            <button
              type="button"
              className={ui.primary}
              onClick={() => {
                setChecked(true)
                sfx(ok ? 'correct' : 'wrong')
              }}
            >
              {ru.run.check}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={s.feedback} data-ok={ok || undefined}>
            <p className="mono">{t.score(diff.ok, diff.total)}</p>
            <p className={s.phrase}>{diff.ok === diff.total ? <Highlight text={p.text} focus={p.focus} /> : <WordDiff words={diff.words} />}</p>
            {diff.ok < diff.total && <p className={s.hint}>{t.lost}</p>}
            <p className={s.ru}>{p.ru}</p>
            <p className={s.focusNote}>
              {ru.steps.listen.focus}: <span lang="en">{p.focus}</span>
            </p>
            <div className={s.plays}>
              <PlayButton text={spokenText(p)} voice={p.voice} rate={0.75} label="0.75×" size="s" />
              <span className="mono">0.75×</span>
            </div>
          </div>
          <div className={s.actions}>
            <button
              type="button"
              className={ui.primary}
              onClick={() =>
                onDone({
                  correct: ok,
                  fast: ok && step.speed >= 1,
                  answer: { kind: 'dictation', track: 'air', item: p.id, expected: p.text, given: typed, correct: ok, speed: step.speed, accent: accentOf(p.voice), tag: p.module },
                  done: ok ? [{ module: p.module, item: p.id }] : undefined,
                  missedPhrase: ok ? undefined : p.id,
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

/* ——— Лестница скоростей ——— */

const RUNGS = [0.75, 1, 1.25]

export function LadderStep({ step, onDone }: StepProps<S<'ladder'>>) {
  const t = ru.steps.ladder
  const p = phraseById.get(step.phrase)!
  const [rung, setRung] = useState(0)
  const [played, setPlayed] = useState(false)
  const [got, setGot] = useState<boolean[]>([])
  const [revealed, setRevealed] = useState(false)
  const [match, setMatch] = useState<boolean | null>(null)
  const speed = RUNGS[rung]!
  const mark = (v: boolean) => {
    setGot((g) => [...g, v])
    setPlayed(false)
    if (rung < RUNGS.length - 1) setRung(rung + 1)
    else setRevealed(true)
  }
  const claimed = RUNGS.filter((_, i) => got[i]).at(-1) ?? null
  const comfort = match ? claimed : null
  return (
    <section className={s.body}>
      <p className={s.prompt}>{t.title}</p>
      <p className={s.hint}>{t.hint}</p>
      <SpeedScale speeds={RUNGS} current={revealed ? (comfort ?? 0.75) : speed} label={fmt(speed)} />
      {!revealed && (
        <>
          <button
            type="button"
            className={ui.signalButton}
            onClick={() => {
              setPlayed(true)
              void playText(spokenText(p), { voice: p.voice, rate: speed }).catch(() => {})
            }}
          >
            {t.play(fmt(speed))}
          </button>
          {played && (
            <div className={s.pair}>
              <button type="button" className={ui.secondary} onClick={() => mark(false)}>
                {t.notYet}
              </button>
              <button type="button" className={ui.primary} onClick={() => mark(true)}>
                {t.got}
              </button>
            </div>
          )}
        </>
      )}
      {revealed && (
        <div className={s.feedback} data-ok={comfort !== null && comfort >= 1 ? true : undefined}>
          <p className={s.phrase}>
            <Highlight text={p.text} focus={p.focus} />
          </p>
          <p className={s.ru}>{p.ru}</p>
          {match === null ? (
            <>
              <p className={s.prompt}>{t.match}</p>
              <div className={s.pair}>
                <button type="button" className={ui.secondary} onClick={() => setMatch(false)}>
                  {t.no}
                </button>
                <button type="button" className={ui.primary} onClick={() => setMatch(true)}>
                  {t.yes}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mono">{t.comfort(comfort === null ? null : fmt(comfort))}</p>
              <button
                type="button"
                className={ui.primary}
                onClick={() => {
                  const ok = comfort !== null && comfort >= 1
                  onDone({
                    correct: ok,
                    fast: ok,
                    answer: { kind: 'ladder', track: 'air', item: p.id, expected: p.text, given: String(comfort ?? 0), correct: ok, speed: comfort ?? 0.75, accent: accentOf(p.voice), tag: p.module },
                    done: ok ? [{ module: p.module, item: p.id }, ...(comfort === 1.25 ? [{ module: 'air-fast', item: p.id }] : [])] : undefined,
                    missedPhrase: ok ? undefined : p.id,
                  })
                }}
              >
                {ru.run.next}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  )
}

/* ——— Акценты ——— */

export function AccentsStep({ step, onDone }: StepProps<S<'accents'>>) {
  const t = ru.steps.accents
  const p = phraseById.get(step.phrase)!
  const voices = p.voices ?? [p.voice]
  const options = useMemo(() => shuffle(p.options, rng(hash(p.id))), [p])
  const [given, setGiven] = useState<number | null>(null)
  useEffect(() => {
    void playText(p.text, { voice: voices[0] }).catch(() => {})
    return () => stopAudio()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const right = options.indexOf(p.text)
  const ok = given === right
  return (
    <section className={s.body}>
      <p className={`${s.kicker} mono`}>{t.names[accentOf(voices[0]!)]}</p>
      <div className={s.center}>
        <PlayButton text={p.text} voice={voices[0]} label={t.names[accentOf(voices[0]!)]!} size="l" />
      </div>
      <div className={s.options} role="group" aria-label={t.title}>
        <p className={s.prompt}>{t.title}</p>
        {options.map((o, k) => (
          <button
            key={o}
            type="button"
            lang="en"
            className={s.option}
            disabled={given !== null}
            data-state={given === null ? undefined : k === right ? 'right' : k === given ? 'wrong' : undefined}
            onClick={() => {
              setGiven(k)
              sfx(k === right ? 'correct' : 'wrong')
            }}
          >
            {o}
          </button>
        ))}
      </div>
      {given !== null && (
        <>
          <div className={s.feedback} data-ok={ok || undefined}>
            <p className={s.phrase}>
              <Highlight text={p.text} focus={p.focus} />
            </p>
            <p className={s.ru}>{p.ru}</p>
            <p className={s.hint}>{t.compare}</p>
            <div className={s.accents}>
              {voices.map((v) => (
                <span key={v} className={s.playWith}>
                  <PlayButton text={p.text} voice={v} label={t.names[accentOf(v)]!} size="s" />
                  <span>{t.names[accentOf(v)]}</span>
                </span>
              ))}
            </div>
          </div>
          <div className={s.actions}>
            <button
              type="button"
              className={ui.primary}
              onClick={() =>
                onDone({
                  correct: ok,
                  fast: ok,
                  answer: { kind: 'accents', track: 'air', item: p.id, expected: p.text, given: options[given] ?? '', correct: ok, speed: 1, accent: accentOf(voices[0]!), tag: p.module },
                  done: ok ? [{ module: p.module, item: p.id }] : undefined,
                  missedPhrase: ok ? undefined : p.id,
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

/* ——— Длинный отрывок ——— */

export function PassageStep({ step, onDone }: StepProps<S<'passage'>>) {
  const t = ru.steps.passage
  const p = passageById.get(step.passage)!
  const [listens, setListens] = useState(0)
  const [playing, setPlaying] = useState<number>(-1)
  const [answers, setAnswers] = useState<(number | null)[]>(p.questions.map(() => null))
  const [checked, setChecked] = useState(false)
  const token = useRef(0)
  const opts = useMemo(() => p.questions.map((q, i) => shuffle(q.options.map((o, k) => ({ o, k })), rng(hash(p.id) + i))), [p])
  useEffect(() => () => {
    token.current++
    stopAudio()
  }, [])
  const speakers = [...new Set(p.lines.map((l) => l.speaker))].map((id) => characterById.get(id)).filter(Boolean)

  const playAll = async () => {
    const my = ++token.current
    setListens((n) => n + 1)
    for (let i = 0; i < p.lines.length; i++) {
      if (my !== token.current) return
      setPlaying(i)
      await playText(p.lines[i]!.text, { voice: p.lines[i]!.voice }).catch(() => {})
      await wait(250)
    }
    if (my === token.current) setPlaying(-1)
  }
  const playLine = async (i: number) => {
    token.current++
    setPlaying(i)
    await playText(p.lines[i]!.text, { voice: p.lines[i]!.voice }).catch(() => {})
    setPlaying(-1)
  }
  const correct = p.questions.filter((q, i) => answers[i] === q.answer).length
  const passed = correct >= Math.ceil((p.questions.length * 2) / 3)

  return (
    <section className={s.body}>
      <p className={`${s.kicker} mono`}>{p.kind}</p>
      <h1>{p.title}</h1>
      <p className={s.lead}>{p.situation}</p>
      <div className={s.speakers}>
        <span className={s.hint}>{t.who}:</span>
        {speakers.map((c) => (
          <span key={c!.id} className={s.speaker}>
            <b>{c!.name}</b> · {c!.role}
          </span>
        ))}
      </div>
      {!checked && (
        <button type="button" className={listens ? ui.secondary : ui.signalButton} disabled={playing >= 0 || listens >= 2} onClick={() => void playAll()}>
          {playing >= 0 ? t.playing : listens ? t.again : t.listen}
        </button>
      )}
      {listens > 0 && (
        <div className={s.questions}>
          <h2 className={s.h2}>{t.questions}</h2>
          {p.questions.map((q, qi) => (
            <div key={q.q} className={s.options} role="group" aria-label={q.q}>
              <p className={s.prompt}>
                {qi + 1}. {q.q}
              </p>
              {opts[qi]!.map(({ o, k }) => (
                <button
                  key={o}
                  type="button"
                  className={s.option}
                  disabled={checked}
                  aria-pressed={answers[qi] === k}
                  data-state={checked ? (k === q.answer ? 'right' : answers[qi] === k ? 'wrong' : undefined) : answers[qi] === k ? 'picked' : undefined}
                  onClick={() => setAnswers((a) => a.map((x, n) => (n === qi ? k : x)))}
                >
                  {o}
                </button>
              ))}
            </div>
          ))}
          {!checked && (
            <button
              type="button"
              className={ui.primary}
              disabled={answers.some((a) => a === null)}
              onClick={() => {
                token.current++
                stopAudio()
                setChecked(true)
                sfx(passed ? 'correct' : 'wrong')
              }}
            >
              {t.check}
            </button>
          )}
        </div>
      )}
      {checked && (
        <>
          <p className={`${s.score} mono`}>{t.score(correct, p.questions.length)}</p>
          <p className={s.hint}>{t.transcript}</p>
          <ol className={s.transcript}>
            {p.lines.map((l, i) => (
              <li key={i}>
                <button type="button" className={s.line} data-playing={playing === i || undefined} onClick={() => void playLine(i)}>
                  <b>{characterById.get(l.speaker)?.name.split(' ')[0]}:</b> <span lang="en">{l.text}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className={s.actions}>
            <button
              type="button"
              className={ui.primary}
              onClick={() =>
                onDone({
                  correct: passed,
                  answer: { kind: 'passage', track: 'air', item: p.id, expected: String(p.questions.length), given: String(correct), correct: passed, speed: 1, tag: p.module },
                  done: passed ? [{ module: p.module, item: p.id }] : undefined,
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
