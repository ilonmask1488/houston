import { useEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ru } from '../i18n/ru'
import { IconBack, IconClose } from './Icons'
import { Mascot, type MascotMood } from './Mascot'
import s from './ui.module.css'

type ScreenProps = {
  title: string
  subtitle?: ReactNode
  back?: boolean
  children?: ReactNode
  headerExtra?: ReactNode
}

export function Screen({ title, subtitle, back, children, headerExtra }: ScreenProps) {
  const navigate = useNavigate()
  return (
    <main className={s.screen}>
      <header className={`${s.header} scale-rule`}>
        {back && (
          <button type="button" className={s.backButton} onClick={() => navigate(-1)} aria-label={ru.placeholder.back}>
            <IconBack />
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{title}</h1>
          {subtitle && <p className={s.subtitle}>{subtitle}</p>}
        </div>
        {headerExtra}
      </header>
      {children}
    </main>
  )
}

export function Banner({
  children,
  action,
  onAction,
  onClose,
}: {
  children: ReactNode
  action?: string
  onAction?: () => void
  onClose?: () => void
}) {
  return (
    <div className={s.banner} role="status">
      <p>{children}</p>
      {action && onAction && (
        <button type="button" className={s.link} onClick={onAction}>
          {action}
        </button>
      )}
      {onClose && (
        <button type="button" className={s.iconButton} onClick={onClose} aria-label={ru.banners.close}>
          <IconClose />
        </button>
      )}
    </div>
  )
}

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className={s.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={s.segment}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint?: ReactNode
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={s.switchRow}
      onClick={() => onChange(!checked)}
    >
      <span className={s.switchText}>
        {label}
        {hint && <span className={s.switchHint}>{hint}</span>}
      </span>
      <span className={s.switchTrack} />
    </button>
  )
}

/** Пустое состояние: объясняет, что здесь появится и когда. */
export function Placeholder({ mood = 'thinking', text, children }: { mood?: MascotMood; text: string; children?: ReactNode }) {
  return (
    <div className={s.placeholder}>
      <Mascot mood={mood} size={104} />
      <p>{text}</p>
      {children}
    </div>
  )
}

/** Реплика маскота: Ping + «пузырь». */
export function PingSays({ mood = 'happy', children, size = 72 }: { mood?: MascotMood; children: ReactNode; size?: number }) {
  return (
    <div className={s.says}>
      <Mascot mood={mood} size={size} />
      <p className={s.bubble}>{children}</p>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  confirm,
  cancel,
  danger,
  children,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  confirm: string
  cancel: string
  danger?: boolean
  children: ReactNode
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className={s.dialog} onCancel={onCancel} aria-labelledby="dialog-title">
      <h2 id="dialog-title">{title}</h2>
      <p>{children}</p>
      <div className={s.dialogButtons}>
        <button type="button" className={s.secondary} onClick={onCancel}>
          {cancel}
        </button>
        <button type="button" className={danger ? s.danger : s.secondary} onClick={onConfirm} autoFocus={!danger}>
          {confirm}
        </button>
      </div>
    </dialog>
  )
}
