/* Кнопка «… с Claude»: собирает промпт и копирует его в буфер; если буфер недоступен — показывает текст. */
import { useState } from 'react'
import { ru } from '../i18n/ru'
import { copyText } from '../lib/claude/prompt'
import s from './ClaudeButton.module.css'
import ui from './ui.module.css'

export function ClaudeButton({ label, build }: { label: string; build: () => string | Promise<string> }) {
  const [state, setState] = useState<'idle' | 'copied' | 'shown'>('idle')
  const [text, setText] = useState('')
  const run = async () => {
    const prompt = await build()
    setText(prompt)
    setState((await copyText(prompt)) ? 'copied' : 'shown')
  }
  return (
    <div className={s.wrap}>
      <button type="button" className={`${ui.secondary} ${s.btn}`} onClick={() => void run()}>
        <span className={s.spark} aria-hidden>
          ✳
        </span>
        {label}
      </button>
      {state !== 'idle' && (
        <div className={s.result} role="status">
          <p>{state === 'copied' ? ru.claude.copied : ru.claude.copyFailed}</p>
          {state === 'shown' && <textarea className={s.text} readOnly value={text} rows={8} onFocus={(e) => e.target.select()} />}
        </div>
      )}
    </div>
  )
}
