/* «Как устроено приложение» (UX §6): что где лежит, что значат числа и значки; «Показать обучение заново». */
import { useNavigate } from 'react-router-dom'
import { Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { ru } from '../../i18n/ru'
import { db } from '../../lib/db/db'
import s from './MoreScreen.module.css'

export function HowScreen() {
  const t = ru.how
  const navigate = useNavigate()
  return (
    <Screen title={t.title} subtitle={t.intro} back>
      <div className={s.how}>
        {t.sections.map((sec) => (
          <section key={sec.title} className={s.howSection}>
            <h2>{sec.title}</h2>
            {sec.text.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
        ))}
        {Object.values(ru.terms).map((term) => (
          <section key={term.title} className={s.howSection}>
            <h2>{term.title}</h2>
            {term.text.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
        ))}
        <button
          type="button"
          className={ui.secondary}
          onClick={() => {
            void db.setMeta('welcomeSeen', 'tour').then(() => navigate('/'))
          }}
        >
          {t.replay}
        </button>
      </div>
    </Screen>
  )
}
