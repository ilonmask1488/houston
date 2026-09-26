/*
  Сборка промптов для чата с Claude из шаблонов (src/i18n/claude-prompts.ts) и копирование в буфер.
*/
import { chunkById } from '../../content'
import { CLAUDE_PROMPTS } from '../../i18n/claude-prompts'
import type { InterviewItem } from '../db/types'

/** Подставить {ключи}; незаполненные подстановки заменяются на «—». */
export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '—')
}

export function editStoryPrompt(p: { question: string; answer: string; level?: string; star: boolean }): string {
  return fill(CLAUDE_PROMPTS.editStory, {
    question: p.question,
    answer: p.answer.trim() || '(ответ ещё не написан — помоги составить его по вопросу, задав мне 3–4 уточняющих вопроса)',
    level: p.level ?? 'B1',
    star: p.star ? ', соблюдение схемы STAR (ситуация, задача, действия, результат)' : '',
  })
}

export function interviewPrompt(p: { items: InterviewItem[]; level?: string }): string {
  const transcript = p.items
    .map((it, i) => `${i + 1}. Вопрос: ${it.q}\n   Мой ответ: ${it.transcript.trim() || (it.recorded ? '(ответ записан, но распознавание недоступно)' : '(ответ вслух без записи)')}`)
    .join('\n')
  const lat = p.items.filter((i) => i.latencyMs !== undefined).map((i) => i.latencyMs!)
  const pauses = p.items.reduce((s, i) => s + (i.longPauses ?? 0), 0)
  return fill(CLAUDE_PROMPTS.analyzeInterview, {
    transcript,
    level: p.level ?? 'B1',
    latency: lat.length ? `${(lat.reduce((s, x) => s + x, 0) / lat.length / 1000).toFixed(1)} с` : 'не измерено',
    pauses: String(pauses),
  })
}

export function practicePrompt(p: { situation: string; role: string; level?: string; weak: string[]; chunks: string[] }): string {
  return fill(CLAUDE_PROMPTS.practice, {
    situation: p.situation,
    role: p.role,
    level: p.level ?? 'B1',
    weak: p.weak.length ? p.weak.join(', ') : 'быстрая речь на слух и говорение без пауз',
    chunks: p.chunks.map((id) => chunkById.get(id)?.en).filter(Boolean).join('; ') || 'пока нет',
  })
}

export function explainPrompt(paragraph: string): string {
  return fill(CLAUDE_PROMPTS.explainParagraph, { paragraph })
}

export function askWordPrompt(word: string, sentence: string): string {
  return fill(CLAUDE_PROMPTS.askWord, { word, sentence })
}

export function letterPrompt(p: { situation: string; register: string; letter: string }): string {
  return fill(CLAUDE_PROMPTS.checkLetter, p)
}

/** Скопировать в буфер: Clipboard API, иначе — через выделение текста. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.append(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
