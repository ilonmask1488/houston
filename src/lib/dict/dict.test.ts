import { beforeAll, describe, expect, it } from 'vitest'
import { dictById, lemmaCandidates, loadDictionary, lookup, lookupInContext, norm } from './dict'

beforeAll(async () => {
  await loadDictionary()
})

describe('встроенный словарь', () => {
  it('загружен: тысячи общих слов и сотни технических', () => {
    const all = [...dictById.values()]
    expect(all.length).toBeGreaterThan(3500)
    expect(all.filter((w) => w.band === 'tech').length).toBeGreaterThan(300)
    expect(all.every((w) => w.ru.trim().length > 0)).toBe(true)
  })

  it('нормализация и кандидаты леммы', () => {
    expect(norm('“Specimens,')).toBe('specimens')
    expect(norm("engine's")).toBe('engine')
    expect(lemmaCandidates('studies')).toContain('study')
    expect(lemmaCandidates('stopped')).toContain('stop')
    expect(lemmaCandidates('making')).toContain('make')
  })

  it('поиск по формам: tested → test, specimens → specimen, measured → measure', () => {
    expect(lookup('tested')?.text).toBe('test')
    expect(lookup('Specimens.')?.text).toBe('specimen')
    expect(lookup('measured')?.text).toBe('measure')
    expect(lookup('took')?.text).toBe('take')
    expect(lookup('qwertyzz')).toBeUndefined()
  })

  it('у технического термина — МФА и тема', () => {
    const w = lookup('nozzle')!
    expect(w.band).toBe('tech')
    expect(w.ipa).toContain('ˈ')
    expect(w.ru).toContain('сопло')
  })

  it('многословный термин находится по любому своему слову', () => {
    const words = 'We glued a strain gauge to the bracket'.split(' ')
    expect(lookupInContext(words, 3)).toMatchObject({ from: 3, to: 4, entry: { text: 'strain gauge' } })
    expect(lookupInContext(words, 4).entry?.text).toBe('strain gauge')
    const fea = 'using finite element analysis today'.split(' ')
    expect(lookupInContext(fea, 2).entry?.text).toBe('finite element analysis')
    expect(lookupInContext(words, 7).entry?.text).toBe('bracket')
  })
})
