/* Шаги Позывного: новый чанк вслух, быстрый ответ, перевод на лету, подстановка. */
import { useEffect, useState } from 'react'
import { PlayButton } from '../../components/Play'
import ui from '../../components/ui.module.css'
import { Highlight, VoiceAnswer, VoiceReport, type VoiceResult } from '../../components/Voice'
import { chunkById, itemsByModule, questionById, substById, translateById } from '../../content'
import { ru } from '../../i18n/ru'
import { defaultVoice, durationOf, playText, stopAudio } from '../../lib/audio/audio'
import type { Step } from '../../lib/run/steps'
import { useSettings } from '../../lib/settings/settings'
import type { StepProps } from './result'
import s from './run.module.css'

type S<K extends Step['kind']> = Extract<Step, { kind: K }>

/** Сколько сказано: по записи, без неё — примерная длительность образца. */
function spoken(r: VoiceResult, fallbackMs: number): number {
  if (r && (r.recorded || r.recognized) && r.speechMs > 0) return r.speechMs
  return fallbackMs
}

/* ——— Новый чанк ——— */

export function ChunkStep({ step, onDone }: StepProps<S<'chunk'>>) {
  const t = ru.steps.chunk
  const c = chunkById.get(step.chunk)!
  const voice = defaultVoice()
  const target = c.example ?? c.en
  const [result, setResult] = useState<VoiceResult | undefined>(undefined)
  useEffect(() => {
    void playText(c.en, { voice }).catch(() => {})
    return () => stopAudio()
  }, [c, voice])
  return (
    <section className={s.body}>
      <p className={`${s.kicker} mono`}>{t.fn(c.fn)}</p>
      <div className={s.chunk}>
        <PlayButton text={c.en} voice={voice} label={c.en} size="m" />
        <div>
          <p className={s.chunkEn} lang="en">
            {c.en}
          </p>
          <p className={s.ru}>{c.ru}</p>
        </div>
      </div>
      {c.example && (
        <div className={s.example}>
          <span className={s.hint}>{t.example}</span>
          <p className={s.phrase}>
            <PlayButton text={c.example} voice={voice} label={c.example} size="s" /> <Highlight text={c.example} focus={c.en.replace(/[.?!]$/, '')} />
          </p>
          <p className={s.ru}>{c.exampleRu}</p>
        </div>
      )}
      {result === undefined ? (
        <>
          <p className={s.hint}>{t.say}</p>
          <VoiceAnswer maxSeconds={12} label={t.recordCompare} allowSkip={false} onResult={setResult} />
          {/* Без записи двигаться дальше — одной кнопкой (UX §4.3) */}
          <button
            type="button"
            className={ui.secondary}
            onClick={() => onDone({ spokenMs: durationOf(target, voice), chunkLearned: c.id, done: [{ module: c.module, item: c.id }] })}
          >
            {t.saidNext}
          </button>
        </>
      ) : (
        <>
          <VoiceReport result={result} target={target} sample={{ text: target, voice }} />
          <div className={s.actions}>
            <button
              type="button"
              className={ui.primary}
              onClick={() => onDone({ spokenMs: spoken(result, durationOf(target, voice)), chunkLearned: c.id, done: [{ module: c.module, item: c.id }] })}
            >
              {ru.run.next}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

/* ——— Быстрый ответ ——— */

export function QuickStep({ step, onDone }: StepProps<S<'quick'>>) {
  const t = ru.steps.quick
  const settings = useSettings()
  const q = questionById.get(step.question)!
  const hints = (itemsByModule.get(q.module)?.chunks ?? []).slice(0, 4)
  const [showHints, setShowHints] = useState(false)
  const [showRu, setShowRu] = useState(false)
  const [result, setResult] = useState<VoiceResult | undefined>(undefined)
  const [checks, setChecks] = useState<boolean[]>([false, false, false])
  const measured = !!result && (result.recorded || result.recognized)
  const noPauses = measured ? result!.longPauses === 0 : checks[2]!
  return (
    <section className={s.body}>
      <p className={`${s.kicker} mono`}>{t.title}</p>
      <div className={s.question}>
        <p className={s.qText} lang="en">
          {q.q}
        </p>
        <button type="button" className={ui.link} onClick={() => setShowRu((v) => !v)}>
          {ru.intake.speakRu}
        </button>
        {showRu && <p className={s.hint}>{q.ru}</p>}
      </div>
      {result === undefined && (
        <>
          <p className={s.hint}>{t.hint(settings.answerSeconds)}</p>
          {hints.length > 0 && (
            <button type="button" className={ui.link} onClick={() => setShowHints((v) => !v)}>
              {t.chunks}
            </button>
          )}
          {showHints && (
            <ul className={s.hints} lang="en">
              {hints.map((c) => (
                <li key={c.id}>{c.en}</li>
              ))}
            </ul>
          )}
          <VoiceAnswer timed={settings.answerSeconds} maxSeconds={60} prompt={{ text: q.q, voice: q.voice }} onResult={setResult} label={ru.intake.listenPlay} />
        </>
      )}
      {result !== undefined && (
        <>
          <VoiceReport result={result} />
          {result?.onTime !== undefined && <p className={`${s.hint} mono`}>{result.onTime ? t.onTime : t.late}</p>}
          <div className={s.options} role="group" aria-label={t.check}>
            <p className={s.prompt}>{t.check}</p>
            {t.checks.map((label, i) =>
              i === 2 && measured ? null : (
                <button key={label} type="button" className={s.option} aria-pressed={checks[i]} data-state={checks[i] ? 'picked' : undefined} onClick={() => setChecks((c) => c.map((x, k) => (k === i ? !x : x)))}>
                  {checks[i] ? '✓ ' : ''}
                  {label}
                </button>
              ),
            )}
          </div>
          <div className={s.actions}>
            <button
              type="button"
              className={ui.primary}
              onClick={() => {
                const speech = spoken(result, 15_000)
                onDone({
                  spokenMs: speech,
                  onTime: result?.onTime,
                  answer: {
                    kind: 'quick',
                    track: 'call',
                    item: q.id,
                    expected: '',
                    given: result?.transcript ?? '',
                    correct: checks[0]! && noPauses,
                    latencyMs: result?.startMs,
                    speechMs: measured ? result!.speechMs : undefined,
                    tag: q.module,
                  },
                  done: [{ module: q.module, item: q.id }],
                })
              }}
            >
              {ru.run.next}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

/* ——— Перевод на лету и подстановка: общий хвост — образец и самооценка ——— */

function SelfGrade({ en, result, onGrade }: { en: string; result: VoiceResult; onGrade: (g: 1 | 2 | 3) => void }) {
  const voice = defaultVoice()
  useEffect(() => {
    void playText(en, { voice }).catch(() => {})
  }, [en, voice])
  return (
    <>
      <div className={s.feedback} data-ok>
        <span className={s.hint}>{ru.steps.translate.sample}</span>
        <p className={s.phrase}>
          <PlayButton text={en} voice={voice} label={en} size="s" /> <span lang="en">{en}</span>
        </p>
      </div>
      <VoiceReport result={result} target={en} sample={{ text: en, voice }} />
      <div className={s.grades} role="group">
        {([1, 2, 3] as const).map((g) => (
          <button key={g} type="button" className={s.grade} data-grade={g} onClick={() => onGrade(g)}>
            {ru.steps.translate.grades[g]}
          </button>
        ))}
      </div>
    </>
  )
}

export function TranslateStep({ step, onDone }: StepProps<S<'translate'>>) {
  const t = ru.steps.translate
  const settings = useSettings()
  const it = translateById.get(step.item)!
  const [result, setResult] = useState<VoiceResult | undefined>(undefined)
  const seconds = settings.answerSeconds + 2
  return (
    <section className={s.body}>
      <p className={`${s.kicker} mono`}>{t.title}</p>
      <p className={s.bigRu}>{it.ru}</p>
      {result === undefined ? (
        <>
          <p className={s.hint}>{t.hint(seconds)}</p>
          <VoiceAnswer timed={seconds} maxSeconds={15} autoStart onResult={setResult} />
        </>
      ) : (
        <SelfGrade
          en={it.en}
          result={result}
          onGrade={(g) =>
            onDone({
              correct: g >= 2,
              onTime: result?.onTime,
              spokenMs: spoken(result, durationOf(it.en)),
              answer: { kind: 'translate', track: 'call', item: it.id, expected: it.en, given: result?.transcript ?? String(g), correct: g >= 2, latencyMs: result?.startMs, tag: it.module },
              done: g >= 2 ? [{ module: it.module, item: it.id }] : undefined,
            })
          }
        />
      )}
    </section>
  )
}

export function SubstituteStep({ step, onDone }: StepProps<S<'substitute'>>) {
  const t = ru.steps.substitute
  const settings = useSettings()
  const it = substById.get(step.item)!
  const swap = it.swaps[step.swap]!
  const voice = defaultVoice()
  const [result, setResult] = useState<VoiceResult | undefined>(undefined)
  return (
    <section className={s.body}>
      <p className={`${s.kicker} mono`}>{t.title}</p>
      <div className={s.example}>
        <span className={s.hint}>{t.base}</span>
        <p className={s.phrase}>
          <PlayButton text={it.base} voice={voice} label={it.base} size="s" /> <span lang="en">{it.base}</span>
        </p>
        <p className={s.ru}>{it.ru}</p>
      </div>
      <p className={s.cue}>
        {t.cue} <b>{swap.cue}</b>
      </p>
      {result === undefined ? (
        <>
          <p className={s.hint}>{t.hint}</p>
          <VoiceAnswer timed={settings.answerSeconds + 2} maxSeconds={15} onResult={setResult} />
        </>
      ) : (
        <SelfGrade
          en={swap.en}
          result={result}
          onGrade={(g) =>
            onDone({
              correct: g >= 2,
              onTime: result?.onTime,
              spokenMs: spoken(result, durationOf(swap.en)),
              answer: { kind: 'substitute', track: 'call', item: `${it.id}#${step.swap}`, expected: swap.en, given: result?.transcript ?? String(g), correct: g >= 2, tag: it.module },
              done: g >= 2 ? [{ module: it.module, item: it.id }] : undefined,
            })
          }
        />
      )}
    </section>
  )
}
