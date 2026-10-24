import { describe, expect, it } from 'vitest'
import { raw } from './data'
import { forField } from './index'

describe('контент под специальность', () => {
  const data = [
    { id: 'a' },
    { id: 'b', field: 'space' as const },
    { id: 'c', field: 'mech' as const },
    { id: 'd', example: 'satellite', byField: { mech: { example: 'gearbox' } } },
  ]

  it('чужая специальность убирается, своя и общая остаются; byField накладывается', () => {
    expect(forField(data, 'mech')).toEqual([{ id: 'a' }, { id: 'c', field: 'mech' }, { id: 'd', example: 'gearbox' }])
    expect(forField(data, 'space')).toEqual([{ id: 'a' }, { id: 'b', field: 'space' }, { id: 'd', example: 'satellite' }])
  })

  it('во вложенных объектах тоже (боссы, реплики эпизодов)', () => {
    expect(forField({ boss: { list: data } }, 'mech').boss.list.map((x) => x.id)).toEqual(['a', 'c', 'd'])
  })

  it('у механика нет космических текстов и вопросов, у обоих — все модули с содержимым', () => {
    for (const field of ['space', 'mech'] as const) {
      const c = forField(raw, field)
      const other = field === 'space' ? 'mech' : 'space'
      for (const list of [c.texts, c.questions, c.chunks, c.translate, c.substitution, c.passages, c.gameStatic, c.falseFriends, c.grammarGaps])
        expect((list as { field?: string }[]).some((x) => x.field === other)).toBe(false)
    }
  })
})
