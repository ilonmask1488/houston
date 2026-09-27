/*
  «Курс» (UX §3.4): пять направлений. У каждого — понятное название (метафора мелко), зачем, уровень
  с объяснением по тапу и одна кнопка «Продолжить: модуль …». Список модулей свёрнут, статусы
  ✓ пройден · ● Ты здесь · ○ впереди. Экран открывается у последнего активного или самого слабого направления.
*/
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ScoreBar } from '../../components/Instruments'
import { Term } from '../../components/Sheet'
import { Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { modulesByTrack } from '../../content'
import { TRACKS, type TrackId } from '../../content/types'
import { ru } from '../../i18n/ru'
import { currentModule, hasContent, loadProgress, moduleShare } from '../../lib/course/progress'
import { db } from '../../lib/db/db'
import { startModule } from '../../lib/intake/score'
import { useIntakeState } from '../../lib/intake/store'
import s from './tracks.module.css'

export function TracksScreen() {
  const { last } = useIntakeState()
  const progress = useLiveQuery(() => loadProgress(), [])
  const data = useLiveQuery(async () => {
    const got = new Set((await db.achievements.toArray()).map((a) => a.id))
    const lastAnswer = await db.answers.orderBy('at').last()
    return {
      // Пройденные боссы — по достижениям (собеседование — «interview-1»)
      bosses: new Set((['air', 'call', 'doc', 'mail'] as const).filter((t) => got.has(t === 'call' ? 'interview-1' : `boss-${t}`))),
      lastTrack: lastAnswer?.track as TrackId | undefined,
    }
  }, [])
  const t = ru.trackScreen

  // Куда прокрутить: последнее активное направление, иначе самое слабое по вводному тесту.
  const focus = data?.lastTrack ?? (last ? [...TRACKS].sort((a, b) => last.tracks[a] - last.tracks[b])[0] : undefined)
  const scrolled = useRef(false)
  useEffect(() => {
    if (!data || !progress || scrolled.current || !focus || focus === TRACKS[0]) return
    scrolled.current = true
    document.getElementById(`track-${focus}`)?.scrollIntoView({ block: 'start' })
  }, [data, progress, focus])

  return (
    <Screen title={t.title} subtitle={t.subtitle}>
      {!last && <p className={`${ui.note} ${s.noProfile}`}>{t.noProfile}</p>}
      <div className={s.tracks}>
        {TRACKS.map((id) => {
          const modules = (modulesByTrack.get(id) ?? []).filter((m) => hasContent(m.id))
          const score = last?.tracks[id]
          const start = last ? startModule(modules, last.tracks[id], last.result.weakTags) : undefined
          const current = progress ? currentModule(id, progress, last) : undefined
          return (
            <section key={id} id={`track-${id}`} className={s.track} aria-labelledby={`track-title-${id}`}>
              <header className={s.head}>
                <h2 id={`track-title-${id}`}>{ru.tracks[id].title}</h2>
                <span className={s.alias}>· {ru.tracks[id].alias}</span>
                {score !== undefined && (
                  <Term k="trackLevel" className={`${s.score} mono`}>
                    {t.level(score)}
                  </Term>
                )}
              </header>
              <p className={s.what}>{ru.tracks[id].what}</p>
              {score !== undefined && <ScoreBar value={score} label={`${ru.tracks[id].title}: ${t.level(score)}`} />}
              {current && (
                <Link to={`/run/module/${current.id}`} className={`${ui.primary} ${s.continue}`}>
                  {t.continue(current.title)}
                </Link>
              )}
              <details className={s.all}>
                <summary>{t.modules(modules.length)}</summary>
                <ol className={s.modules}>
                  {modules.map((m) => {
                    const row = progress?.get(m.id)
                    const done = !!row?.completedAt
                    const here = m.id === current?.id
                    const share = progress ? Math.round(moduleShare(progress, m.id) * 100) : 0
                    return (
                      <li key={m.id}>
                        <Link to={`/run/module/${m.id}`} className={s.module} data-current={here || undefined} data-done={done || undefined}>
                          <span className={s.mark} aria-hidden>
                            {done ? '✓' : here ? '●' : '○'}
                          </span>
                          <span>
                            <span className={s.mTitle}>
                              {m.title}
                              {here && <span className={s.startTag}>{t.here}</span>}
                              {!here && m.id === start?.id && !done && <span className={s.tag}>{t.start}</span>}
                            </span>
                            <span className={s.mWhat}>
                              {m.what}
                              {done ? ` · ${t.done}` : share > 0 ? ` · ${t.share(share)}` : ''}
                            </span>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ol>
              </details>
              {id === 'doc' && (
                <Link to="/library" className={s.extra}>
                  {ru.doc.library} · {ru.doc.myText} →
                </Link>
              )}
              {id !== 'clean' && (
                <Link to={id === 'call' ? '/interview' : `/boss/${id}`} className={s.boss}>
                  <span className={`${s.bossTag} mono`}>{ru.boss.title}</span>
                  <span className={s.mTitle}>
                    {ru.boss[id].title}
                    {data?.bosses.has(id) && <span className={s.startTag}>{ru.boss.defeated}</span>}
                  </span>
                  <span className={s.mWhat}>{ru.boss[id].what}</span>
                </Link>
              )}
            </section>
          )
        })}
      </div>
    </Screen>
  )
}
