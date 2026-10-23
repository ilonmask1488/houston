import { afterEach, describe, expect, it, vi } from 'vitest'
import { listen } from './recognize'

/** Поддельный SpeechRecognition: события вызываем руками. */
class FakeRecognition {
  static made: FakeRecognition[] = []
  lang = ''
  interimResults = false
  maxAlternatives = 1
  continuous = false
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  onspeechstart: (() => void) | null = null
  started = 0
  constructor() {
    FakeRecognition.made.push(this)
  }
  start() {
    this.started++
  }
  stop() {
    this.onend?.()
  }
  abort() {
    this.onend?.()
  }
}

describe('listen', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    FakeRecognition.made = []
  })

  it('после окончательной ошибки не перезапускает распознавание', async () => {
    vi.stubGlobal('window', { SpeechRecognition: FakeRecognition })
    const l = listen()
    const caught = l.result.catch((e: Error) => e.message)
    const r = FakeRecognition.made[0]!
    r.onerror?.({ error: 'not-allowed' })
    r.onend?.()
    expect(await caught).toBe('not-allowed')
    expect(FakeRecognition.made).toHaveLength(1)
  })

  it('обрыв браузером без ошибки — продолжает слушать', () => {
    vi.stubGlobal('window', { SpeechRecognition: FakeRecognition })
    const l = listen()
    FakeRecognition.made[0]!.onend?.()
    expect(FakeRecognition.made).toHaveLength(2)
    l.cancel()
    FakeRecognition.made[1]!.onend?.()
    expect(FakeRecognition.made).toHaveLength(2)
  })
})
