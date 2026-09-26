import { describe, expect, it } from 'vitest'
import { editStoryPrompt, fill, interviewPrompt, practicePrompt } from './prompt'

describe('промпты для Claude', () => {
  it('подстановки: известные заполняются, неизвестные — прочерк', () => {
    expect(fill('A {x} B {y}', { x: '1' })).toBe('A 1 B —')
  })

  it('редактирование ответа: вопрос, ответ, уровень и STAR', () => {
    const p = editStoryPrompt({ question: 'Tell me about a difficult problem you solved.', answer: 'In our project…', level: 'B1', star: true })
    expect(p).toContain('Tell me about a difficult problem you solved.')
    expect(p).toContain('In our project…')
    expect(p).toContain('B1')
    expect(p).toContain('STAR')
    expect(p).not.toMatch(/\{\w+\}/)
  })

  it('пустой ответ — просьба помочь составить', () => {
    expect(editStoryPrompt({ question: 'Q', answer: '  ', star: false })).toContain('ответ ещё не написан')
  })

  it('разбор собеседования: транскрипт, время начала, паузы', () => {
    const p = interviewPrompt({
      items: [
        { q: 'Tell me about yourself.', qid: 'about', transcript: 'I am a student', latencyMs: 2000, longPauses: 1, recorded: true },
        { q: 'Why us?', qid: 'why', transcript: '', latencyMs: 4000, recorded: true },
        { q: 'Weakness?', qid: 'weakness', transcript: '', recorded: false },
      ],
    })
    expect(p).toContain('1. Вопрос: Tell me about yourself.')
    expect(p).toContain('распознавание недоступно')
    expect(p).toContain('без записи')
    expect(p).toContain('3.0 с')
    expect(p).toContain('Долгих пауз (больше 2 секунд): 1')
  })

  it('практика разговора: ситуация, роль, чанки по id', () => {
    const p = practicePrompt({ situation: 'Первый день', role: 'Priya', weak: [], chunks: ['c-clarify-05'] })
    expect(p).toContain('Just to make sure I understand')
    expect(p).toContain('Priya')
  })
})
