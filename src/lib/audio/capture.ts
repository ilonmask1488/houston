/*
  Захват ответа голосом: запись (MediaRecorder) + уровень громкости (детектор речи) + распознавание.
  Что есть в браузере, то и работает: нет записи — только распознавание, нет распознавания — только запись,
  нет ничего — упражнение идёт на самооценке.

  Некоторые телефоны не дают микрофон записи и распознаванию одновременно. Тогда распознавание
  падает с 'audio-capture' — запоминаем это (meta captureMode = 'asr-only') и дальше на этом устройстве
  слушаем только распознаванием: оно в этом приложении главное средство обратной связи (ТЗ §9.4).
*/
import { db } from '../db/db'
import { listen, recognitionSupported, type Listening } from '../speech/recognize'
import { pickMime, recordingSupported, RecorderError } from './recorder'
import { analyzeFrames, statsFromText, type Frame, type SpeechStats } from './vad'

export type CaptureResult = SpeechStats & {
  /** запись для «послушать себя»; нет — записи не было */
  url?: string
  ms: number
  transcript: string
  alts: string[]
  asrError?: string
  /** что реально работало */
  recorded: boolean
  recognized: boolean
}

export type Capture = {
  stop: () => Promise<CaptureResult>
  cancel: () => void
}

export type CaptureOptions = {
  asr: boolean
  lang?: string
  /** уровень 0..1 примерно 20 раз в секунду — для индикатора */
  onLevel?: (level: number) => void
  /** голос появился (мс от начала) */
  onSpeechStart?: (ms: number) => void
}

export function captureSupported(): { record: boolean; asr: boolean } {
  return { record: recordingSupported(), asr: recognitionSupported() }
}

export async function startCapture(opts: CaptureOptions): Promise<Capture> {
  const mode = (await db.getMeta<string>('captureMode').catch(() => undefined)) ?? 'both'
  const can = captureSupported()
  const useAsr = opts.asr && can.asr
  const useRecord = can.record && !(useAsr && mode === 'asr-only')
  const started = Date.now()
  let speechStarted = false
  const speechStart = (ms: number) => {
    if (speechStarted) return
    speechStarted = true
    opts.onSpeechStart?.(ms)
  }

  // ——— Запись + уровень ———
  let stream: MediaStream | null = null
  let rec: MediaRecorder | null = null
  let ctx: AudioContext | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  const frames: Frame[] = []
  const chunks: Blob[] = []
  if (useRecord) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      if (!useAsr) {
        if (name === 'NotAllowedError' || name === 'SecurityError') throw new RecorderError('denied', 'denied')
        if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new RecorderError('no-device', 'no-device')
        throw new RecorderError(String(e), 'failed')
      }
    }
  }
  if (stream) {
    const mime = pickMime()
    rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
    rec.ondataavailable = (ev) => {
      if (ev.data.size) chunks.push(ev.data)
    }
    rec.start()
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
      if (ctx.state === 'suspended') void ctx.resume()
      const src = ctx.createMediaStreamSource(stream)
      const an = ctx.createAnalyser()
      an.fftSize = 1024
      src.connect(an)
      const buf = new Float32Array(an.fftSize)
      let loudFor = 0
      timer = setInterval(() => {
        an.getFloatTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!
        const rms = Math.sqrt(sum / buf.length)
        const dbv = 20 * Math.log10(Math.max(rms, 1e-6))
        const t = Date.now() - started
        frames.push({ t, db: dbv })
        opts.onLevel?.(Math.max(0, Math.min(1, (dbv + 60) / 45)))
        // Живое «начал говорить»: 150 мс подряд заметно громче фона.
        const floor = frames.length > 6 ? frames.slice(0, 6).reduce((s, f) => s + f.db, 0) / 6 : -60
        loudFor = dbv > Math.max(-50, floor + 12) && t > 300 ? loudFor + 50 : 0
        if (loudFor >= 150) speechStart(t - loudFor)
      }, 50)
    } catch (e) {
      console.error('analyser', e)
    }
  }

  // ——— Распознавание ———
  let session: Listening | null = null
  let asrError: string | undefined
  if (useAsr) {
    try {
      session = listen(opts.lang ?? 'en-US', { onSpeechStart: (ms) => speechStart(ms) })
      session.result.catch((e: Error) => {
        asrError = e.message
        if (e.message === 'audio-capture' && stream) void db.setMeta('captureMode', 'asr-only')
      })
    } catch (e) {
      asrError = String(e)
    }
  }
  if (!stream && !session) throw new RecorderError('no-capture', 'failed')

  const release = () => {
    clearInterval(timer)
    stream?.getTracks().forEach((t) => t.stop())
    void ctx?.close().catch(() => {})
  }

  return {
    stop: async () => {
      const ms = Date.now() - started
      const recStop = new Promise<string | undefined>((resolve) => {
        if (!rec || rec.state === 'inactive') return resolve(undefined)
        rec.onstop = () => {
          const blob = new Blob(chunks, { type: rec!.mimeType || 'audio/webm' })
          resolve(blob.size ? URL.createObjectURL(blob) : undefined)
        }
        rec.stop()
      })
      session?.stop()
      const [url, asr] = await Promise.all([
        recStop,
        session ? session.result.catch(() => null) : Promise.resolve(null),
      ])
      release()
      const stats = frames.length > 5 ? analyzeFrames(frames) : statsFromText(asr?.speechStartMs, asr?.textTimes ?? [])
      return {
        ...stats,
        url,
        ms,
        transcript: asr?.alts[0] ?? '',
        alts: asr?.alts ?? [],
        asrError,
        recorded: !!url,
        recognized: !!asr && !asrError,
      }
    },
    cancel: () => {
      clearInterval(timer)
      try {
        if (rec && rec.state !== 'inactive') rec.stop()
      } catch {
        /* уже остановлен */
      }
      session?.cancel()
      release()
    },
  }
}
