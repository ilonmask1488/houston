/*
  Текст, где каждое слово можно нажать: перевод из встроенного словаря, звук, «В карточки»,
  свой перевод, «Спросить Claude». Термины из нескольких слов (strain gauge) узнаются целиком.
*/
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ru } from '../i18n/ru'
import { defaultVoice, playText } from '../lib/audio/audio'
import { hasAudio } from '../lib/audio/manifest'
import { speakEnglish } from '../lib/audio/speech'
import { askWordPrompt } from '../lib/claude/prompt'
import { db } from '../lib/db/db'
import { BAND_LABEL, loadDictionary, lookupInContext, norm } from '../lib/dict/dict'
import { saveUserWord, userWordId } from '../lib/dict/words'
import { addWordCards } from '../lib/srs/cards'
import { ClaudeButton } from './ClaudeButton'
import { IconClose, IconSpeaker } from './Icons'
import s from './TapText.module.css'
import ui from './ui.module.css'

type Token = { t: string; word: boolean; i: number }

function tokenize(text: string): Token[] {
  const out: Token[] = []
  let wi = 0
  for (const m of text.matchAll(/([A-Za-z][A-Za-z'’-]*)|([^A-Za-z]+)/g)) {
    if (m[1]) out.push({ t: m[1], word: true, i: wi++ })
    else out.push({ t: m[2]!, word: false, i: -1 })
  }
  return out
}

/** Абзац с нажимаемыми словами. highlight — индексы предложения, подсвеченного извне (не используется здесь). */
export function TapText({ text, className }: { text: string; className?: string }) {
  const tokens = useMemo(() => tokenize(text), [text])
  const words = useMemo(() => tokens.filter((t) => t.word).map((t) => t.t), [tokens])
  const [picked, setPicked] = useState<number | null>(null)
  const [range, setRange] = useState<[number, number] | null>(null)
  return (
    <>
      <span className={`${s.text} ${className ?? ''}`} lang="en">
        {tokens.map((tk, k) =>
          tk.word ? (
            <button
              key={k}
              type="button"
              className={s.word}
              data-on={range && tk.i >= range[0] && tk.i <= range[1] ? true : undefined}
              onClick={() => setPicked(tk.i)}
            >
              {tk.t}
            </button>
          ) : (
            <span key={k}>{tk.t}</span>
          ),
        )}
      </span>
      {picked !== null && (
        <WordSheet
          words={words}
          index={picked}
          context={sentenceAround(text, words, picked)}
          onRange={setRange}
          onClose={() => {
            setPicked(null)
            setRange(null)
          }}
        />
      )}
    </>
  )
}

function sentenceAround(text: string, words: string[], index: number): string {
  const sentences = text.split(/(?<=[.!?])\s+/)
  let count = 0
  for (const sen of sentences) {
    const n = (sen.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).length
    if (index < count + n) return sen
    count += n
  }
  return words.slice(Math.max(0, index - 8), index + 8).join(' ')
}

export function WordSheet({ words, index, context, onClose, onRange }: { words: string[]; index: number; context: string; onClose: () => void; onRange?: (r: [number, number]) => void }) {
  const t = ru.wordSheet
  const [ready, setReady] = useState(false)
  const [own, setOwn] = useState('')
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    void loadDictionary().then(() => setReady(true))
  }, [])
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  const found = useMemo(() => (ready ? lookupInContext(words, index) : null), [ready, words, index])
  useEffect(() => {
    if (found) onRange?.([found.from, found.to])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found])
  const entry = found?.entry
  const raw = words.slice(found?.from ?? index, (found?.to ?? index) + 1).join(' ')
  const itemId = entry?.id ?? userWordId(raw)
  const state = useLiveQuery(async () => ({ card: !!(await db.cards.get(`${itemId}:1`)), mine: await db.userWords.get(userWordId(raw)) }), [itemId, raw])
  const play = () => {
    const text = entry?.text ?? norm(raw)
    if (hasAudio(text)) void playText(text, { voice: defaultVoice() }).catch(() => {})
    else void speakEnglish(text).catch(() => {})
  }
  const translation = entry?.ru ?? state?.mine?.ru
  return (
    <dialog ref={ref} className={s.sheet} aria-label={t.title} onCancel={onClose} onClose={onClose}>
      <div className={s.head}>
        <button type="button" className={s.play} onClick={play} aria-label={t.play}>
          <IconSpeaker size={20} />
        </button>
        <div className={s.headMain}>
          <b lang="en" className={s.term}>
            {entry?.text ?? raw}
          </b>
          {entry?.ipa && <span className={s.ipa}>/{entry.ipa}/</span>}
        </div>
        <button type="button" className={s.close} onClick={() => ref.current?.close()} aria-label={ru.banners.close}>
          <IconClose />
        </button>
      </div>
      {!ready ? (
        <p className={s.muted}>{t.loading}</p>
      ) : translation ? (
        <>
          <p className={s.ru}>{translation}</p>
          {entry && <p className={s.muted}>{BAND_LABEL[entry.band]}{entry.band !== 'tech' && entry.text !== norm(raw) ? ` · ${t.form(norm(raw))}` : ''}</p>}
          {state?.card ? (
            <p className={s.muted}>✓ {t.inCards}</p>
          ) : (
            <button type="button" className={ui.primary} onClick={() => void addWordCards(itemId)}>
              {t.addToCards}
            </button>
          )}
        </>
      ) : (
        <>
          <p className={s.muted}>{t.notFound}</p>
          <label className={s.label}>
            {t.own}
            <input className={s.input} value={own} onChange={(e) => setOwn(e.target.value)} placeholder={t.ownPlaceholder} />
          </label>
          <button type="button" className={ui.primary} disabled={!own.trim()} onClick={() => void saveUserWord(raw, own, context)}>
            {t.saveOwn}
          </button>
        </>
      )}
      <ClaudeButton label={t.askClaude} build={() => askWordPrompt(entry?.text ?? raw, context)} />
    </dialog>
  )
}
