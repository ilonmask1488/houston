/* Вкладка «Письма»: банк готовых фраз для деловых писем (ТЗ §6.4) — справочник вне уроков. */
import { useMemo } from 'react'
import { content } from '../../content'
import { ru } from '../../i18n/ru'
import s from './DictionaryScreen.module.css'

function norm(x: string): string {
  return x.toLowerCase().replace(/[’']/g, "'").replace(/ё/g, 'е')
}

export function MailBankTab({ query }: { query: string }) {
  const t = ru.mail
  const q = norm(query.trim())
  const groups = useMemo(
    () => content.mailBank.map((g) => ({ ...g, phrases: g.phrases.filter((p) => !q || norm(`${p.en} ${p.ru} ${g.title}`).includes(q)) })).filter((g) => g.phrases.length),
    [q],
  )
  return (
    <>
      <p className={s.empty}>{t.bankNote}</p>
      {groups.length ? (
        groups.map((g) => (
          <section key={g.id} className={s.group}>
            <h2 className={s.fn}>{g.title}</h2>
            <ul className={s.list}>
              {g.phrases.map((p) => (
                <li key={p.en} className={s.bankRow}>
                  <span className={s.main}>
                    <span className={s.en} lang="en">
                      {p.en}
                    </span>
                    <span className={s.ru}>{p.ru}</span>
                  </span>
                  <span className={`${s.tag} mono`} data-reg={p.reg}>
                    {t.register[p.reg]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <p className={s.empty}>{ru.dictionaryScreen.nothing}</p>
      )}
    </>
  )
}
