/*
  Библиотека Техдока (/library, /library/:id) и «Мой текст» (/mytext, /mytext/:id):
  чтение с тапом по словам, озвучка по предложениям, «Объясни абзац» через Claude.
*/
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ClaudeButton } from '../../components/ClaudeButton'
import { IconSpeaker } from '../../components/Play'
import { TapText } from '../../components/TapText'
import { ConfirmDialog, Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { content, textById } from '../../content'
import { ru } from '../../i18n/ru'
import { defaultVoice, playSeries, stopAudio } from '../../lib/audio/audio'
import { explainPrompt } from '../../lib/claude/prompt'
import { db } from '../../lib/db/db'
import { splitSentences, wordCount } from '../../lib/story/text'
import { Meta, ParaRu } from '../run/doc'
import d from '../run/doc.module.css'
import s from './LibraryScreen.module.css'

/** Абзац: озвучка по предложениям с подсветкой текущего, слова нажимаются. */
function Paragraph({ text, tr }: { text: string; tr?: string }) {
  const sentences = useMemo(() => splitSentences(text), [text])
  const [at, setAt] = useState<number | null>(null)
  useEffect(() => () => stopAudio(), [])
  const play = () => {
    if (at !== null) {
      stopAudio()
      setAt(null)
      return
    }
    setAt(0)
    void playSeries(
      sentences.map((x) => ({ text: x, voice: defaultVoice() })),
      350,
      setAt,
    )
      .catch(() => {})
      .finally(() => setAt(null))
  }
  return (
    <div className={d.para}>
      <p>
        {sentences.map((x, k) => (
          <span key={k} className={s.sentence} data-on={at === k || undefined}>
            <TapText text={x} />{' '}
          </span>
        ))}
      </p>
      <div className={s.paraTools}>
        <button type="button" className={s.listen} data-playing={at !== null || undefined} onClick={play}>
          <IconSpeaker size={18} /> {at !== null ? ru.library.stop : ru.library.listen}
        </button>
        <ParaRu ru={tr} />
        <ClaudeButton label={ru.doc.explain} build={() => explainPrompt(text)} />
      </div>
    </div>
  )
}

export function LibraryScreen() {
  const t = ru.library
  const done = useLiveQuery(async () => new Set((await db.moduleProgress.toArray()).flatMap((m) => m.done)), [])
  const mine = useLiveQuery(() => db.myTexts.count(), [])
  const levels = [1, 2, 3] as const
  return (
    <Screen title={ru.doc.library} back subtitle={ru.doc.libraryWhat}>
      <Link to="/mytext" className={s.mine}>
        <span className={s.mineTitle}>{ru.doc.myText}</span>
        <span className={s.mineWhat}>{mine ? t.mineCount(mine) : ru.doc.myTextWhat}</span>
      </Link>
      {levels.map((lv) => (
        <section key={lv} className={s.level}>
          <h2 className={s.levelTitle}>{t.levels[lv]}</h2>
          <ul className={s.list}>
            {content.texts
              .filter((x) => x.level === lv && !x.module.startsWith('boss'))
              .map((x) => (
                <li key={x.id}>
                  <Link to={`/library/${x.id}`} className={s.item}>
                    <span className={s.itemTitle} lang="en">
                      {x.title}
                    </span>
                    <span className={`${s.itemMeta} mono`}>
                      {x.kind} · {ru.topics[x.topic]} · {t.words(wordCount(x.paragraphs.join(' ')))}
                      {done?.has(x.id) && ` · ${t.done}`}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
      <p className={s.note}>{t.license}</p>
    </Screen>
  )
}

export function LibraryText() {
  const id = useParams().id ?? ''
  const navigate = useNavigate()
  const x = textById.get(id)
  if (!x) return <Screen title={ru.run.notFound} back />
  return (
    <Screen title={ru.doc.library} back>
      <Meta t={x} />
      <h1 className={s.title} lang="en">
        {x.title}
      </h1>
      <p className={s.note}>{ru.doc.readHint}</p>
      <article className={d.article}>
        {x.paragraphs.map((p, i) => (
          <Paragraph key={i} text={p} tr={x.paragraphsRu?.[i]} />
        ))}
      </article>
      <p className={s.note}>
        {ru.doc.source}: {x.source}
      </p>
      <div className={s.actions}>
        <button type="button" className={ui.signalButton} onClick={() => navigate(`/run/text/${x.id}`)}>
          {ru.library.tasks}
        </button>
      </div>
    </Screen>
  )
}

/* ——— Мой текст ——— */

export function MyTexts() {
  const t = ru.library
  const navigate = useNavigate()
  const rows = useLiveQuery(() => db.myTexts.orderBy('createdAt').reverse().toArray(), [])
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const save = async () => {
    const body = text.trim()
    if (!body) return
    const id = await db.myTexts.add({ title: title.trim() || body.split(/\s+/).slice(0, 6).join(' '), text: body, createdAt: Date.now() })
    setText('')
    setTitle('')
    navigate(`/mytext/${id}`)
  }
  return (
    <Screen title={ru.doc.myText} back subtitle={t.myIntro}>
      <label className={s.label}>
        {t.titleLabel}
        <input className={s.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.titlePlaceholder} />
      </label>
      <label className={s.label}>
        {t.textLabel}
        <textarea className={s.area} lang="en" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.textPlaceholder} />
      </label>
      <p className={s.note}>{t.privacy}</p>
      <div className={s.actions}>
        <button type="button" className={ui.primary} disabled={!text.trim()} onClick={() => void save()}>
          {t.open}
        </button>
      </div>
      {rows && rows.length > 0 && (
        <section className={s.level}>
          <h2 className={s.levelTitle}>{t.saved}</h2>
          <ul className={s.list}>
            {rows.map((r) => (
              <li key={r.id}>
                <Link to={`/mytext/${r.id}`} className={s.item}>
                  <span className={s.itemTitle}>{r.title}</span>
                  <span className={`${s.itemMeta} mono`}>{t.words(wordCount(r.text))}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Screen>
  )
}

export function MyTextView() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const row = useLiveQuery(() => db.myTexts.get(id).then((x) => x ?? null), [id])
  const [confirm, setConfirm] = useState(false)
  if (row === undefined) return null
  if (!row) return <Screen title={ru.run.notFound} back />
  const paragraphs = row.text.split(/\n\s*\n|\r?\n/).map((p) => p.trim()).filter(Boolean)
  return (
    <Screen title={ru.doc.myText} back>
      <h1 className={s.title}>{row.title}</h1>
      <p className={s.note}>{ru.library.myHint}</p>
      <article className={d.article}>
        {paragraphs.map((p, i) => (
          <Paragraph key={i} text={p} />
        ))}
      </article>
      <div className={s.actions}>
        <button type="button" className={ui.link} onClick={() => setConfirm(true)}>
          {ru.library.delete}
        </button>
      </div>
      <ConfirmDialog
        open={confirm}
        title={ru.library.deleteTitle}
        confirm={ru.library.delete}
        cancel={ru.library.cancel}
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => void db.myTexts.delete(id).then(() => navigate('/mytext', { replace: true }))}
      >
        {ru.library.deleteConfirm}
      </ConfirmDialog>
    </Screen>
  )
}