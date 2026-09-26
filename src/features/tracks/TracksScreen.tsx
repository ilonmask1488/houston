import { ScoreBar } from '../../components/Instruments'
import { Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { modulesByTrack } from '../../content'
import { TRACKS } from '../../content/types'
import { ru } from '../../i18n/ru'
import { startModule } from '../../lib/intake/score'
import { useIntakeState } from '../../lib/intake/store'
import s from './tracks.module.css'

export function TracksScreen() {
  const { last } = useIntakeState()
  const t = ru.trackScreen
  return (
    <Screen title={t.title} subtitle={t.subtitle}>
      {!last && <p className={`${ui.note} ${s.noProfile}`}>{t.noProfile}</p>}
      <div className={s.tracks}>
        {TRACKS.map((id) => {
          const modules = modulesByTrack.get(id) ?? []
          const score = last?.tracks[id]
          const start = last ? startModule(modules, score!, last.result.weakTags) : undefined
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
                {modules.map((m) => (
                  <li key={m.id} className={s.module} data-start={m.id === start?.id || undefined}>
                    <span className={`${s.order} mono`}>{String(m.order).padStart(2, '0')}</span>
                    <span>
                      <span className={s.mTitle}>
                        {m.title}
                        {m.id === start?.id && <span className={s.startTag}>{t.start}</span>}
                      </span>
                      <span className={s.mWhat}>{m.what}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )
        })}
      </div>
      <section className={s.story}>
        <h2>{t.story}</h2>
        <p className={ui.note}>{t.storySoon}</p>
      </section>
    </Screen>
  )
}
