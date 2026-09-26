import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { ScoreBar } from '../../components/Instruments'
import { Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { modulesByTrack } from '../../content'
import { TRACKS } from '../../content/types'
import { ru } from '../../i18n/ru'
import { currentModule, hasContent, loadProgress, moduleShare } from '../../lib/course/progress'
import { db } from '../../lib/db/db'
import { startModule } from '../../lib/intake/score'
import { EpisodeList } from '../story/EpisodeScreen'
import { useIntakeState } from '../../lib/intake/store'
import s from './tracks.module.css'

export function TracksScreen() {
  const { last } = useIntakeState()
  const progress = useLiveQuery(() => loadProgress(), [])
  // Пройденные боссы — по достижениям (собеседование — «interview-1»)
  const bosses = useLiveQuery(async () => {
    const got = new Set((await db.achievements.toArray()).map((a) => a.id))
    return new Set((['air', 'call', 'doc', 'mail'] as const).filter((t) => got.has(t === 'call' ? 'interview-1' : `boss-${t}`)))
  }, [])
  const t = ru.trackScreen
  return (
    <Screen title={t.title} subtitle={t.subtitle}>
      {!last && <p className={`${ui.note} ${s.noProfile}`}>{t.noProfile}</p>}
      <div className={s.tracks}>
        {TRACKS.map((id) => {
          const modules = modulesByTrack.get(id) ?? []
          const score = last?.tracks[id]
          const start = last ? startModule(modules, last.tracks[id], last.result.weakTags) : undefined
          const current = progress ? currentModule(id, progress, last) : undefined
          return (
            <section key={id} className={s.track} aria-labelledby={`track-${id}`}>
              <header className={s.head}>
                <span className={`${s.channel} mono`}>{ru.tracks[id].channel}</span>
                <h2 id={`track-${id}`}>{ru.tracks[id].title}</h2>
                {score !== undefined && <span className="mono">{score}</span>}
              </header>
              <p className={s.what}>{ru.tracks[id].what}</p>
              {score !== undefined && <ScoreBar value={score} label={`${ru.tracks[id].title}: ${score}`} />}
              <ol className={s.modules}>
                {modules.map((m) => {
                  const ready = hasContent(m.id)
                  const row = progress?.get(m.id)
                  const share = progress ? Math.round(moduleShare(progress, m.id) * 100) : 0
                  return (
                    <li key={m.id} className={s.module} data-start={m.id === start?.id || undefined} data-current={m.id === current?.id || undefined} data-done={row?.completedAt ? true : undefined}>
                      <span className={`${s.order} mono`}>{row?.completedAt ? '✓' : String(m.order).padStart(2, '0')}</span>
                      <span>
                        <span className={s.mTitle}>
                          {m.title}
                          {m.id === start?.id && <span className={s.startTag}>{t.start}</span>}
                        </span>
                        <span className={s.mWhat}>{m.what}</span>
                        {ready && share > 0 && !row?.completedAt && <span className={`${s.share} mono`}>{t.share(share)}</span>}
                      </span>
                      {ready ? (
                        <Link to={`/run/module/${m.id}`} className={s.open} aria-label={`${t.open}: ${m.title}`}>
                          {t.open}
                        </Link>
                      ) : (
                        <span className={s.soon}>{t.soon}</span>
                      )}
                    </li>
                  )
                })}
              </ol>
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
                    {bosses?.has(id) && <span className={s.startTag}>{ru.boss.defeated}</span>}
                  </span>
                  <span className={s.mWhat}>{ru.boss[id].what}</span>
                </Link>
              )}
            </section>
          )
        })}
      </div>
      <div className={s.story}>
        <EpisodeList />
      </div>
    </Screen>
  )
}
