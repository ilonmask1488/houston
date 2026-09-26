/* Словарь: чанки (все — это справочник фраз), слова (мои, термины, весь словарь) и фразы Эфира, которые уже встречались. */
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { PlayButton } from '../../components/Play'
import { Placeholder, Screen, Segmented } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { Highlight } from '../../components/Voice'
import { content, moduleById, spokenText } from '../../content'
import { ru } from '../../i18n/ru'
import { defaultVoice } from '../../lib/audio/audio'
import { db } from '../../lib/db/db'
import { addChunkCards } from '../../lib/srs/cards'
import s from './DictionaryScreen.module.css'
import { MailBankTab } from './MailBankTab'
import { WordsTab } from './WordsTab'

type Tab = 'chunks' | 'words' | 'mail' | 'phrases'

function norm(x: string): string {
  return x.toLowerCase().replace(/[’']/g, "'").replace(/ё/g, 'е')
}

export function DictionaryScreen() {
  const t = ru.dictionaryScreen
  const [tab, setTab] = useState<Tab>('chunks')
  const [q, setQ] = useState('')
  const state = useLiveQuery(async () => {
    const cards = await db.cards.toArray()
    const done = new Set((await db.moduleProgress.toArray()).flatMap((m) => m.done))
    return { inReview: new Set(cards.map((c) => c.itemId)), done }
  }, [])
  const voice = defaultVoice()
  const query = norm(q.trim())

  const chunks = useMemo(
    () => content.chunks.filter((c) => !query || norm(`${c.en} ${c.example ?? ''} ${c.ru} ${c.exampleRu ?? ''} ${c.fn}`).includes(query)),
    [query],
  )
  const phrases = useMemo(
    () =>
      content.phrases.filter(
        (p) => (state?.done.has(p.id) || state?.inReview.has(p.id)) && (!query || norm(`${p.text} ${p.ru} ${p.focus}`).includes(query)),
      ),
    [query, state],
  )
  // Чанки группами по функциям
  const groups = useMemo(() => {
    const m = new Map<string, typeof chunks>()
    for (const c of chunks) m.set(c.fn, [...(m.get(c.fn) ?? []), c])
    return [...m]
  }, [chunks])

  const placeholder = tab === 'words' ? t.wordsSearch : tab === 'mail' ? ru.mail.bankSearch : t.search

  return (
    <Screen title={t.title}>
      <input
        className={s.search}
        type="search"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label={placeholder}
      />
      <Segmented
        label={t.title}
        value={tab}
        options={(['chunks', 'words', 'mail', 'phrases'] as const).map((v) => ({ value: v, label: t.tabs[v]! }))}
        onChange={setTab}
      />
      {tab === 'words' && <WordsTab query={q} />}
      {tab === 'mail' && <MailBankTab query={q} />}
      {tab === 'chunks' &&
        (groups.length ? (
          groups.map(([fn, list]) => (
            <section key={fn} className={s.group}>
              <h2 className={s.fn}>{fn}</h2>
              <ul className={s.list}>
                {list.map((c) => (
                  <li key={c.id} className={s.row}>
                    <PlayButton text={c.en} voice={voice} label={c.en} size="s" />
                    <span className={s.main}>
                      <span className={s.en} lang="en">
                        {c.en}
                      </span>
                      <span className={s.ru}>{c.ru}</span>
                      {c.example && (
                        <span className={s.ex} lang="en">
                          {c.example}
                        </span>
                      )}
                    </span>
                    {state?.inReview.has(c.id) ? (
                      <span className={s.tag}>{t.inReview}</span>
                    ) : (
                      <button type="button" className={ui.link} onClick={() => void addChunkCards(c.id)}>
                        {t.addToReview}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <p className={s.empty}>{t.nothing}</p>
        ))}
      {tab === 'phrases' &&
        (phrases.length ? (
          <ul className={s.list}>
            {phrases.map((p) => (
              <li key={p.id} className={s.row}>
                <PlayButton text={spokenText(p)} voice={p.voice} label={p.text} size="s" />
                <span className={s.main}>
                  <span className={s.en}>
                    <Highlight text={p.text} focus={p.focus} />
                  </span>
                  <span className={s.ru}>
                    {p.ru} · {moduleById.get(p.module)?.title}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : query ? (
          <p className={s.empty}>{t.nothing}</p>
        ) : (
          <Placeholder text={t.phrasesEmpty} />
        ))}
    </Screen>
  )
}
