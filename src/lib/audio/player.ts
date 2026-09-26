/*
  Единый плеер: одновременно звучит только один звук.
  - Один HTMLAudioElement на всё приложение: разблокированный на первом касании (iOS),
    он потом играет и программно — например, повтор образца после паузы.
  - preservesPitch: при замедлении высота (то есть тон!) не меняется.
  - Предзагрузка — fetch в кэш service worker'а, чтобы следующий звук играл без задержки
    и был доступен офлайн.
  - Состояние пишется в data-audio на <html> — по нему e2e проверяет, что звук реально пошёл.
*/
import { ru } from '../../i18n/ru'

/** 0,1 с тишины (WAV, 8 кГц, 8 бит) — для разблокировки звука на iOS. */
function silenceUrl(): string {
  const n = 800
  const buf = new ArrayBuffer(44 + n)
  const v = new DataView(buf)
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 36 + n, true)
  str(8, 'WAVEfmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // моно
  v.setUint32(24, 8000, true)
  v.setUint32(28, 8000, true)
  v.setUint16(32, 1, true)
  v.setUint16(34, 8, true)
  str(36, 'data')
  v.setUint32(40, n, true)
  new Uint8Array(buf, 44).fill(128)
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}

export class AudioError extends Error {}

type Listener = (message: string) => void

class Player {
  private el: HTMLAudioElement | null = null
  private current: { resolve: () => void } | null = null
  private preloaded = new Set<string>()
  private errorListeners = new Set<Listener>()
  unlocked = false

  private element(): HTMLAudioElement {
    if (!this.el) {
      this.el = new Audio()
      this.el.preload = 'auto'
      ;(this.el as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true
    }
    return this.el
  }

  /** Вызывается на первом касании: iOS разрешает звук только из обработчика жеста. */
  unlock(): void {
    if (this.unlocked) return
    this.unlocked = true
    const el = this.element()
    el.src = silenceUrl()
    el.play().catch(() => {
      this.unlocked = false
    })
  }

  stop(): void {
    const el = this.el
    if (el && !el.paused) el.pause()
    this.current?.resolve()
    this.current = null
  }

  /**
    Играет файл; промис завершается, когда звук доиграл или был прерван следующим.
    maxMs — страховка: если браузер так и не пришлёт ended (бывает на телефоне под нагрузкой), считаем звук законченным.
  */
  play(url: string, rate = 1, maxMs = 30_000): Promise<void> {
    this.stop()
    const el = this.element()
    setState('loading')
    return new Promise<void>((resolve, reject) => {
      let guard: ReturnType<typeof setTimeout> | undefined
      const done = () => {
        cleanup()
        resolve()
      }
      const onEnded = () => {
        setState('ended')
        done()
      }
      const onError = () => {
        cleanup()
        const err = new AudioError(describeMediaError(el.error))
        setState('error')
        this.emitError(err.message)
        reject(err)
      }
      const cleanup = () => {
        clearTimeout(guard)
        el.removeEventListener('ended', onEnded)
        el.removeEventListener('error', onError)
        if (this.current?.resolve === done) this.current = null
      }
      this.current = { resolve: done }
      el.addEventListener('ended', onEnded)
      el.addEventListener('error', onError)
      guard = setTimeout(onEnded, maxMs)
      // Загрузка нового файла сбрасывает скорость к defaultPlaybackRate — ставим обе.
      el.defaultPlaybackRate = rate
      el.src = url
      el.playbackRate = rate
      el.play().then(
        () => setState('playing'),
        (e: unknown) => {
          cleanup()
          const name = e instanceof DOMException ? e.name : ''
          if (name === 'AbortError') return resolve() // прервали следующим звуком
          const msg = name === 'NotAllowedError' ? ru.audio.notAllowed : describeMediaError(el.error)
          setState('error')
          this.emitError(msg)
          reject(new AudioError(msg))
        },
      )
    })
  }

  /** Скачать заранее (в кэш service worker'а и браузера). */
  preload(urls: string[]): void {
    for (const url of urls) {
      if (this.preloaded.has(url)) continue
      this.preloaded.add(url)
      fetch(url).catch(() => this.preloaded.delete(url))
    }
  }

  onError(l: Listener): () => void {
    this.errorListeners.add(l)
    return () => this.errorListeners.delete(l)
  }

  emitError(message: string): void {
    this.errorListeners.forEach((l) => l(message))
  }
}

function describeMediaError(err: MediaError | null): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return ru.audio.offline
  if (err?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) return ru.audio.unsupported
  return ru.audio.generic
}

function setState(s: 'loading' | 'playing' | 'ended' | 'error'): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.audio = s
}

export const player = new Player()

/** Разблокировать звук на первом касании где угодно. */
export function installAudioUnlock(): void {
  const handler = () => {
    player.unlock()
    window.removeEventListener('pointerdown', handler, true)
    window.removeEventListener('keydown', handler, true)
  }
  window.addEventListener('pointerdown', handler, true)
  window.addEventListener('keydown', handler, true)
}
