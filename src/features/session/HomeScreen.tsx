import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ScoreBar, SignalMeter } from '../../components/Instruments'
import { Banner, PingSays } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { TRACKS } from '../../content/types'
import { ru } from '../../i18n/ru'
import { downloadBackup, shouldRemindBackup } from '../../lib/backup/backup'
import { db } from '../../lib/db/db'
import { useIntakeState } from '../../lib/intake/store'
import { signalBars } from '../../lib/progress/signal'
import { computeStreak, localDate } from '../../lib/progress/streak'
import { detectPlatform, isStandalone, useInstallPrompt } from '../../lib/pwa/install'
import { planSession } from '../../lib/session/plan'
import { useSettings } from '../../lib/settings/settings'
import s from './HomeScreen.module.css'

const INSTALL_HINT_PAUSE_MS = 14 * 24 * 60 * 60 * 1000

export function HomeScreen() {
  const settings = useSettings()
  const navigate = useNavigate()
  const plan = planSession(settings.sessionMinutes)
  const intake = useIntakeState()
  const telemetry = useLiveQuery(async () => {
    const days = await db.days.toArray()
    const streak = computeStreak(new Map(days.map((d) => [d.date, d.seconds])), localDate())
    return { days: streak.days, reserve: streak.reserveUsed, signal: days.reduce((sum, d) => sum + d.signal, 0) }
  }, [])
  const [greeting] = useState(() => ru.greetings[dayOfYear() % ru.greetings.length]!)
  const [soon, setSoon] = useState(false)
  const signal = telemetry?.signal ?? 0

  return (
    <main className={s.home}>
      <h1 className="visually-hidden">{ru.nav.session}</h1>
      <div className={`${s.telemetry} scale-rule`}>
        <span className={s.brand}>
          HOUSTON <span className={s.freq}>· {ru.mascot.name}</span>
        </span>
        <span className={s.days} aria-label={ru.home.airDays(telemetry?.days ?? 0)}>
          <strong className="mono">{telemetry?.days ?? 0}</strong> {ru.home.airDaysLabel(telemetry?.days ?? 0)}
        </span>
        <span className={s.signal}>
          <span className={s.signalLabel}>{ru.home.signal}</span>
          <SignalMeter value={signalBars(signal)} label={`${ru.home.signal}: ${signal}`} size="s" />
          <strong className="mono">{signal}</strong>
        </span>
      </div>

      <HomeBanners />

      <PingSays mood={intake.last ? 'happy' : 'wink'} size={96}>
        {greeting}
      </PingSays>

      {intake.loaded && !intake.last && (
        <section className={s.intake}>
          <h2>{ru.home.intakeTitle}</h2>
          <p>{ru.home.intakeText}</p>
          <ol className={s.parts}>
            {ru.home.intakeParts.map((p) => (
              <li key={p} className="mono">
                {p}
              </li>
            ))}
          </ol>
        </section>
      )}

      {intake.last && (
        <section className={s.profile}>
          <div className={s.profileHead}>
            <h2>{ru.home.profile}</h2>
            <span className={s.cefr}>
              <span className="mono">{ru.home.level(intake.last.cefr)}</span>
              <span className={s.cefrHint}>{ru.home.levelHint}</span>
            </span>
          </div>
          <ul className={s.trackBars}>
            {TRACKS.map((t) => (
              <li key={t}>
                <span className={s.trackName}>{ru.tracks[t].title}</span>
                <ScoreBar value={intake.last!.tracks[t]} label={ru.tracks[t].title} />
                <span className="mono">{intake.last!.tracks[t]}</span>
              </li>
            ))}
          </ul>
          <Link to="/profile" className={ui.link}>
            {ru.home.toProfile}
          </Link>
        </section>
      )}

      {intake.last && (
        <section className={s.timeline}>
          <h2>{ru.home.timelineTitle(settings.sessionMinutes)}</h2>
          <div className={s.bar} aria-hidden>
            {plan.map((b) => (
              <span key={b.id} className={s.segment} data-block={b.id} style={{ flexGrow: b.minutes }} />
            ))}
          </div>
          <ol className={s.rows}>
            {plan.map((b) => (
              <li key={b.id} className={s.row}>
                <span className={`${s.t} mono`}>T+{String(b.startsAt).padStart(2, '0')}</span>
                <span>
                  <span className={s.blockTitle}>{ru.blocks[b.id].title}</span>
                  <span className={s.blockWhat}>{ru.blocks[b.id].what}</span>
                </span>
                <span className={`${s.min} mono`}>{b.minutes} мин</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className={s.launch}>
        {soon && <p className={s.soon}>{ru.placeholder.session}</p>}
        {intake.loaded &&
          (intake.last ? (
            <button type="button" className={ui.signalButton} onClick={() => setSoon(true)}>
              {ru.home.start}
            </button>
          ) : (
            <button type="button" className={ui.signalButton} onClick={() => navigate('/intake')}>
              {intake.hasDraft ? ru.home.intakeContinue : ru.home.intakeStart}
            </button>
          ))}
        <span className={s.launchHint}>{ru.home.startHint}</span>
      </div>
    </main>
  )
}

function HomeBanners() {
  const meta = useLiveQuery(async () => ({
    firstLaunchAt: await db.getMeta<number>('firstLaunchAt'),
    lastBackupAt: await db.getMeta<number>('lastBackupAt'),
    backupDismissedAt: await db.getMeta<number>('backupReminderDismissedAt'),
    installDismissedAt: await db.getMeta<number>('installHintDismissedAt'),
    now: Date.now(),
  }))
  const install = useInstallPrompt()
  if (!meta) return null

  const { now } = meta
  const platform = detectPlatform()
  const showInstall = !isStandalone() && (platform !== 'desktop' || install.canPrompt) && now - (meta.installDismissedAt ?? 0) >= INSTALL_HINT_PAUSE_MS
  const showBackup = shouldRemindBackup(now, meta.firstLaunchAt, meta.lastBackupAt, meta.backupDismissedAt)
  if (!showInstall && !showBackup) return null

  const installText = platform === 'ios' ? ru.banners.installIos : install.canPrompt ? ru.banners.installAndroid : ru.banners.installGeneric

  return (
    <div className={s.banners}>
      {showInstall && (
        <Banner
          action={install.canPrompt ? ru.banners.install : undefined}
          onAction={() => void install.prompt()}
          onClose={() => void db.setMeta('installHintDismissedAt', Date.now())}
        >
          {installText}
        </Banner>
      )}
      {showBackup && (
        <Banner action={ru.banners.backupAction} onAction={() => void downloadBackup()} onClose={() => void db.setMeta('backupReminderDismissedAt', Date.now())}>
          {ru.banners.backup}
        </Banner>
      )}
    </div>
  )
}

function dayOfYear(d = new Date()): number {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000)
}
