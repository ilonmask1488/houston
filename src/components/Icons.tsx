/* Иконки — линейные, в духе приборной панели. */

type P = { size?: number }

const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** Сеанс: антенна с волнами */
export function IconSession({ size = 24 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
      <path d="M12 12v9M8.5 21h7" />
      <circle cx="12" cy="10" r="2" />
      <path d="M8.2 6.4a5.2 5.2 0 0 0 0 7.2M15.8 6.4a5.2 5.2 0 0 1 0 7.2" />
      <path d="M5.4 3.6a9.2 9.2 0 0 0 0 12.8M18.6 3.6a9.2 9.2 0 0 1 0 12.8" />
    </svg>
  )
}

/** Треки: уровни каналов */
export function IconTracks({ size = 24 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
      <path d="M4 20V14M9 20V8M14 20V11M19 20V4" strokeWidth="2.4" />
      <path d="M2.5 20.5h19" strokeWidth="1" />
    </svg>
  )
}

/** Мой рассказ: микрофон с репликой */
export function IconStory({ size = 24 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
      <rect x="4.5" y="3" width="6" height="11" rx="3" />
      <path d="M2 11a5.5 5.5 0 0 0 11 0M7.5 16.5V20M5 20.5h5" />
      <path d="M14.5 5h7M14.5 9h5.5M14.5 13h4" />
    </svg>
  )
}

export function IconDictionary({ size = 24 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <text x="12" y="17.5" textAnchor="middle" fontSize="15" fontWeight="600" fill="currentColor" style={{ fontFamily: 'var(--font-cond)' }}>
        Aa
      </text>
      <path d="M3.5 21h17" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

export function IconMore({ size = 24 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  )
}

export function IconChevron({ size = 20 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}

export function IconClose({ size = 20 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function IconBack({ size = 22 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
      <path d="m15 5-7 7 7 7" />
    </svg>
  )
}

export function IconSpeaker({ size = 22 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common} strokeWidth={1.8}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  )
}

export function IconMic({ size = 20 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common} strokeWidth={1.8}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  )
}

export function IconReplay({ size = 20 }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...common}>
      <path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" />
      <path d="M4 3.5v5h5" />
    </svg>
  )
}
