/* Вкладка «Слова»: мои слова (из текстов), технические термины по темам, поиск по всему словарю. */
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { PlayButton } from '../../components/Play'
import { Term } from '../../components/Sheet'
import ui from '../../components/ui.module.css'
import { content } from '../../content'
import type { DictWord } from '../../content/types'
import { ru } from '../../i18n/ru'
import { defaultVoice } from '../../lib/audio/audio'
import { db } from '../../lib/db/db'
import { dictById, dictWords, dictionaryLoaded, loadDictionary, norm } from '../../lib/dict/dict'
import { addWordCards } from '../../lib/srs/cards'
import s from './DictionaryScreen.module.css'

type Row = { id: string; text: string; ru: string; ipa?: string; note?: string; voices?: DictWord['voices'] }

function voiceFor(w: Row) {
  const v = defaultVoice()
  return w.voices?.length ? (w.voices.includes(v) ? v : w.voices[0]!) : v
}

function WordRow({ w, inReview }: { w: Row; inReview: boolean }) {
  const t = ru.dictionaryScreen
  return (
    <li className={s.row}>
      <PlayButton text={w.text} voice={voiceFor(w)} label={w.text} size="s" />
      <span className={s.main}>
        <span className={s.en} lang="en">
          {w.text} {w.ipa && <span className={`${s.ipa} mono`}>/{w.ipa}/</span>}
        </span>
        <span className={s.ru}>{w.ru}</span>
        {w.note && (
          <span className={s.ex} lang="en">
            {w.note}
          </span>
        )}
      </span>
      {inReview ? (
        <span className={s.tag}>{t.inReview}</span>
      ) : (
        <button type="button" className={ui.link} onClick={() => void addWordCards(w.id)}>
          {t.addToReview}
        </button>
      )}
    </li>
  )
}

const fromDict = (w: DictWord): Row => ({ id: w.id, text: w.text, ru: w.ru, ipa: w.ipa, voices: w.voices, note: ru.bands[w.band] })

export function WordsTab({ query }: { query: string }) {
  const t = ru.dictionaryScreen
  const [loaded, setLoaded] = useState(dictionaryLoaded())
  const [topic, setTopic] = useState<string | null>(null)
  useEffect(() => {
    if (!loaded) void loadDictionary().then(() => setLoaded(true))
  }, [loaded])
  const state = useLiveQuery(async () => {
    const cards = await db.cards.filter((c) => /^(w|u)-/.test(c.itemId)).toArray()
    return { inReview: new Set(cards.map((c) => c.itemId)), user: await db.userWords.orderBy('createdAt').reverse().toArray() }
  }, [])
  const q = norm(query)

  const mine = useMemo((): Row[] => {
    if (!state || !loaded) return []
    const own = state.user.map((u): Row => ({ id: u.id, text: u.text, ru: u.ru, note: u.context ?? t.mineOwn }))
    const own2 = new Set(own.map((x) => x.id))
    const fromCards = [...state.inReview].filter((id) => !own2.has(id) && dictById.has(id)).map((id) => fromDict(dictById.get(id)!))
    return [...own, ...fromCards.sort((a, b) => a.text.localeCompare(b.text))]
  }, [state, loaded, t.mineOwn])

  const found = useMemo((): Row[] => {
    if (!q || !loaded) return []
    const ruQ = query.trim().toLowerCase().replace(/ё/g, 'е')
    const hit = (w: { text: string; ru: string; forms?: string[] }) => w.text.toLowerCase().includes(q) || w.ru.toLowerCase().replace(/ё/g, 'е').includes(ruQ) || !!w.forms?.includes(q)
    const own = (state?.user ?? []).filter(hit).map((u): Row => ({ id: u.id, text: u.text, ru: u.ru, note: u.context ?? t.mineOwn }))
    // Сначала точные совпадения и технические термины
    const dict = dictWords
      .filter(hit)
      .sort((a, b) => Number(norm(b.text) === q) - Number(norm(a.text) === q) || Number(b.band === 'tech') - Number(a.band === 'tech') || (a.rank ?? 9999) - (b.rank ?? 9999))
      .map(fromDict)
    return [...own, ...dict].slice(0, 60)
  }, [q, query, loaded, state, t.mineOwn])

  const topics = useMemo(() => {
    const m = new Map<string, DictWord[]>()
    if (loaded) for (const w of dictWords) if (w.band === 'tech' && w.topic) m.set(w.topic, [...(m.get(w.topic) ?? []), w])
    return [...m]
  }, [loaded])

  if (!loaded || !state) return <p className={s.empty} aria-busy />
  const inReview = state.inReview

  if (q)
    return (
      <section className={s.group}>
        <h2 className={s.fn}>{t.found(found.length)}</h2>
        {found.length ? (
          <ul className={s.list}>
            {found.map((w) => (
              <WordRow key={w.id} w={w} inReview={inReview.has(w.id)} />
            ))}
          </ul>
        ) : (
          <p className={s.empty}>{t.nothing}</p>
        )}
      </section>
    )

  return (
    <>
      <section className={s.group}>
        <h2 className={s.fn}>{t.mine}</h2>
        {mine.length ? (
          <ul className={s.list}>
            {mine.map((w) => (
              <WordRow key={w.id} w={w} inReview={inReview.has(w.id)} />
            ))}
          </ul>
        ) : (
          <p className={s.empty}>{t.mineEmpty}</p>
        )}
      </section>
      <section className={s.group}>
        <h2 className={s.fn}>
          {t.terms} <span className={s.note}>· {t.termsNote}</span>
        </h2>
        <div className={s.topics}>
          {topics.map(([id, list]) => (
            <button key={id} type="button" className={s.topic} aria-pressed={topic === id} onClick={() => setTopic(topic === id ? null : id)}>
              {ru.topics[id] ?? id} <span className="mono">{list.length}</span>
            </button>
          ))}
        </div>
        {topic && (
          <ul className={s.list}>
            {(topics.find(([id]) => id === topic)?.[1] ?? [])
              .slice()
              .sort((a, b) => a.text.localeCompare(b.text))
              .map((w) => (
                <WordRow key={w.id} w={{ ...fromDict(w), note: undefined }} inReview={inReview.has(w.id)} />
              ))}
          </ul>
        )}
      </section>
      <section className={s.group}>
        <h2 className={s.fn}>
          <Term k="falseFriends">{t.falseFriends}</Term> <span className={s.note}>· {t.falseFriendsNote}</span>
        </h2>
        <ul className={s.list}>
          {content.falseFriends.map((f) => (
            <li key={f.id}>
              <details className={s.ff}>
                <summary>
                  <span>{f.ru}</span> → <span lang="en">{f.options[0]}</span> <span className={s.ffTrap}>{ru.clean.ffTrap(f.trap)}</span>
                </summary>
                <p className={s.ru}>{f.why}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
