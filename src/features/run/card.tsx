/* Карточка FSRS: 1 — текст → значение, 2 — значение → скажи вслух, 3 — на слух → понять. */
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { PlayButton } from '../../components/Play'
import ui from '../../components/ui.module.css'
import { Highlight, VoiceAnswer, VoiceReport, type VoiceResult } from '../../components/Voice'
import { chunkById, falseFriendById, phraseById, spokenText } from '../../content'
import type { VoiceId } from '../../content/types'
import { intervalWords, ru } from '../../i18n/ru'
import { defaultVoice, durationOf, playText, stopAudio } from '../../lib/audio/audio'
import { db } from '../../lib/db/db'
import type { UserWordRow } from '../../lib/db/types'
import { dictById, dictionaryLoaded, loadDictionary } from '../../lib/dict/dict'
import type { Step } from '../../lib/run/steps'
import { useSettings } from '../../lib/settings/settings'
import { answerCard } from '../../lib/srs/cards'
import { parseCardId, previewIntervals, type Grade14 } from '../../lib/srs/srs'
import type { StepProps } from './result'
import s from './run.module.css'

type S<K extends Step['kind']> = Extract<Step, { kind: K }>

type ItemView = { en: string; say: string; ru: string; example?: string; exampleRu?: string; focus?: string; ipa?: string; context?: string; note?: string; voice: VoiceId }

/** Что показывать для элемента карточки: чанк, фраза Эфира, слово словаря или своё слово. */
function itemView(itemId: string, userWord?: UserWordRow): ItemView | null {
  const c = chunkById.get(itemId)
  if (c) return { en: c.en, say: c.en, ru: c.ru, example: c.example, exampleRu: c.exampleRu, voice: defaultVoice() }
  const p = phraseById.get(itemId)
  if (p) return { en: p.text, say: spokenText(p), ru: p.ru, focus: p.focus, voice: p.voice }
  const w = dictById.get(itemId)
  if (w) return { en: w.text, say: w.text, ru: w.ru, ipa: w.ipa, example: userWord?.context, voice: w.voices?.includes(defaultVoice()) ? defaultVoice() : (w.voices?.[0] ?? defaultVoice()) }
  if (userWord) return { en: userWord.text, say: userWord.text, ru: userWord.ru, example: userWord.context, voice: defaultVoice() }
  const f = falseFriendById.get(itemId)
  if (f) return { en: f.options[0]!, say: f.options[0]!, ru: f.ru, context: f.context, note: f.why, voice: defaultVoice() }
  return null
}

/** Слова живут в отдельно загружаемом словаре и в базе — дождаться их. */
function useItemView(itemId: string): ItemView | null | undefined {
  const isWord = /^(w|u)-/.test(itemId)
  const [ready, setReady] = useState(!isWord || dictionaryLoaded())
  useEffect(() => {
    if (!ready) void loadDictionary().then(() => setReady(true))
  }, [ready])
  const userWord = useLiveQuery(() => (itemId.startsWith('u-') ? db.userWords.get(itemId).then((x) => x ?? null) : null), [itemId])
  if (!ready || userWord === undefined) return isWord ? undefined : itemView(itemId)
  return itemView(itemId, userWord ?? undefined)
}

export function CardStep({ step, onDone }: StepProps<S<'card'>>) {
  const t = ru.steps.card
  const settings = useSettings()
  const { itemId, kind } = parseCardId(step.card)
  const v = useItemView(itemId)
  const row = useLiveQuery(() => db.cards.get(step.card), [step.card])
  const [shown, setShown] = useState(false)
  const [said, setSaid] = useState<VoiceResult | undefined>(undefined)
  const [hint, setHint] = useState(false)
  const started = useRef(Date.now())
  useEffect(() => {
    if (v && kind === 3) void playText(v.say, { voice: v.voice }).catch(() => {})
    return () => stopAudio()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.card, !!v])
  if (v === undefined) return <section className={s.body} aria-busy />
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
  const firstWord = v.en.split(/\s+/)[0]
  return (
    <section className={s.body}>
      {/* Шаг 1 — вопрос: только то, что нужно для вопроса (UX §4.4) */}
      <div className={s.cardFace}>
        {kind === 1 && (
          <p className={s.phrase}>
            <PlayButton text={v.say} voice={v.voice} label={v.en} size="s" />{' '}
            <span className={s.chunkEn} lang="en">
              {v.en}
            </span>
          </p>
        )}
        {kind === 2 && <p className={s.bigRu}>{t.sayIt(v.ru)}</p>}
        {kind === 4 && <p className={s.bigRu}>{v.ru}</p>}
        {kind === 4 && v.context && <p className={s.hint}>«{v.context}»</p>}
        {kind === 3 && <PlayButton text={v.say} voice={v.voice} label={t.kind[3]!} size="l" />}
      </div>
      {!shown && kind === 2 && (
        <>
          {hint ? (
            <p className={s.hint}>
              {t.firstWord}: <b lang="en">{firstWord}</b> …
            </p>
          ) : (
            <button type="button" className={ui.link} onClick={() => setHint(true)}>
              {t.firstWordShow}
            </button>
          )}
          {said === undefined && <VoiceAnswer maxSeconds={12} label={t.recordSelf} allowSkip={false} onResult={(r) => (setSaid(r), setShown(true))} />}
        </>
      )}
      {!shown && (
        <div className={s.actions}>
          <button type="button" className={kind === 2 ? ui.secondary : ui.primary} onClick={() => setShown(true)}>
            {t.show}
          </button>
        </div>
      )}
      {shown && (
        <>
          {/* Шаг 2 — ответ целиком */}
          <div className={s.feedback} data-ok>
            <p className={s.phrase}>
              <PlayButton text={v.say} voice={v.voice} label={v.en} size="s" /> <Highlight text={v.en} focus={v.focus} />
            </p>
            {v.ipa && <p className={`${s.hint} mono`}>/{v.ipa}/</p>}
            <p className={s.ru}>{v.ru}</p>
            {v.note && <p className={s.hint}>{v.note}</p>}
            {v.example && (
              <p className={s.hint}>
                <span lang="en">{v.example}</span>
                {v.exampleRu && ` — ${v.exampleRu}`}
              </p>
            )}
          </div>
          {said && <VoiceReport result={said} target={v.en} sample={{ text: v.en, voice: v.voice }} />}
          {/* Шаг 3 — самооценка: подписано, когда карточка вернётся */}
          <p className={s.prompt}>{kind === 2 ? t.askSaid : t.ask}</p>
          <div className={s.grades} role="group" aria-label={t.gradeLabel}>
            {([1, 2, 3, 4] as const).map((g) => (
              <button key={g} type="button" className={s.grade} data-grade={g} onClick={() => void grade(g)}>
                <span>{t.grades[g]}</span>
                {intervals && <span className={s.interval}>{t.when(g, intervalWords(intervals[g]))}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

