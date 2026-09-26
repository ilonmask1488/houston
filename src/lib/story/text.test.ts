import { describe, expect, it } from 'vitest'
import { hasCyrillic, keyLines, keywords, speakingSeconds, splitSentences, wordCount } from './text'

describe('свой текст', () => {
  it('делит на предложения, не ломаясь на сокращениях', () => {
    expect(splitSentences("I'm a student. I work on composites, e.g. carbon fiber. Why? Because it's fun!")).toEqual([
      "I'm a student.",
      'I work on composites, e.g. carbon fiber.',
      'Why?',
      "Because it's fun!",
    ])
  })

  it('ключевые слова — содержательные, в порядке предложения, числа важны', () => {
    expect(keywords('As a result, the mass dropped by eighteen percent.')).toEqual(['dropped', 'eighteen', 'percent'])
    expect(keywords('The peak temperature dropped by 12 degrees.', 2)).toEqual(['temperature', '12'])
    expect(keywords('It is what it is.')).toEqual([])
  })

  it('опорные строки по предложениям', () => {
    expect(keyLines('I was responsible for the stress analysis. Then I built the model in SolidWorks.')).toEqual([
      ['responsible', 'stress', 'analysis'],
      ['built', 'model', 'SolidWorks'],
    ])
  })

  it('время звучания и слова', () => {
    expect(wordCount("I'm a fourth-year student.")).toBe(4)
    expect(speakingSeconds(Array.from({ length: 130 }, () => 'word').join(' '))).toBe(60)
    expect(hasCyrillic('I work on композиты')).toBe(true)
  })
})
