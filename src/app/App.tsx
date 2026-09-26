import { Fragment, useEffect, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { CheckScreen } from '../features/check/CheckScreen'
import { DictionaryScreen } from '../features/dictionary/DictionaryScreen'
import { GameRoute } from '../features/games/GameScreen'
import { IntakeScreen } from '../features/intake/IntakeScreen'
import { ProfileScreen } from '../features/intake/ProfileScreen'
import { AboutScreen, AchievementsScreen, GamesScreen, MoreScreen } from '../features/more/MoreScreen'
import { LibraryScreen, LibraryText, MyTexts, MyTextView } from '../features/library/LibraryScreen'
import { BossRun, ModuleRun, SegmentRun, TextRun } from '../features/run/routes'
import { HomeScreen } from '../features/session/HomeScreen'
import { SessionScreen } from '../features/session/SessionScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { StatsScreen } from '../features/stats/StatsScreen'
import { EpisodeScreen } from '../features/story/EpisodeScreen'
import { InterviewScreen } from '../features/story/InterviewScreen'
import { Fluency432, StoryEditor, StoryScreen, StoryTrain } from '../features/story/StoryScreen'
import { TracksScreen } from '../features/tracks/TracksScreen'
import { configureAudio } from '../lib/audio/audio'
import { configureFeedback } from '../lib/audio/sfx'
import { applyAppearance, useSettings } from '../lib/settings/settings'
import { Shell } from './Shell'

/** Экран упражнения с новым :id — новый экземпляр: переход из модуля прямо в модуль не тянет за собой прошлый шаг. */
function Remount({ children }: { children: ReactNode }) {
  const { id } = useParams()
  return <Fragment key={id}>{children}</Fragment>
}

/*
  HashRouter: адреса вида …/#/tracks работают на GitHub Pages без серверных перенаправлений
  и в офлайне — сервер всегда отдаёт один index.html.
*/
export function App() {
  const settings = useSettings()
  useEffect(() => {
    configureAudio(settings)
    configureFeedback(settings)
  }, [settings])
  useEffect(() => {
    applyAppearance(settings)
    if (settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyAppearance(settings)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings])

  return (
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<HomeScreen />} />
          <Route path="session" element={<SessionScreen />} />
          <Route path="run/seg/:id" element={<Remount><SegmentRun /></Remount>} />
          <Route path="run/module/:id" element={<Remount><ModuleRun /></Remount>} />
          <Route path="run/text/:id" element={<Remount><TextRun /></Remount>} />
          <Route path="boss/:id" element={<Remount><BossRun /></Remount>} />
          <Route path="library" element={<LibraryScreen />} />
          <Route path="library/:id" element={<Remount><LibraryText /></Remount>} />
          <Route path="mytext" element={<MyTexts />} />
          <Route path="mytext/:id" element={<Remount><MyTextView /></Remount>} />
          <Route path="game/:id" element={<GameRoute />} />
          <Route path="games" element={<GamesScreen />} />
          <Route path="intake" element={<IntakeScreen />} />
          <Route path="profile" element={<ProfileScreen />} />
          <Route path="tracks" element={<TracksScreen />} />
          <Route path="story" element={<StoryScreen />} />
          <Route path="story/:id" element={<StoryEditor />} />
          <Route path="story/:id/train" element={<StoryTrain />} />
          <Route path="story/:id/432" element={<Fluency432 />} />
          <Route path="interview" element={<InterviewScreen />} />
          <Route path="episode/:id" element={<Remount><EpisodeScreen /></Remount>} />
          <Route path="dictionary" element={<DictionaryScreen />} />
          <Route path="more" element={<MoreScreen />} />
          <Route path="stats" element={<StatsScreen />} />
          <Route path="achievements" element={<AchievementsScreen />} />
          <Route path="check" element={<CheckScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="about" element={<AboutScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
