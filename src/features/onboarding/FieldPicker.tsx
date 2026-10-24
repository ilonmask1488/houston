/*
  Выбор специальности при первом запуске (до вводного теста). Тем, кто уже занимался до появления
  специальностей, — тихо ставим «космос»: их прогресс и привычный стиль не меняются.
  Смена стиля и контента — через перезагрузку: они применяются при старте (main.tsx).
*/
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Mascot } from '../../components/Mascot'
import { FIELDS, type Field } from '../../content/types'
import { ru } from '../../i18n/ru'
import { skinField } from '../../i18n/skins'
import { db } from '../../lib/db/db'
import { loadSettings, saveField, storedField } from '../../lib/settings/settings'
import s from './Welcome.module.css'
import f from './FieldPicker.module.css'

export function FieldPicker() {
  const state = useLiveQuery(async () => {
    // база — для живого обновления; storedField учитывает и зеркало в localStorage
    const settings = await loadSettings()
    const field = settings.field ?? (await storedField())
    const existing = (await db.moduleProgress.count()) + (await db.intake.count()) + (await db.cards.count()) > 0
    return { field, existing }
  }, [])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (state && !state.field && state.existing) void saveField('space')
  }, [state])
  if (!state || state.field || state.existing) return null
  const t = ru.field
  const choose = async (field: Field) => {
    setBusy(true)
    await saveField(field)
    if (field !== skinField) window.location.reload()
  }
  return (
    <div className={s.scrim} role="dialog" aria-modal="true" aria-label={t.title}>
      <div className={s.panel}>
        <h2>{t.title}</h2>
        <p>{t.text}</p>
        <div className={f.options} role="group" aria-label={t.title}>
          {FIELDS.map((id) => (
            <button key={id} type="button" className={f.option} disabled={busy} onClick={() => void choose(id)}>
              <span className={f.title}>{t.options[id]!.title}</span>
              <span className={f.what}>{t.options[id]!.what}</span>
            </button>
          ))}
        </div>
        <Mascot mood="wink" size={56} />
      </div>
    </div>
  )
}
