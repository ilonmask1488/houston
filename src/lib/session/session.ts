/*
  Ежедневный «Сеанс связи» (ТЗ §8). Блоки по времени — из planSession (30 мин: разминка 3,
  повторение 7, Эфир 6, Позывной 8, ротация 6). Блоки режутся на сегменты не длиннее ~3 минут
  одного формата и чередуются. Говорение есть каждый день; слабый трек получает ротацию.
*/
import { chunkById, content, itemsByModule, phraseById, textById } from '../../content'
import type { Module, TrackId } from '../../content/types'
import { currentModule, doneSet, type Progress } from '../course/progress'
import { db } from '../db/db'
import type { CardRow, SessionBlock, SessionRow, SessionSegment } from '../db/types'
import type { IntakeRecord } from '../intake/store'
import { rng, shuffle } from '../intake/plan'
import { localDate } from '../progress/streak'
import { STEP_SECONDS, stepsSeconds, type Step } from '../run/steps'
import { planSession } from './plan'

export const MAX_SEGMENT_SECONDS = 180

export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Разрезать шаги на куски не длиннее 3 минут. */
export function chunkSteps(steps: Step[], maxSeconds = MAX_SEGMENT_SECONDS): Step[][] {
  const out: Step[][] = []
  let cur: Step[] = []
  let t = 0
  for (const s of steps) {
    const d = STEP_SECONDS[s.kind]
    if (cur.length && t + d > maxSeconds) {
      out.push(cur)
      cur = []
      t = 0
    }
    cur.push(s)
    t += d
  }
  if (cur.length) out.push(cur)
  return out
}

/** Взять шаги, пока хватает бюджета секунд. */
function take(steps: Step[], seconds: number): Step[] {
  const out: Step[] = []
  let t = 0
  for (const s of steps) {
    if (out.length && t + STEP_SECONDS[s.kind] > seconds) break
    out.push(s)
    t += STEP_SECONDS[s.kind]
  }
  return out
}

/** Сначала несделанное, потом сделанное (закрепление) — всё перемешано детерминированно. */
function freshFirst<T extends { id: string }>(items: T[], done: Set<string>, seed: number): T[] {
  const r = rng(seed)
  return [...shuffle(items.filter((x) => !done.has(x.id)), r), ...shuffle(items.filter((x) => done.has(x.id)), r)]
}

export type AirInput = { module: Module; done: Set<string>; started: boolean; speed: number; seed: number }

/** Шаги Эфира для модуля: сегмент «на слух» и сегмент «диктант и лестница» (или отрывки, акценты). */
export function airSteps(a: AirInput, seconds: number): { label: string; steps: Step[] }[] {
  const intro: Step[] = a.started ? [] : [{ kind: 'intro', module: a.module.id }]
  const items = itemsByModule.get(a.module.id)
  if (a.module.id === 'air-long') {
    const ps = freshFirst(items?.passages ?? [], a.done, a.seed)
    const n = Math.max(1, Math.floor(seconds / STEP_SECONDS.passage))
    return [{ label: 'long', steps: [...intro, ...ps.slice(0, n).map((p): Step => ({ kind: 'passage', passage: p.id }))] }]
  }
  if (a.module.id === 'air-accents') {
    const ps = freshFirst(items?.phrases ?? [], a.done, a.seed)
    return [{ label: 'accents', steps: take([...intro, ...ps.map((p): Step => ({ kind: 'accents', phrase: p.id }))], seconds) }]
  }
  if (a.module.id === 'air-fast') {
    const pool = shuffle(
      content.phrases.filter((p) => p.module !== 'air-accents'),
      rng(a.seed),
    )
    const fresh = [...pool.filter((p) => !a.done.has(p.id)), ...pool.filter((p) => a.done.has(p.id))]
    const listen = fresh.slice(0, 6).map((p): Step => ({ kind: 'listen', phrase: p.id, speed: 1.25 }))
    const dict = fresh.slice(6, 8).map((p): Step => ({ kind: 'dictation', phrase: p.id, speed: 1.25 }))
    return [
      { label: 'listen', steps: [...intro, ...listen] },
      { label: 'dictation', steps: dict },
    ]
  }
  const ps = freshFirst(items?.phrases ?? [], a.done, a.seed)
  const half = seconds / 2
  const listen = take([...intro, ...ps.map((p): Step => ({ kind: 'listen', phrase: p.id, speed: a.speed }))], half)
  const used = new Set(listen.flatMap((s) => (s.kind === 'listen' ? [s.phrase] : [])))
  const rest = ps.filter((p) => !used.has(p.id))
  const pool = rest.length >= 3 ? rest : ps
  const second: Step[] = [
    { kind: 'dictation', phrase: pool[0]!.id, speed: a.speed },
    { kind: 'ladder', phrase: pool[1 % pool.length]!.id },
    { kind: 'dictation', phrase: pool[2 % pool.length]!.id, speed: a.speed },
  ]
  return [
    { label: 'listen', steps: listen },
    { label: 'dictation', steps: take(second, half) },
  ]
}

export type CallInput = {
  module: Module
  done: Set<string>
  seed: number
  quickGame: boolean
  /** твои ответы «Моего рассказа», готовые к тренировке */
  stories?: { id: string; trained: number }[]
}

/** Шаги Позывного: новые чанки, перевод на лету, быстрый ответ (или игра «Быстрый ответ»). */
export function callSteps(c: CallInput, seconds: number): { label: string; steps?: Step[]; game?: 'quick' }[] {
  const parts = callParts(c, seconds)
  // «Мой рассказ» (ТЗ §8): свой ответ вслух — по опорным словам, пока тренировок мало, потом без подсказок.
  if (c.stories?.length) {
    const st = c.stories[c.seed % c.stories.length]!
    parts.push({ label: 'story', steps: [{ kind: st.trained < 2 ? 'storyKeys' : 'storyCold', story: st.id }] })
  }
  return parts
}

function callParts(c: CallInput, seconds: number): { label: string; steps?: Step[]; game?: 'quick' }[] {
  const items = itemsByModule.get(c.module.id)
  const out: { label: string; steps?: Step[]; game?: 'quick' }[] = []
  const chunks = (items?.chunks ?? []).filter((x) => !c.done.has(x.id))
  let left = seconds
  if (chunks.length) {
    const s = take(chunks.slice(0, 5).map((x): Step => ({ kind: 'chunk', chunk: x.id })), Math.min(left, MAX_SEGMENT_SECONDS))
    out.push({ label: 'chunks', steps: s })
    left -= stepsSeconds(s)
  }
  const tr = freshFirst(items?.translate ?? [], c.done, c.seed)
  if (tr.length && left > 60) {
    const s = take(tr.map((x): Step => ({ kind: 'translate', item: x.id })), Math.min(left - 60, MAX_SEGMENT_SECONDS))
    out.push({ label: 'translate', steps: s })
    left -= stepsSeconds(s)
  }
  // Говорение с таймером — каждый день.
  if (c.quickGame) out.push({ label: 'quickGame', game: 'quick' })
  else {
    const qs = freshFirst(items?.questions ?? [], c.done, c.seed + 1)
    const pool = qs.length ? qs : shuffle(content.questions, rng(c.seed))
    out.push({ label: 'quick', steps: take(pool.map((x): Step => ({ kind: 'quick', question: x.id })), Math.max(left, STEP_SECONDS.quick)) })
  }
  return out
}

export type DocInput = { module: Module; done: Set<string>; started: boolean; seed: number; /** конкретный текст (из библиотеки) */ text?: string }

/**
  Техдок (ТЗ §6.3): один текст — прочитать с таймером, найти ответы на время, краткое содержание абзаца,
  разбор сложного предложения, пересказ абзаца вслух. Засчитывается модулю после пересказа.
*/
export function docSteps(d: DocInput, seconds: number): Step[] {
  const texts = freshFirst(itemsByModule.get(d.module.id)?.texts ?? [], d.done, d.seed)
  const t = d.text ? textById.get(d.text) : texts[0]
  if (!t) return []
  const r = rng(d.seed + 7)
  const p = Math.floor(r() * t.paragraphs.length)
  const q = (p + 1) % t.paragraphs.length
  const speed = d.module.id === 'doc-speed'
  const steps: Step[] = [
    ...(d.started ? [] : [{ kind: 'intro', module: d.module.id } as Step]),
    { kind: 'docRead', text: t.id },
    ...t.find.slice(0, 2).map((_, i): Step => ({ kind: 'docFind', text: t.id, i, ...(speed ? { seconds: 25 } : {}) })),
    { kind: 'docSummary', text: t.id, p },
    { kind: 'docParse', text: t.id },
    { kind: 'docRetell', text: t.id, p: q },
  ]
  // Не влезает в бюджет — выкидываем разбор и второй поиск, но пересказ оставляем всегда: это и есть «сделано».
  if (stepsSeconds(steps) > seconds + 60) return steps.filter((s) => s.kind !== 'docParse' && !(s.kind === 'docFind' && s.i > 0))
  return steps
}

export type PlanInput = {
  minutes: number
  date: string
  due: CardRow[]
  progress: Progress
  intake?: Pick<IntakeRecord, 'tracks' | 'result'>
  /** скорость, на которой сейчас ловишь фразы (0.75 или 1) */
  speed: number
  stories?: { id: string; trained: number }[]
}

function seg(id: string, block: SessionBlock, label: string, x: Partial<SessionSegment>): SessionSegment {
  const minutes = x.steps ? Math.max(1, Math.round(stepsSeconds(x.steps) / 60)) : 3
  return { id, block, kind: x.game ? 'game' : 'steps', label, minutes, status: 'pending', ...x }
}

/** План на день: сегменты в порядке прохождения. */
export function planSegments(input: PlanInput): SessionSegment[] {
  const { date, progress, intake } = input
  const min = Object.fromEntries(planSession(input.minutes).map((b) => [b.id, b.minutes])) as Record<SessionBlock, number>
  const seed = hash(date)

  const warmup = [seg('warmup', 'warmup', 'static', { kind: 'game', game: 'static', minutes: min.warmup })]

  const perChunk = Math.floor(MAX_SEGMENT_SECONDS / STEP_SECONDS.card)
  const cardCount = Math.min(input.due.length, Math.round((min.review * 60) / STEP_SECONDS.card))
  const review: SessionSegment[] = []
  const due = input.due.slice(0, cardCount)
  for (let i = 0; i < due.length; i += perChunk)
    review.push(seg(`review-${review.length + 1}`, 'review', 'cards', { steps: due.slice(i, i + perChunk).map((c): Step => ({ kind: 'card', card: c.id })) }))

  const airMod = currentModule('air', progress, intake)
  const air: SessionSegment[] = airMod
    ? airSteps(
        { module: airMod, done: doneSet(progress, airMod.id), started: progress.has(airMod.id), speed: input.speed, seed },
        min.air * 60,
      )
        .filter((x) => x.steps.length)
        .map((x, i) => seg(`air-${i + 1}`, 'air', x.label, { steps: x.steps, track: 'air', module: airMod.id }))
    : []

  const callMod = currentModule('call', progress, intake)
  const call: SessionSegment[] = callMod
    ? callSteps({ module: callMod, done: doneSet(progress, callMod.id), seed, quickGame: seed % 3 === 0, stories: input.stories }, min.call * 60).map((x, i) =>
        seg(`call-${i + 1}`, 'call', x.label, x.game ? { kind: 'game', game: x.game, minutes: 3, track: 'call', module: callMod.id } : { steps: x.steps, track: 'call', module: callMod.id }),
      )
    : []

  const rotation = rotationSegments(input, min.rotation * 60, seed, airMod, callMod)

  // Чередование: разминка, повторение, Эфир, Позывной, повторение, Эфир, Позывной, ротация…
  const queues = [review, air, call, rotation]
  const out: SessionSegment[] = [...warmup]
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) out.push(q.shift()!)
  return out
}

export const ROTATION_TRACKS: TrackId[] = ['doc', 'mail', 'clean']

/**
  Какой трек ротации сегодня. Треки без контента не участвуют. Слабый трек (по вводному тесту)
  стоит в цикле дважды: из четырёх дней два — ему.
*/
export function rotationTrack(seed: number, available: TrackId[], scores?: Partial<Record<TrackId, number>>): TrackId | undefined {
  if (!available.length) return undefined
  const cycle = [...available]
  if (scores && available.length > 1) {
    const weak = [...available].sort((a, b) => (scores[a] ?? 50) - (scores[b] ?? 50))[0]!
    cycle.push(weak)
  }
  return cycle[seed % cycle.length]
}

/**
  Ротация (ТЗ §8): по дням Техдок / Телеграмма / Чистый сигнал, больше внимания слабому треку.
  Если у этих треков нет контента — слабый из Эфира и Позывного: длинный отрывок или акценты / подстановка.
*/
function rotationSegments(input: PlanInput, seconds: number, seed: number, airMod?: Module, callMod?: Module): SessionSegment[] {
  const mods = new Map(ROTATION_TRACKS.map((t) => [t, currentModule(t, input.progress, input.intake)] as const))
  const track = rotationTrack(
    Math.floor(Date.parse(`${input.date}T12:00:00Z`) / 86_400_000),
    ROTATION_TRACKS.filter((t) => mods.get(t)),
    input.intake?.tracks,
  )
  const mod = track && mods.get(track)
  if (track === 'doc' && mod) {
    const steps = docSteps({ module: mod, done: doneSet(input.progress, mod.id), started: input.progress.has(mod.id), seed }, seconds)
    if (steps.length) return chunkSteps(steps).map((st, i) => seg(`rotation-${i + 1}`, 'rotation', i === 0 ? 'read' : 'readTasks', { steps: st, track: 'doc', module: mod.id }))
  }
  return legacyRotation(input, seconds, seed, airMod, callMod)
}

function legacyRotation(input: PlanInput, seconds: number, seed: number, airMod?: Module, callMod?: Module): SessionSegment[] {
  const scores = input.intake?.tracks
  const weakAir = !scores || scores.air <= scores.call
  const alt = seed % 2 === 0 ? weakAir : !weakAir
  if (alt) {
    const other = airMod?.id === 'air-long' ? 'air-accents' : 'air-long'
    const items = itemsByModule.get(other)
    const done = doneSet(input.progress, other)
    const steps: Step[] =
      other === 'air-long'
        ? freshFirst(items?.passages ?? [], done, seed).slice(0, 1).map((p): Step => ({ kind: 'passage', passage: p.id }))
        : take(freshFirst(items?.phrases ?? [], done, seed).map((p): Step => ({ kind: 'accents', phrase: p.id })), Math.min(seconds, MAX_SEGMENT_SECONDS))
    return steps.length ? chunkSteps(steps).map((st, i) => seg(`rotation-${i + 1}`, 'rotation', other === 'air-long' ? 'long' : 'accents', { steps: st, track: 'air', module: other })) : []
  }
  const mod = callMod ?? undefined
  const subs = content.substitution.filter((x) => x.module === mod?.id)
  const pool = subs.length ? subs : content.substitution
  const r = rng(seed)
  const steps = take(
    shuffle(pool, r).flatMap((x) => x.swaps.map((_, k): Step => ({ kind: 'substitute', item: x.id, swap: k }))),
    Math.min(seconds, MAX_SEGMENT_SECONDS),
  )
  return steps.length ? [seg('rotation-1', 'rotation', 'substitute', { steps, track: 'call', module: pool[0]?.module })] : []
}

/* ——— Сеанс в базе ——— */

/** Скорость упражнений Эфира по последним ответам: понимаешь на 1.0 хотя бы в 70% — работаем на 1.0. */
export async function currentSpeed(intake?: IntakeRecord): Promise<number> {
  const recent = (await db.answers.where('at').above(Date.now() - 14 * 86_400_000).toArray()).filter((a) => a.kind === 'listen' && a.source !== 'intake')
  const at1 = recent.filter((a) => (a.speed ?? 1) >= 1)
  if (at1.length >= 6) return at1.filter((a) => a.correct).length / at1.length >= 0.7 ? 1 : 0.75
  return (intake?.result.listening.comfort ?? 0.75) >= 1 ? 1 : 0.75
}

/**
  Обновить план в течение дня: блоки, где ещё ничего не сделано и не пропущено вручную,
  берутся из свежего плана (например, после изменения длительности или прохождения модуля).
*/
export function refreshSegments(old: SessionSegment[], fresh: SessionSegment[]): SessionSegment[] {
  const touched = new Set(old.filter((s) => s.status === 'done' || (s.status === 'skipped' && !s.auto) || (s.pos ?? 0) > 0).map((s) => s.block))
  const keep = old.filter((s) => touched.has(s.block))
  const add = fresh.filter((s) => !touched.has(s.block))
  const done = keep.filter((s) => s.status !== 'pending')
  const pending = [...keep.filter((s) => s.status === 'pending'), ...add]
  const order = new Map(fresh.map((s, i) => [s.id, i]))
  pending.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
  return [...done, ...pending]
}

export async function saveSession(row: SessionRow): Promise<void> {
  await db.sessions.put(row)
}

export async function todaySession(): Promise<SessionRow | undefined> {
  return db.sessions.get(localDate())
}

export async function updateSegment(id: string, patch: Partial<SessionSegment>, stats?: { seconds: number; signal: number; correct: number; total: number; spokenMs: number }): Promise<SessionRow | undefined> {
  const date = localDate()
  let out: SessionRow | undefined
  await db.transaction('rw', db.sessions, async () => {
    const row = await db.sessions.get(date)
    if (!row) return
    row.segments = row.segments.map((s) => (s.id === id ? { ...s, ...patch } : s))
    if (stats) {
      row.seconds += Math.round(stats.seconds)
      row.signal += stats.signal
      row.correct += stats.correct
      row.total += stats.total
      row.spokenMs += stats.spokenMs
    }
    if (!row.finishedAt && row.segments.every((s) => s.status !== 'pending')) row.finishedAt = Date.now()
    await db.sessions.put(row)
    out = row
  })
  return out
}

export async function skipBlock(block: SessionBlock): Promise<void> {
  const row = await todaySession()
  if (!row) return
  for (const s of row.segments) if (s.block === block && s.status === 'pending') await updateSegment(s.id, { status: 'skipped', auto: false })
}

/** Для подписей: какой трек у блока. */
export const BLOCK_TRACK: Partial<Record<SessionBlock, TrackId>> = { air: 'air', call: 'call' }
/** Есть ли у фразы или чанка всё нужное (для отбраковки битых ссылок в старом плане). */
export function stepAlive(s: Step): boolean {
  switch (s.kind) {
    case 'listen':
    case 'dictation':
    case 'ladder':
    case 'accents':
      return phraseById.has(s.phrase)
    case 'chunk':
      return chunkById.has(s.chunk)
    case 'docRead':
    case 'docParse':
      return textById.has(s.text)
    case 'docFind':
      return !!textById.get(s.text)?.find[s.i]
    case 'docSummary':
    case 'docRetell':
      return !!textById.get(s.text)?.paragraphs[s.p]
    default:
      return true
  }
}
