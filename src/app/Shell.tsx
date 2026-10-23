import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { IconDictionary, IconSession, IconStory, IconTracks, IconTraining } from '../components/Icons'
import { Banner } from '../components/ui'
import ui from '../components/ui.module.css'
import { ru } from '../i18n/ru'
import { player } from '../lib/audio/player'
import s from './Shell.module.css'

const TABS = [
  { to: '/', label: ru.nav.session, icon: <IconSession /> },
  { to: '/tracks', label: ru.nav.tracks, icon: <IconTracks /> },
  { to: '/story', label: ru.nav.story, icon: <IconStory /> },
  { to: '/dictionary', label: ru.nav.dictionary, icon: <IconDictionary /> },
  { to: '/more', label: ru.nav.more, icon: <IconTraining /> },
]

/** Экраны, где нижняя навигация мешает (тест, упражнения и игры во весь экран). */
const FULLSCREEN = ['/intake', '/run/', '/game/', '/interview', '/episode/', '/boss/']

export function Shell() {
  const { pathname } = useLocation()
  const fullscreen = FULLSCREEN.some((p) => pathname.startsWith(p)) || pathname.endsWith('/train')
  const audioError = useAudioError()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return (
    <div className={s.app}>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
      <UpdateToasts audioError={audioError} />
      {!fullscreen && (
        <nav className={s.nav} aria-label="Разделы">
          <ul className={s.navList}>
            {TABS.map((t) => (
              <li key={t.to}>
                <NavLink to={t.to} end={t.to === '/'} className={s.navLink}>
                  {t.icon}
                  <span>{t.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}

/** Одна и та же ошибка звука не чаще раза в 10 минут: иначе без английского голоса баннер закрывал экран на каждой фразе. */
const AUDIO_ERROR_QUIET_MS = 10 * 60_000

/** Последняя ошибка звука — показывается 6 секунд. */
function useAudioError(): { message: string | null; close: () => void } {
  const [message, setMessage] = useState<string | null>(null)
  const shown = useRef(new Map<string, number>())
  useEffect(
    () =>
      player.onError((m) => {
        const now = Date.now()
        if (now - (shown.current.get(m) ?? -Infinity) < AUDIO_ERROR_QUIET_MS) return
        shown.current.set(m, now)
        setMessage(m)
      }),
    [],
  )
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 6000)
    return () => clearTimeout(t)
  }, [message])
  return { message, close: () => setMessage(null) }
}

function UpdateToasts({ audioError }: { audioError: { message: string | null; close: () => void } }) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (e) => console.error('SW registration', e),
  })
  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setOfflineReady(false), 4000)
    return () => clearTimeout(t)
  }, [offlineReady, setOfflineReady])
  if (!needRefresh && !offlineReady && !audioError.message) return null
  return (
    <div className={s.toasts}>
      {audioError.message && <Banner onClose={audioError.close}>{audioError.message}</Banner>}
      {needRefresh && (
        <Banner action={ru.banners.updateAction} onAction={() => void updateServiceWorker(true)} onClose={() => setNeedRefresh(false)}>
          {ru.banners.update}
        </Banner>
      )}
      {offlineReady && !needRefresh && <Banner onClose={() => setOfflineReady(false)}>{ru.banners.offlineReady}</Banner>}
    </div>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error(error)
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className={s.fatal} role="alert">
        <p>{ru.errors.boundary}</p>
        <button type="button" className={ui.secondary} onClick={() => location.reload()}>
          {ru.errors.reload}
        </button>
      </div>
    )
  }
}
