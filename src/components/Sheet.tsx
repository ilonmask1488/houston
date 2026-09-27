/*
  Нижний лист с объяснением: кнопка «?» на упражнении, пояснение термина по тапу, карточка слова.
  Закрывается кнопкой, тапом по затемнению и Escape.
*/
import { useEffect, useState, type ReactNode } from 'react'
import { ru } from '../i18n/ru'
import s from './Sheet.module.css'
import ui from './ui.module.css'

export function Sheet({ title, onClose, okLabel = ru.help.ok, children }: { title: string; onClose: () => void; okLabel?: string; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className={s.scrim} onClick={onClose}>
      <div className={s.panel} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
        <button type="button" className={ui.primary} onClick={onClose}>
          {okLabel}
        </button>
      </div>
    </div>
  )
}

export type TermKey = keyof typeof ru.terms

/** Термин или счётчик, который объясняется тапом (UX §5): «🔥 3 дня подряд», «Очки 1200 · Δv». */
export function Term({ k, children, className }: { k: TermKey; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const t = ru.terms[k]
  return (
    <>
      <button type="button" className={`${s.term} ${className ?? ''}`} data-term={k} aria-label={`${t.title}: объяснить`} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && (
        <Sheet title={t.title} onClose={() => setOpen(false)}>
          {t.text.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </Sheet>
      )}
    </>
  )
}
