/*
  «Сегодня» (UX §3.2): статус одной строкой, карточка «Занятие на сегодня» с главной кнопкой без прокрутки,
  маленький Ping, уровень одной строкой. Профиль, статистика и настройки — значок в правом верхнем углу.
*/
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconProfile } from '../../components/Icons'
import { SignalMeter } from '../../components/Instruments'
import { Term } from '../../components/Sheet'
import { Banner, PingSays } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { TRACKS, type TrackId } from '../../content/types'
import { ru } from '../../i18n/ru'
import { downloadBackup, shouldRemindBackup } from '../../lib/backup/backup'
import { db } from '../../lib/db/db'
import { useIntakeState } from '../../lib/intake/store'
import { signalBars } from '../../lib/progress/signal'
import { computeStreak, localDate } from '../../lib/progress/streak'
import { detectPlatform, isStandalone, useInstallPrompt } from '../../lib/pwa/install'
import { getTodaySession } from '../../lib/session/today'
import { useSettings } from '../../lib/settings/settings'
import s from './HomeScreen.module.css'
import { Welcome } from '../onboarding/Welcome'
import { nextSegment, planBlocks, planLine, segmentUrl } from './segments'

/** Подсказка «Установи на главный экран» после закрытия не возвращается месяц. */
const INSTALL_HINT_PAUSE_MS = 30 * 24 * 60 * 60 * 1000

export function HomeScreen() {
  const settings = useSettings()
  const navigate = useNavigate()
  const intake = useIntakeState()
  const telemetry = useLiveQuery(async () => {
    const days = await db.days.toArray()
    const streak = computeStreak(new Map(days.map((d) => [d.date, d.seconds])), localDate())
    return { days: streak.days, signal: days.reduce((sum, d) => sum + d.signal, 0) }
  }, [])
  const [greeting] = useState(() => ru.greetings[dayOfYear() % ru.greetings.length]!)
  // План на сегодня собирается, как только есть итог вводного теста.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (intake.last) void getTodaySession(settings.sessionMinutes).then(() => setReady(true))
  }, [intake.last, settings.sessionMinutes])
  const today = useLiveQuery(() => (ready ? db.sessions.get(localDate()) : undefined), [ready])
  const signal = telemetry?.signal ?? 0
  const days = telemetry?.days ?? 0
  const next = nextSegment(today)
  const doneSegs = today?.segments.filter((x) => x.status !== 'pending').length ?? 0
  const minutes = settings.sessionMinutes

  return (
    <main className={s.home}>
      <h1 className="visually-hidden">{ru.nav.session}</h1>
      <div className={`${s.telemetry} scale-rule`}>
        <span className={s.brand}>
          HOUSTON <span className={s.freq}>· {ru.mascot.name}</span>
        </span>
        <Link to="/me" className={s.me} aria-label={ru.home.profileLink}>
          <IconProfile />
        </Link>
        <span className={s.status}>
          <Term k="streak">
            🔥 <strong className="mono">{ru.home.airDays(days)}</strong>
          </Term>
          <span aria-hidden>·</span>
          <Term k="points">
            <span className="mono">{ru.home.points(signal)}</span>
          </Term>
          <SignalMeter value={signalBars(signal)} label={`${ru.terms.points.title}: ${signal}`} size="s" />
        </span>
      </div>

      <HomeBanners />

      {intake.loaded && !intake.last && (
        <section className={s.card}>
          <h2>{ru.home.intakeTitle}</h2>
          <p className={s.cardText}>{ru.home.intakeText}</p>
          <ol className={s.parts}>
            {ru.home.intakeParts.map((p) => (
              <li key={p} className="mono">
                {p}
              </li>
            ))}
          </ol>
          <button type="button" className={ui.signalButton} onClick={() => navigate('/intake')}>
            {intake.hasDraft ? ru.home.intakeContinue : ru.home.intakeStart}
          </button>
        </section>
      )}

      {intake.last && today && (
        <section className={s.card} aria-labelledby="today-title">
          <div className={s.cardHead}>
            <h2 id="today-title">{ru.home.todayTitle}</h2>
            <span className={`${s.min} mono`}>{ru.home.todayMinutes(minutes)}</span>
          </div>
          {!next ? (
            <>
              <p className={s.done}>{ru.home.doneTitle}</p>
              <p className={s.cardText}>{ru.home.doneText}</p>
              <button type="button" className={ui.secondary} onClick={() => navigate('/more')}>
                {ru.home.toTraining}
              </button>
            </>
          ) : (
            <>
              <p className={s.plan}>{planLine(today).join(' · ')}</p>
              {doneSegs > 0 && (
                <p className={`${s.progress} mono`}>
                  {ru.home.today(planBlocks(today).filter((b) => b.status === 'done').length, planBlocks(today).length)}
                </p>
              )}
              <button type="button" className={ui.signalButton} onClick={() => navigate(segmentUrl(next))}>
                {doneSegs > 0 ? ru.home.continue : ru.home.start}
              </button>
              <span className={s.hint}>{ru.home.startHint}</span>
            </>
          )}
          <Link to="/session" className={ui.link}>
            {ru.home.planLink}
          </Link>
        </section>
      )}

      <PingSays mood={intake.last ? 'happy' : 'wink'} size={56}>
        {greeting}
      </PingSays>

      {intake.last && <LevelLine cefr={intake.last.cefr} tracks={intake.last.tracks} />}
      {intake.last && <Welcome />}
    </main>
  )
}

/** Уровень одной строкой: «Уровень ≈ B1 · сильнее всего чтение, слабее всего говорение» → профиль. */
function LevelLine({ cefr, tracks }: { cefr: string; tracks: Record<TrackId, number> }) {
  const sorted = [...TRACKS].sort((a, b) => tracks[b] - tracks[a])
  return (
    <Link to="/profile" className={s.level}>
      {ru.home.levelLine(cefr, ru.tracks[sorted[0]!].short, ru.tracks[sorted[sorted.length - 1]!].short)} →
    </Link>
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
