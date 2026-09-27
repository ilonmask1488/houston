import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Readout, ScoreBar } from '../../components/Instruments'
import { Term } from '../../components/Sheet'
import { PingSays, Placeholder, Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { modulesByTrack } from '../../content'
import { TRACKS } from '../../content/types'
import { formatDate, ru } from '../../i18n/ru'
import { retakeAt } from '../../lib/intake/plan'
import { startModule, trackLevel } from '../../lib/intake/score'
import { useIntakeState } from '../../lib/intake/store'
import s from './profile.module.css'

export function ProfileScreen() {
  const { last, loaded } = useIntakeState()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const t = ru.profile
  if (!loaded) return <Screen title={t.title} back />
  if (!last)
    return (
      <Screen title={t.title} back>
        <Placeholder text={t.empty}>
          <Link to="/intake" className={ui.secondary}>
            {ru.home.intakeStart}
          </Link>
        </Placeholder>
      </Screen>
    )
  const r = last.result
  const canRetake = Date.now() >= retakeAt(last.at)
  const fmtSpeed = (x: number | null) => (x === null ? null : `${x.toFixed(2).replace(/0$/, '')}×`)
  return (
    <Screen title={t.title} back subtitle={t.subtitle(formatDate(last.at))}>
      {params.get('fresh') && (
        <PingSays mood="celebrate" size={88}>
          {ru.lines.intake.done}
        </PingSays>
      )}
      <section className={s.top}>
        <Readout label={t.cefr} value={`≈ ${r.cefr}`} hint={t.cefrNote} />
        <Readout label={ru.intake.steps.vocab!} value={`≈ ${r.vocabSize}`} unit="слов" />
      </section>
      <Term k="cefr" className={s.termLink}>
        {t.cefrWhat}
      </Term>

      <section className={s.section}>
        <h2>{t.tracks}</h2>
        <ul className={s.tracks}>
          {TRACKS.map((id) => {
            const score = r.tracks[id]
            const start = startModule(modulesByTrack.get(id) ?? [], score, r.weakTags)
            return (
              <li key={id} className={s.track}>
                <div className={s.trackHead}>
                  <span className={s.channel}>{ru.tracks[id].alias}</span>
                  <span className={s.trackTitle}>{ru.tracks[id].title}</span>
                  <span className="mono">{score}</span>
                </div>
                <ScoreBar value={score} label={`${ru.tracks[id].title}: ${score} из 100`} />
                <p className={s.trackStart}>
                  {t.trackLevel(trackLevel(score))} · {t.start}: <strong>{start?.title}</strong>
                </p>
              </li>
            )
          })}
        </ul>
      </section>

      <section className={s.section}>
        <h2>{t.details}</h2>
        <ul className={s.details}>
          <li>{t.vocab(r.ngslKnown)}</li>
          <li>{t.listenComfort(fmtSpeed(r.listening.comfort))}</li>
          <li>{t.reading(r.reading.wpm)}</li>
          <li>{t.speaking(r.speaking.avgLatencyMs, r.speaking.avgSpeechMs)}</li>
        </ul>
        {r.weakTags.length > 0 && (
          <>
            <h3 className={s.weakTitle}>{t.weak}</h3>
            <p className={s.tags}>
              {r.weakTags.map((tag) => (
                <span key={tag}>{t.tags[tag] ?? tag}</span>
              ))}
            </p>
          </>
        )}
      </section>

      <div className={s.actions}>
        <button type="button" className={ui.signalButton} onClick={() => navigate('/')}>
          {t.toSession}
        </button>
        {canRetake ? (
          <Link to="/intake" className={ui.secondary}>
            {t.retake}
          </Link>
        ) : (
          <p className={ui.note}>{t.retakeAt(formatDate(retakeAt(last.at)))}</p>
        )}
      </div>
    </Screen>
  )
}
