/*
  Ping — маленький спутник-ретранслятор, собственный рисунок.
  Корпус, две солнечные панели, тарелка антенны с облучателем; из антенны расходятся волны сигнала.
  Состояния: радуется, думает, подмигивает, «ой», празднует.
*/

export type MascotMood = 'happy' | 'thinking' | 'wink' | 'oops' | 'celebrate'

type Props = { mood?: MascotMood; size?: number; className?: string; title?: string }

const INK = 'var(--ink)'

export function Mascot({ mood = 'happy', size = 96, className, title }: Props) {
  return (
    <svg
      viewBox="0 0 160 140"
      width={size}
      height={(size * 140) / 160}
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      data-mood={mood}
    >
      {/* волны сигнала */}
      {mood !== 'oops' && mood !== 'thinking' && (
        <g fill="none" stroke="var(--signal)" strokeWidth="3.5" strokeLinecap="round">
          <path d="M71 17 Q80 11 89 17" />
          {(mood === 'celebrate' || mood === 'wink') && <path d="M64 9 Q80 -1 96 9" opacity="0.7" />}
        </g>
      )}
      {/* облучатель и штанга */}
      <path d="M80 50 L80 28" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <circle cx="80" cy="26" r="4" fill="var(--signal)" stroke={INK} strokeWidth="2.5" />
      {/* тарелка */}
      <path d="M54 38 Q80 64 106 38 Z" fill="var(--surface)" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M80 51 L80 62" stroke={INK} strokeWidth="3" />
      {/* солнечные панели */}
      <g stroke={INK} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M46 89 L56 89" strokeWidth="3" />
        <path d="M104 89 L114 89" strokeWidth="3" />
        <rect x="6" y="76" width="40" height="26" rx="2" fill="var(--surface)" />
        <rect x="114" y="76" width="40" height="26" rx="2" fill="var(--surface)" />
      </g>
      <g stroke={INK} strokeWidth="1.3" opacity="0.55">
        <path d="M16 76 V102 M26 76 V102 M36 76 V102 M6 89 H46" />
        <path d="M124 76 V102 M134 76 V102 M144 76 V102 M114 89 H154" />
      </g>
      {/* корпус */}
      <rect x="56" y="62" width="48" height="54" rx="12" fill="var(--surface)" stroke={INK} strokeWidth="3" />
      <path d="M60 108 H100" stroke="var(--signal)" strokeWidth="4" strokeLinecap="round" />
      <Face mood={mood} />
      {mood === 'celebrate' && (
        <g stroke="var(--signal)" strokeWidth="3" strokeLinecap="round">
          <path d="M20 40 L20 52 M14 46 L26 46" />
          <path d="M140 30 L140 40 M135 35 L145 35" />
          <path d="M132 58 L142 58" />
        </g>
      )}
      {mood === 'thinking' && (
        <g fill="var(--ink-2)">
          <circle cx="116" cy="54" r="3" />
          <circle cx="126" cy="42" r="4.5" />
        </g>
      )}
    </svg>
  )
}

function Face({ mood }: { mood: MascotMood }) {
  const cheeks = (
    <g fill="var(--signal)" opacity="0.4">
      <ellipse cx="65" cy="95" rx="4.5" ry="2.8" />
      <ellipse cx="95" cy="95" rx="4.5" ry="2.8" />
    </g>
  )
  switch (mood) {
    case 'thinking':
      return (
        <g>
          <circle cx="72" cy="82" r="3.8" fill={INK} />
          <circle cx="90" cy="82" r="3.8" fill={INK} />
          <path d="M73 98 L86 96" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </g>
      )
    case 'wink':
      return (
        <g>
          <circle cx="70" cy="85" r="3.8" fill={INK} />
          <path d="M85 86 Q90 80 95 86" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M71 96 Q80 104 89 96" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
          {cheeks}
        </g>
      )
    case 'oops':
      return (
        <g>
          <circle cx="70" cy="84" r="4.5" fill="none" stroke={INK} strokeWidth="2.8" />
          <circle cx="90" cy="84" r="4.5" fill="none" stroke={INK} strokeWidth="2.8" />
          <ellipse cx="80" cy="99" rx="3.5" ry="4.5" fill={INK} />
        </g>
      )
    case 'celebrate':
      return (
        <g>
          <path d="M65 86 Q70 79 75 86" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M85 86 Q90 79 95 86" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M70 94 Q80 108 90 94 Z" fill={INK} />
          {cheeks}
        </g>
      )
    default:
      return (
        <g>
          <circle cx="70" cy="85" r="3.8" fill={INK} />
          <circle cx="90" cy="85" r="3.8" fill={INK} />
          <path d="M71 96 Q80 104 89 96" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
          {cheeks}
        </g>
      )
  }
}
