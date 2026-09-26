/*
  Запись своего голоса (MediaRecorder) для сравнения с образцом.
  Запись живёт только в памяти, пока открыт экран, — никуда не сохраняется и не отправляется.
  Нет MediaRecorder / микрофона / https — функция скрывается, а не ломается.
*/

export type RecordingResult = { url: string; ms: number }
export type Recording = { stop: () => Promise<RecordingResult>; cancel: () => void }

export class RecorderError extends Error {
  readonly reason: 'denied' | 'no-device' | 'failed'
  constructor(message: string, reason: 'denied' | 'no-device' | 'failed') {
    super(message)
    this.reason = reason
  }
}

/**
  Форматы по убыванию предпочтения. mp4 (AAC) — первым: это родной формат Safari/iOS, и он надёжно
  раскодируется для графика тона (новый Safari умеет и webm, но разбирает его хуже). Chrome без mp4 — webm/opus.
*/
const MIME_CANDIDATES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/aac']

export function recordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== 'undefined'
  )
}

export function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m))
}

export async function startRecording(): Promise<Recording> {
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  } catch (e) {
    const name = e instanceof DOMException ? e.name : ''
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new RecorderError('denied', 'denied')
    if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new RecorderError('no-device', 'no-device')
    throw new RecorderError(String(e), 'failed')
  }
  const mime = pickMime()
  const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
  const chunks: Blob[] = []
  const started = Date.now()
  rec.ondataavailable = (ev) => {
    if (ev.data.size) chunks.push(ev.data)
  }
  const release = () => stream.getTracks().forEach((t) => t.stop())
  rec.start()
  return {
    stop: () =>
      new Promise<RecordingResult>((resolve, reject) => {
        rec.onstop = () => {
          release()
          const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' })
          if (!blob.size) return reject(new RecorderError('empty', 'failed'))
          resolve({ url: URL.createObjectURL(blob), ms: Date.now() - started })
        }
        rec.onerror = () => {
          release()
          reject(new RecorderError('recorder error', 'failed'))
        }
        if (rec.state !== 'inactive') rec.stop()
      }),
    cancel: () => {
      try {
        if (rec.state !== 'inactive') rec.stop()
      } catch {
        /* уже остановлен */
      }
      release()
    },
  }
}
