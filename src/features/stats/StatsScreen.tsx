import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Readout, ScoreBar } from '../../components/Instruments'
import { Placeholder, Screen } from '../../components/ui'
import { modulesByTrack, moduleById } from '../../content'
import { TRACKS } from '../../content/types'
import { formatSeconds, ru } from '../../i18n/ru'
import { hasContent, loadProgress } from '../../lib/course/progress'
import { db } from '../../lib/db/db'
import { dictById } from '../../lib/dict/dict'
import { avgLatency, listeningBySpeed, minutesByDay, readingStats, weakTags, wordsByBand } from '../../lib/progress/stats'
import { AIR_DAY_SECONDS, computeStreak, localDate } from '../../lib/progress/streak'
import { useSettings } from '../../lib/settings/settings'
import { prepareItems, retentionStats } from '../../lib/srs/cards'
import s from './StatsScreen.module.css'

export function StatsScreen() {
  const t = ru.stats
  const settings = useSettings()
  const [tip, setTip] = useState<string | null>(null)
  const data = useLiveQuery(async () => {
    const days = await db.days.toArray()
    const today = localDate()
    const answers = await db.answers.where('at').above(Date.now() - 30 * 86_400_000).toArray()
    return {
      days,
      today,
      streak: computeStreak(new Map(days.map((d) => [d.date, d.seconds])), today),
      bars: minutesByDay(days, today),
      speed: listeningBySpeed(answers),
      latency: avgLatency(answers),
      weak: weakTags(answers),
      progress: await loadProgress(),
      cards: await db.cards.count(),
      retention: await retentionStats(),
      reading: readingStats(answers),
      words: await (async () => {
        await prepareItems()
        const ids = (await db.cards.where('kind').equals(1).toArray()).map((c) => c.itemId).filter((id) => /^(w|u)-/.test(id))
        return wordsByBand(ids, (id) => dictById.get(id)?.band)
      })(),
    }
  }, [])
  if (!data) return <Screen title={t.title} back />
  const total = data.days.reduce((a, d) => a + d.seconds, 0)
  if (!total)
    return (
      <Screen title={t.title} back>
        <Placeholder text={t.empty} />
      </Screen>
    )
  const spoken = data.days.reduce((a, d) => a + d.spokenSeconds, 0)
  const max = Math.max(AIR_DAY_SECONDS / 60, ...data.bars.map((b) => b.minutes))
  const fmt = (x: number) => `${x.toFixed(2).replace(/0$/, '')}×`
  return (
    <Screen title={t.title} back>
      <div className={s.readouts}>
        <Readout label={t.airDays} value={data.streak.days} hint={data.streak.reserveUsed ? ru.home.reserve : undefined} />
        <Readout label={t.minutes} value={Math.round(total / 60)} unit="мин" />
        <Readout label={t.spoken} value={formatSeconds(spoken)} />
        <Readout label={t.signal} value={data.days.reduce((a, d) => a + d.signal, 0)} />
      </div>
      <p className={s.note}>{t.rule}</p>

      <section className={s.section}>
        <h2>{t.byDay}</h2>
        <div className={s.chart} role="img" aria-label={t.chartLabel}>
          <span className={s.threshold} style={{ bottom: `${(100 * AIR_DAY_SECONDS) / 60 / max}%` }} aria-hidden />
          {data.bars.map((b) => (
            <button
              key={b.date}
              type="button"
              className={s.col}
              aria-label={t.tooltip(b.date, b.minutes, b.spokenMinutes)}
              onClick={() => setTip(t.tooltip(new Date(b.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), b.minutes, b.spokenMinutes))}
            >
              <span className={s.bar} style={{ height: `${(100 * b.minutes) / max}%` }}>
                <span className={s.spoken} style={{ height: b.minutes ? `${Math.min(100, (100 * b.spokenMinutes) / b.minutes)}%` : 0 }} />
              </span>
            </button>
          ))}
        </div>
        <p className={s.note}>{tip ?? t.byDayLegend}</p>
      </section>

      <section className={s.section}>
        <h2>{t.speed}</h2>
        <p className="mono">{t.comfort(data.speed.comfort ? fmt(data.speed.comfort) : null)}</p>
        <ul className={s.speeds}>
          {data.speed.buckets.map((b) => (
            <li key={b.speed}>
              <span className="mono">{fmt(b.speed)}</span>
              <ScoreBar value={b.total ? (100 * b.correct) / b.total : 0} label={`${fmt(b.speed)}: ${b.correct} из ${b.total}`} marker={70} />
              <span className="mono">
                {b.correct}/{b.total}
              </span>
            </li>
          ))}
        </ul>
        <p className={s.note}>{t.speedNote}</p>
        <h3 className={s.h3}>{t.weak}</h3>
        {data.weak.length ? (
          <ul className={s.weak}>
            {data.weak.slice(0, 4).map((w) => (
              <li key={w.tag}>
                {moduleById.get(w.tag)?.title ?? w.tag} · <span className="mono">{Math.round(w.errorRate * 100)}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.note}>{t.weakEmpty}</p>
        )}
      </section>

      <section className={s.section}>
        <h2>{t.latency}</h2>
        <p className="mono">{t.latencyValue(data.latency)}</p>
      </section>

      <section className={s.section}>
        <h2>{t.reading}</h2>
        <p className="mono">{t.wpm(data.reading.wpm, data.reading.texts)}</p>
        <p className="mono">{t.find(data.reading.found, data.reading.findTotal, data.reading.findMs)}</p>
        <h3 className={s.h3}>{t.words}</h3>
        {data.words.length ? (
          <ul className={s.weak}>
            {data.words.map((w) => (
              <li key={w.band}>
                {w.band === 'own' ? t.ownWords : ru.bands[w.band]} · <span className="mono">{w.n}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.note}>{t.wordsEmpty}</p>
        )}
      </section>

      <section className={s.section}>
        <h2>{t.tracks}</h2>
        <ul className={s.tracks}>
          {TRACKS.map((id) => {
            const mods = (modulesByTrack.get(id) ?? []).filter((m) => hasContent(m.id))
            const done = mods.filter((m) => data.progress.get(m.id)?.completedAt).length
            return (
              <li key={id}>
                <span className={s.trackName}>{ru.tracks[id].title}</span>
                <span className={s.note}>{mods.length ? t.modulesDone(done, mods.length) : ru.trackScreen.soon}</span>
              </li>
            )
          })}
        </ul>
        <p>
          {t.cards}: <span className="mono">{data.cards}</span>
        </p>
        <p>
          {t.retention}:{' '}
          <span className="mono">
            {data.retention.retention === null ? t.retentionEmpty : `${Math.round(data.retention.retention * 100)}% (цель ${Math.round(settings.desiredRetention * 100)}%)`}
          </span>
        </p>
      </section>
    </Screen>
  )
}
