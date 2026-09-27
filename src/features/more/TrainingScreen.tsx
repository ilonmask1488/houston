/*
  «Тренировка» (UX §3.1): всё, что по желанию сверх занятия — мини-игры, тексты, сюжет, слабые звуки.
  Внизу — ссылка на профиль и настройки. Маршрут /more.
*/
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { IconChevron } from '../../components/Icons'
import { Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { moduleById } from '../../content'
import { ru } from '../../i18n/ru'
import { db } from '../../lib/db/db'
import { GAME_IDS } from '../../lib/games/games'
import { lastIntake } from '../../lib/intake/store'
import { pairsByModule } from '../../lib/progress/stats'
import { EpisodeList } from '../story/EpisodeScreen'
import s from './TrainingScreen.module.css'

/** Вводный тест называет трудности тегами — у каждого свой модуль произношения. */
const TAG_MODULE: Record<string, string> = { th: 'clean-th', wv: 'clean-wv', vowels: 'clean-vowels', final: 'clean-final', ng: 'clean-ng' }

function Item({ to, title, what, extra }: { to: string; title: string; what: string; extra?: string }) {
  return (
    <li>
      <Link to={to} className={ui.item}>
        <span>
          <span className={ui.itemTitle}>{title}</span>
          <span className={ui.itemWhat}>{what}</span>
          {extra && <span className={`${ui.itemWhat} mono`}>{extra}</span>}
        </span>
        <IconChevron />
      </Link>
    </li>
  )
}

export function TrainingScreen() {
  const t = ru.training
  const data = useLiveQuery(async () => {
    const records = new Map((await db.gameRecords.toArray()).map((r) => [r.game, r.best]))
    const answers = await db.answers.where('at').above(Date.now() - 30 * 86_400_000).toArray()
    const worst = pairsByModule(answers).find((p) => p.correct / p.total < 0.8)
    const intake = await lastIntake()
    const fromIntake = intake?.result.weakTags.map((x) => TAG_MODULE[x]).find(Boolean)
    return { records, weak: worst?.tag ?? fromIntake }
  }, [])
  const weak = data?.weak ? moduleById.get(data.weak) : undefined
  return (
    <Screen title={t.title} subtitle={t.subtitle}>
      <section className={s.section}>
        <h2 className={s.h2}>
          {t.games} <span className={s.note}>· {t.gamesWhat}</span>
        </h2>
        <ul className={ui.list}>
          {GAME_IDS.map((g) => (
            <Item key={g} to={`/game/${g}`} title={ru.games[g].title} what={ru.games[g].what} extra={data?.records.get(g) ? ru.games.best(data.records.get(g)!) : undefined} />
          ))}
        </ul>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>{t.texts}</h2>
        <ul className={ui.list}>
          <Item to="/library" title={t.library.title} what={t.library.what} />
          <Item to="/mytext" title={t.myText.title} what={t.myText.what} />
        </ul>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>{t.weak}</h2>
        {weak ? (
          <div className={s.weak}>
            <p>{t.weakWhat(weak.title)}</p>
            <Link to={`/run/module/${weak.id}`} className={ui.secondary}>
              {t.weakOpen}: «{weak.title}»
            </Link>
          </div>
        ) : (
          <p className={s.note}>{t.weakNone}</p>
        )}
      </section>

      <section className={s.section}>
        <EpisodeList />
      </section>

      <section className={s.section}>
        <ul className={ui.list}>
          <Item to="/me" title={t.profile} what={ru.more.items.stats.what} />
        </ul>
      </section>
    </Screen>
  )
}
