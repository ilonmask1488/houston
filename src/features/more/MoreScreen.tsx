import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { IconChevron } from '../../components/Icons'
import { Mascot } from '../../components/Mascot'
import { Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { formatDate, ru } from '../../i18n/ru'
import { manifest } from '../../lib/audio/manifest'
import { db } from '../../lib/db/db'
import { GAME_IDS } from '../../lib/games/games'
import { ACHIEVEMENT_IDS } from '../../lib/progress/achievements'
import s from './MoreScreen.module.css'

const ITEMS = ['profile', 'stats', 'games', 'library', 'achievements', 'check', 'settings', 'about'] as const

export function MoreScreen() {
  return (
    <Screen title={ru.more.title}>
      <ul className={ui.list}>
        {ITEMS.map((key) => (
          <li key={key}>
            <Link to={`/${key}`} className={ui.item}>
              <span>
                <span className={ui.itemTitle}>{ru.more.items[key].title}</span>
                <span className={ui.itemWhat}>{ru.more.items[key].what}</span>
              </span>
              <IconChevron />
            </Link>
          </li>
        ))}
      </ul>
    </Screen>
  )
}

export function GamesScreen() {
  const records = useLiveQuery(async () => new Map((await db.gameRecords.toArray()).map((r) => [r.game, r])), [])
  const t = ru.games
  return (
    <Screen title={t.list} back>
      <ul className={ui.list}>
        {GAME_IDS.map((g) => (
          <li key={g}>
            <Link to={`/game/${g}`} className={ui.item}>
              <span>
                <span className={ui.itemTitle}>{t[g].title}</span>
                <span className={ui.itemWhat}>{t[g].what}</span>
                {records?.get(g) && <span className={`${ui.itemWhat} mono`}>{t.best(records.get(g)!.best)}</span>}
              </span>
              <IconChevron />
            </Link>
          </li>
        ))}
      </ul>
    </Screen>
  )
}

export function AchievementsScreen() {
  const got = useLiveQuery(async () => new Map((await db.achievements.toArray()).map((a) => [a.id, a.unlockedAt])), [])
  const t = ru.achievements
  return (
    <Screen title={t.title} back subtitle={got && got.size === 0 ? t.empty : undefined}>
      <ul className={s.achievements}>
        {ACHIEVEMENT_IDS.map((id) => {
          const at = got?.get(id)
          return (
            <li key={id} data-got={at ? true : undefined}>
              <span className={s.aName}>{t.list[id]?.name}</span>
              <span className={s.aWhat}>{t.list[id]?.what}</span>
              {at && (
                <span className={`${s.aWhen} mono`}>
                  {t.got} {formatDate(at)}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </Screen>
  )
}

const LICENSES: [string, string][] = [
  ['React, React Router', 'MIT'],
  ['Dexie', 'Apache-2.0'],
  ['Workbox, vite-plugin-pwa', 'MIT'],
  ['ts-fsrs (интервальное повторение)', 'MIT'],
  ['IBM Plex Sans, Sans Condensed, Mono', 'SIL Open Font License 1.1'],
  ['NGSL, NAWL, BSL — Browne, Culligan, Phillips', 'CC BY-SA 4.0'],
]

export function AboutScreen() {
  const t = ru.about
  return (
    <Screen title={t.title} back>
      <div className={s.about}>
        <Mascot mood="wink" size={88} />
        <p className="mono">{t.version(__APP_VERSION__, __BUILD_DATE__)}</p>
        <p>{t.privacy}</p>
        <h2>{t.licenses}</h2>
        <dl className={s.licenses}>
          {LICENSES.map(([what, lic]) => (
            <div key={what}>
              <dt>{what}</dt>
              <dd className="mono">{lic}</dd>
            </div>
          ))}
        </dl>
        <h2>{t.words}</h2>
        <p className={ui.note}>
          {t.wordsNote}{' '}
          <a href="https://www.newgeneralservicelist.com">newgeneralservicelist.com</a> ·{' '}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
        </p>
        <h2>{t.audio}</h2>
        <p className={ui.note}>{t.audioNote}</p>
        <dl className={s.licenses}>
          {Object.values(manifest.sources).map((src) => (
            <div key={src.name}>
              <dt>
                {src.name}
                <span className={ui.itemWhat}> · {src.credit}</span>
              </dt>
              <dd className="mono">{src.license}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Screen>
  )
}
