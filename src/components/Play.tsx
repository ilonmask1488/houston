import { useEffect, useState, type ReactNode } from 'react'
import type { VoiceId } from '../content/types'
import { playText, stopAudio } from '../lib/audio/audio'
import { IconSpeaker } from './Icons'
import s from './Play.module.css'

export { IconSpeaker }

/** Круглая кнопка «послушать». Во время звучания подсвечена. */
export function PlayButton({
  text,
  voice,
  rate,
  label,
  size = 'm',
  onPlayed,
  onStart,
}: {
  text: string
  voice?: VoiceId
  rate?: number
  label: string
  size?: 's' | 'm' | 'l'
  onPlayed?: () => void
  onStart?: () => void
}) {
  const [playing, setPlaying] = useState(false)
  useEffect(() => () => stopAudio(), [])
  return (
    <button
      type="button"
      className={`${s.play} ${s[size]}`}
      data-playing={playing || undefined}
      aria-label={label}
      onClick={() => {
        setPlaying(true)
        onStart?.()
        playText(text, { voice, rate })
          .catch(() => {})
          .finally(() => {
            setPlaying(false)
            onPlayed?.()
          })
      }}
    >
      <IconSpeaker size={size === 'l' ? 30 : size === 's' ? 18 : 22} />
    </button>
  )
}

/** Кнопка-«чип», которая играет звук: слово, фраза, подпись. */
export function PlayChip({ text, voice, children, active, label }: { text: string; voice?: VoiceId; children: ReactNode; active?: boolean; label?: string }) {
  const [playing, setPlaying] = useState(false)
  return (
    <button
      type="button"
      className={s.chip}
      data-playing={playing || active || undefined}
      aria-label={label}
      onClick={() => {
        setPlaying(true)
        playText(text, { voice })
          .catch(() => {})
          .finally(() => setPlaying(false))
      }}
    >
      {children}
    </button>
  )
}
