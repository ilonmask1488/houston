/* Карточка FSRS: 1 — текст → значение, 2 — значение → скажи вслух, 3 — на слух → понять. */
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { PlayButton } from '../../components/Play'
import ui from '../../components/ui.module.css'
import { Highlight, VoiceAnswer, VoiceReport, type VoiceResult } from '../../components/Voice'
import { chunkById, phraseById, spokenText } from '../../content'
import type { VoiceId } from '../../content/types'
import { ru } from '../../i18n/ru'
import { defaultVoice, durationOf, playText, stopAudio } from '../../lib/audio/audio'
import { db } from '../../lib/db/db'
import type { Step } from '../../lib/run/steps'
import { useSettings } from '../../lib/settings/settings'
import { answerCard } from '../../lib/srs/cards'
import { formatInterval, parseCardId, previewIntervals, type Grade14 } from '../../lib/srs/srs'
import type { StepProps } from './result'
import s from './run.module.css'

type S<K extends Step['kind']> = Extract<Step, { kind: K }>

/** Что показывать для элемента карточки: чанк или фраза Эфира. */
function itemView(itemId: string): { en: string; say: string; ru: string; example?: string; exampleRu?: string; focus?: string; voice: VoiceId } | null {
  const c = chunkById.get(itemId)
  if (c) return { en: c.en, say: c.en, ru: c.ru, example: c.example, exampleRu: c.exampleRu, voice: defaultVoice() }
  const p = phraseById.get(itemId)
  if (p) return { en: p.text, say: spokenText(p), ru: p.ru, focus: p.focus, voice: p.voice }
  return null
}

export function CardStep({ step, onDone }: StepProps<S<'card'>>) {
  const t = ru.steps.card
  const settings = useSettings()
  const { itemId, kind } = parseCardId(step.card)
  const v = itemView(itemId)
  const row = useLiveQuery(() => db.cards.get(step.card), [step.card])
  const [shown, setShown] = useState(false)
  const [said, setSaid] = useState<VoiceResult | undefined>(undefined)
  const started = useRef(Date.now())
  useEffect(() => {
    if (v && kind === 3) void playText(v.say, { voice: v.voice }).catch(() => {})
    return () => stopAudio()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.card])
  if (!v) {
    return (
      <section className={s.body}>
        <p className={s.hint}>{t.empty}</p>
        <button type="button" className={ui.primary} onClick={() => onDone({})}>
          {ru.run.next}
        </button>
      </section>
    )
  }
  const intervals = row ? previewIntervals(row, Date.now(), settings.desiredRetention) : null
  const grade = async (g: Grade14) => {
    await answerCard(step.card, g, Date.now() - started.current, settings.desiredRetention).catch((e) => console.error(e))
    onDone({ correct: g >= 2, spokenMs: kind === 2 ? (said && (said.recorded || said.recognized) ? said.speechMs : durationOf(v.say)) : undefined })
  }
  return (
    <section className={s.body}>
      <p className={`${s.kicker} mono`}>{t.kind[kind]}</p>
      <div className={s.cardFace}>
        {kind === 1 && (
          <p className={s.chunkEn} lang="en">
            {v.en}
          </p>
        )}
        {kind === 2 && <p className={s.bigRu}>{v.ru}</p>}
        {kind === 3 && <PlayButton text={v.say} voice={v.voice} label={t.kind[3]!} size="l" />}
      </div>
      {!shown && <p className={s.hint}>{t.hint[kind]}</p>}
      {kind === 2 && !shown && said === undefined && <VoiceAnswer maxSeconds={12} onResult={(r) => (setSaid(r), setShown(true))} />}
      {!shown && kind !== 2 && (
        <button type="button" className={ui.primary} onClick={() => setShown(true)}>
          {t.show}
        </button>
      )}
      {!shown && kind === 2 && said === undefined && (
        <button type="button" className={ui.link} onClick={() => setShown(true)}>
          {t.show}
        </button>
      )}
      {shown && (
        <>
          <div className={s.feedback} data-ok>
            <p className={s.phrase}>
              <PlayButton text={v.say} voice={v.voice} label={v.en} size="s" /> <Highlight text={v.en} focus={v.focus} />
            </p>
            <p className={s.ru}>{v.ru}</p>
            {v.example && (
              <p className={s.hint}>
                <span lang="en">{v.example}</span> — {v.exampleRu}
              </p>
            )}
          </div>
          {said && <VoiceReport result={said} target={v.en} sample={{ text: v.en, voice: v.voice }} />}
          <div className={s.grades} role="group" aria-label={t.gradeLabel}>
            {([1, 2, 3, 4] as const).map((g) => (
              <button key={g} type="button" className={s.grade} data-grade={g} onClick={() => void grade(g)}>
                <span>{t.grades[g]}</span>
                {intervals && <span className={`${s.interval} mono`}>{formatInterval(intervals[g])}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
