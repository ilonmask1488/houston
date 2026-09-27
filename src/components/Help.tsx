/* Кнопка «?» на экране упражнения (UX §1.7): короткое объяснение «как работает это упражнение». */
import { useState } from 'react'
import { ru } from '../i18n/ru'
import s from './Help.module.css'
import { Sheet } from './Sheet'

export function Help({ title, text }: { title: string; text: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={s.btn} aria-label={ru.help.label} aria-expanded={open} onClick={() => setOpen(true)}>
        ?
      </button>
      {open && (
        <Sheet title={title} onClose={() => setOpen(false)}>
          {text.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </Sheet>
      )}
    </>
  )
}
