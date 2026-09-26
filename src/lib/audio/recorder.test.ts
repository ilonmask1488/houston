import { afterEach, describe, expect, it, vi } from 'vitest'
import { pickMime, recordingSupported } from './recorder'

afterEach(() => vi.unstubAllGlobals())

describe('запись голоса', () => {
  it('без MediaRecorder функция скрыта, а не ломается', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(recordingSupported()).toBe(false)
    expect(pickMime()).toBeUndefined()
  })

  it('формат: mp4, если есть (Safari), иначе webm/opus (Chrome)', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: (m: string) => m === 'audio/webm;codecs=opus' || m === 'audio/mp4' })
    expect(pickMime()).toBe('audio/mp4')
    vi.stubGlobal('MediaRecorder', { isTypeSupported: (m: string) => m === 'audio/webm;codecs=opus' })
    expect(pickMime()).toBe('audio/webm;codecs=opus')
  })
})
