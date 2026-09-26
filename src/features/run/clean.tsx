/* Шаги Чистого сигнала (ТЗ §6.5): минимальные пары на слух и вслух, фразы и интонация, ударение; ложные друзья. */
import { lazy, Suspense, useEffect, useState } from 'react'
import { PlayButton } from '../../components/Play'
import { PingSays } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { VoiceAnswer, VoiceReport, type VoiceResult } from '../../components/Voice'
import { cleanPhraseById, falseFriendById, pairById, stressById } from '../../content'
import type { MinimalPair } from '../../content/types'
import { ru } from '../../i18n/ru'
import { defaultVoice, durationOf, playText, stopAudio } from '../../lib/audio/audio'
import { entryFor, urlOf } from '../../lib/audio/manifest'
import { sfx } from '../../lib/audio/sfx'
import type { Step } from '../../lib/run/steps'
import { judgePair } from '../../lib/speech/recognize'
import { addFalseFriendCard } from '../../lib/srs/cards'
import { Choice } from './Choice'
import c from './clean.module.css'
import type { StepProps } from './result'
import s from './run.module.css'

type S<K extends Step['kind']> = Extract<Step, { kind: K }>

const PitchChart = lazy(() => import('../../components/PitchChart'))

function Next({ onClick }: { onClick: () => void }) {
  return (
    <div className={s.actions}>
      <button type="button" className={ui.primary} onClick={onClick}>
        {ru.run.next}
      </button>
    </div>
  )
}

/** Оба слова пары с кнопками звука — после ответа, чтобы услышать разницу. */
function PairBoth({ p }: { p: MinimalPair }) {
  const voice = defaultVoice()
  return (
    <div className={c.both}>
      {([
        [p.a, p.ipaA, p.ruA],
        [p.b, p.ipaB, p.ruB],
      ] as const).map(([w, ipa, tr]) => (
        <div key={w} className={c.word}>
          <PlayButton text={w} voice={voice} label={w} size="s" />
          <span>
            <span className={c.en} lang="en">
              {w}
            </span>{' '}
            <span className={`${c.ipa} mono`}>/{ipa}/</span>
            <span className={c.tr}>{tr}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

/* ——— Пара на слух ——— */

export function PairHearStep({ step, onDone }: StepProps<S<'pairHear'>>) {
  const p = pairById.get(step.pair)!
  const target = step.pick === 0 ? p.a : p.b
  const voice = defaultVoice()
  const [given, setGiven] = useState<string | null>(null)
  useEffect(() => {
    void playText(target, { voice }).catch(() => {})
    return () => stopAudio()
  }, [target, voice])
  const ok = given === target
  return (
    <section className={s.body}>
      <p className={`${s.kicker} mono`}>{ru.clean.hearKicker}</p>
      <div className={s.cardFace}>
        <PlayButton text={target} voice={voice} label={ru.clean.replay} size="l" />
      </div>
      <div className={c.pair} role="group" aria-label={ru.clean.hearGroup}>
        {[p.a, p.b].map((w) => (
          <button
            key={w}
            type="button"
            lang="en"
            className={c.choice}
            disabled={given !== null}
            data-state={given === null ? undefined : w === target ? 'right' : w === given ? 'wrong' : undefined}
            onClick={() => {
              setGiven(w)
              sfx(w === target ? 'correct' : 'wrong')
            }}
          >
            {w}
          </button>
        ))}
      </div>
      {given !== null && (
        <>
          <p className={s.hint}>{ru.clean.both}</p>
          <PairBoth p={p} />
          <Next
            onClick={() =>
              onDone({
                correct: ok,
                answer: { kind: 'pair', track: 'clean', item: p.id, expected: target, given, correct: ok, tag: p.module },
                done: ok ? [{ module: p.module, item: p.id }] : undefined,
              })
            }
          />
        </>
      )}
    </section>
  )
}

/* ——— Пара вслух ——— */

export function PairSayStep({ step, onDone }: StepProps<S<'pairSay'>>) {
  const p = pairById.get(step.pair)!
  const [target, other] = step.pick === 0 ? [p.a, p.b] : [p.b, p.a]
  const [ipa, tr] = step.pick === 0 ? [p.ipaA, p.ruA] : [p.ipaB, p.ruB]
  const voice = defaultVoice()
  const [result, setResult] = useState<VoiceResult | undefined>(undefined)
  const [self, setSelf] = useState<boolean | null>(null)
  const verdict = result?.recognized ? judgePair(target, other, result.transcript, result.alts) : 'none'
  const ok = verdict === 'right' || (verdict === 'none' && self === true)
  const finished = result !== undefined && (verdict !== 'none' || self !== null)
  return (
    <section className={s.body}>
      <p className={`${s.kicker} mono`}>{ru.clean.sayKicker}</p>
      <div className={s.cardFace}>
        <p className={s.chunkEn} lang="en">
          {target}
        </p>
        <p className={`${c.ipa} mono`}>
          /{ipa}/ · {tr}
        </p>
      </div>
      {result === undefined ? (
        <>
          <p className={s.hint}>{ru.clean.sayHint}</p>
          <VoiceAnswer maxSeconds={5} onResult={setResult} />
        </>
      ) : (
        <>
          <VoiceReport result={result} sample={{ text: target, voice }} />
          {verdict === 'right' && <PingSays mood="happy" size={48}>{ru.clean.heardRight(target)}</PingSays>}
          {verdict === 'other' && <PingSays mood="oops" size={48}>{ru.clean.heardOther(other)}</PingSays>}
          {verdict === 'none' && (
            <>
              <p className={s.hint}>{ru.clean.heardNone}</p>
              <div className={ui.row}>
                {[true, false].map((v) => (
                  <button key={String(v)} type="button" className={ui.secondary} aria-pressed={self === v} onClick={() => setSelf(v)}>
                    {v ? ru.clean.selfOk : ru.clean.selfBad}
                  </button>
                ))}
              </div>
            </>
          )}
          <PairBoth p={p} />
          {verdict === 'other' && (
            <button type="button" className={ui.secondary} onClick={() => (setResult(undefined), setSelf(null))}>
              {ru.clean.again}
            </button>
          )}
          {finished && (
            <Next
              onClick={() =>
                onDone({
                  correct: ok,
                  spokenMs: result && (result.recorded || result.recognized) ? result.speechMs : durationOf(target, voice),
                  answer: { kind: 'pairSay', track: 'clean', item: p.id, expected: target, given: result?.transcript ?? '', correct: ok, tag: p.module },
                })
              }
            />
          )}
        </>
      )}
    </section>
  )
}

/* ——— Фраза и интонация ——— */

export function CleanSayStep({ step, onDone }: StepProps<S<'cleanSay'>>) {
  const x = cleanPhraseById.get(step.phrase)!
  const voice = defaultVoice()
  const [result, setResult] = useState<VoiceResult | undefined>(undefined)
  const [chart, setChart] = useState(false)
  const intonation = x.module === 'clean-intonation'
  const sample = entryFor(x.text, voice)
  return (
    <section className={s.body}>
      <p className={`${s.kicker} mono`}>{ru.clean.phraseKicker}</p>
      <p className={s.phrase}>
        <PlayButton text={x.text} voice={voice} label={x.text} /> <span lang="en">{x.text}</span>
      </p>
      {x.ru && <p className={s.ru}>{x.ru}</p>}
      <p className={c.focus}>
        <span className={s.hint}>{ru.clean.focus}: </span>
        {x.focus}
      </p>
      {result === undefined ? (
        <VoiceAnswer maxSeconds={12} label={ru.voice.record} onResult={setResult} />
      ) : (
        <>
          <VoiceReport result={result} target={x.text} sample={{ text: x.text, voice }} />
          {intonation && result?.url && sample && (
            <>
              {!chart && (
                <button type="button" className={ui.secondary} onClick={() => setChart(true)}>
                  {ru.pitch.show}
                </button>
              )}
              {chart && (
                <Suspense fallback={<p className={s.hint}>{ru.pitch.loading}</p>}>
                  <PitchChart sampleUrl={urlOf(sample)} mineUrl={result.url} />
                </Suspense>
              )}
            </>
          )}
          <button type="button" className={ui.link} onClick={() => (setResult(undefined), setChart(false))}>
            {ru.clean.again}
          </button>
          <Next
            onClick={() =>
              onDone({
                spokenMs: result && (result.recorded || result.recognized) ? result.speechMs : durationOf(x.text, voice),
                answer: { kind: 'cleanSay', track: 'clean', item: x.id, expected: x.text, given: result?.transcript ?? '', correct: true, speechMs: result?.speechMs, tag: x.module },
                done: [{ module: x.module, item: x.id }],
              })
            }
          />
        </>
      )}
    </section>
  )
}

/* ——— Ударение ——— */

export function StressStep({ step, onDone }: StepProps<S<'stress'>>) {
  const w = stressById.get(step.word)!
  const voice = defaultVoice()
  const [given, setGiven] = useState<number | null>(null)
  const ok = given === w.stress
  return (
    <section className={s.body}>
      <p className={`${s.kicker} mono`}>{ru.clean.stressKicker}</p>
      <p className={s.prompt}>
        {w.ru} · <span className={s.hint}>{ru.clean.stressHint}</span>
      </p>
      <div className={c.syllables} role="group" aria-label={ru.clean.stressGroup} lang="en">
        {w.syllables.map((x, i) => (
          <button
            key={i}
            type="button"
            className={c.syllable}
            disabled={given !== null}
            data-state={given === null ? undefined : i === w.stress ? 'right' : i === given ? 'wrong' : undefined}
            onClick={() => {
              setGiven(i)
              sfx(i === w.stress ? 'correct' : 'wrong')
              void playText(w.text, { voice }).catch(() => {})
            }}
          >
            {given !== null && i === w.stress ? x.toUpperCase() : x}
          </button>
        ))}
      </div>
      {given !== null && (
        <>
          <p className={s.phrase}>
            <PlayButton text={w.text} voice={voice} label={w.text} size="s" /> <span lang="en">{w.text}</span> <span className={`${c.ipa} mono`}>/{w.ipa}/</span>
          </p>
          <Next
            onClick={() =>
              onDone({
                correct: ok,
                answer: { kind: 'stress', track: 'clean', item: w.id, expected: String(w.stress), given: String(given), correct: ok, tag: w.module },
                done: ok ? [{ module: w.module, item: w.id }] : undefined,
              })
            }
          />
        </>
      )}
    </section>
  )
}

/* ——— Ложный друг ——— */

export function FalseFriendStep({ step, onDone }: StepProps<S<'falseFriend'>>) {
  const f = falseFriendById.get(step.item)!
  const voice = defaultVoice()
  const [res, setRes] = useState<{ given: string; ok: boolean } | null>(null)
  return (
    <section className={s.body}>
      <p className={`${s.kicker} mono`}>{ru.clean.ffKicker}</p>
      <p className={s.bigRu}>{f.ru}</p>
      <p className={s.hint}>«{f.context}»</p>
      <p className={s.prompt}>{ru.clean.ffPrompt}</p>
      <Choice label={ru.clean.ffGroup} options={f.options} right={f.options[0]!} seed={f.id} onAnswer={(given, ok) => setRes({ given, ok })} />
      {res && (
        <>
          <p className={s.phrase}>
            <PlayButton text={f.options[0]!} voice={voice} label={f.options[0]!} size="s" /> <span lang="en">{f.options[0]}</span>
          </p>
          <PingSays mood={res.ok ? 'happy' : 'oops'} size={48}>
            {f.why}
          </PingSays>
          <Next
            onClick={() => {
              void addFalseFriendCard(f.id).catch((e) => console.error(e))
              onDone({ correct: res.ok, answer: { kind: 'ff', track: 'clean', item: f.id, expected: f.options[0]!, given: res.given, correct: res.ok, tag: 'false-friends' } })
            }}
          />
        </>
      )}
    </section>
  )
}
