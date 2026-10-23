import { afterEach, describe, expect, it, vi } from 'vitest'
import { speakEnglish } from './speech'

class FakeUtterance {
  lang = ''
  rate = 1
  voice: unknown = null
  onend: (() => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onboundary: unknown = null
  text: string
  constructor(text: string) {
    this.text = text
  }
}

function stubSynth() {
  const synth = { getVoices: () => [], cancel: vi.fn(), speak: vi.fn() }
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('window', { speechSynthesis: synth })
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  return synth
}

describe('синтез речи', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('не висит вечно, если браузер потерял onend', async () => {
    vi.useFakeTimers()
    stubSynth()
    let done = false
    const p = speakEnglish('Hello there').then(() => (done = true))
    await vi.advanceTimersByTimeAsync(2000)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(10_000)
    await p
    expect(done).toBe(true)
  })

  it('обычный конец — сразу', async () => {
    const synth = stubSynth()
    const p = speakEnglish('Hi')
    const u = synth.speak.mock.calls[0]![0] as FakeUtterance
    u.onend?.()
    await expect(p).resolves.toBeUndefined()
  })
})
