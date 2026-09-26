import { describe, expect, it } from 'vitest'
import { moduleById } from '../../content'
import { currentModule, moduleItems, type Progress } from '../course/progress'
import type { CardRow } from '../db/types'
import { STEP_SECONDS, stepsSeconds } from '../run/steps'
import { newCard } from '../srs/srs'
import { airSteps, callSteps, chunkSteps, docSteps, MAX_SEGMENT_SECONDS, planSegments, refreshSegments, rotationTrack, stepAlive } from './session'

const cards = (n: number): CardRow[] => Array.from({ length: n }, (_, i) => newCard(`c-intro-${String(i + 1).padStart(2, '0')}`, 1, 0))

describe('сеанс связи', () => {
  it('ни один сегмент не длиннее ~3 минут одного формата', () => {
    const segs = planSegments({ minutes: 45, date: '2026-09-27', due: cards(30), progress: new Map(), speed: 1 })
    for (const s of segs) if (s.steps) expect(stepsSeconds(s.steps), s.id).toBeLessThanOrEqual(MAX_SEGMENT_SECONDS + STEP_SECONDS.passage)
  })

  it('есть все блоки: разминка, повторение, Эфир, Позывной, ротация; говорение — всегда', () => {
    for (const date of ['2026-09-27', '2026-09-28', '2026-09-29']) {
      const segs = planSegments({ minutes: 30, date, due: cards(10), progress: new Map(), speed: 1 })
      const blocks = new Set(segs.map((s) => s.block))
      for (const b of ['warmup', 'review', 'air', 'call', 'rotation']) expect(blocks.has(b as never), `${date}: ${b}`).toBe(true)
      expect(segs.some((s) => s.block === 'call' && (s.game === 'quick' || s.steps?.some((x) => x.kind === 'quick')))).toBe(true)
      expect(segs[0]!.game).toBe('static')
    }
  })

  it('соседние сегменты не одного блока (чередование форматов)', () => {
    const segs = planSegments({ minutes: 45, date: '2026-09-27', due: cards(40), progress: new Map(), speed: 1 })
    for (let i = 1; i < segs.length; i++)
      if (segs[i]!.block === segs[i - 1]!.block) expect(segs.slice(i).every((s) => s.block === segs[i]!.block)).toBe(true)
  })

  it('без карточек повторения блока нет, без теста — модули с начала', () => {
    const segs = planSegments({ minutes: 30, date: '2026-09-27', due: [], progress: new Map(), speed: 0.75 })
    expect(segs.some((s) => s.block === 'review')).toBe(false)
    expect(segs.find((s) => s.block === 'air')!.module).toBe('air-weak')
    expect(segs.find((s) => s.block === 'call')!.module).toBe('call-intro')
  })

  it('новый модуль начинается с объяснения; начатый — без него', () => {
    const m = moduleById.get('air-weak')!
    expect(airSteps({ module: m, done: new Set(), started: false, speed: 1, seed: 1 }, 360)[0]!.steps[0]).toEqual({ kind: 'intro', module: 'air-weak' })
    expect(airSteps({ module: m, done: new Set(), started: true, speed: 1, seed: 1 }, 360)[0]!.steps[0]!.kind).toBe('listen')
  })

  it('Позывной: сначала новые чанки, потом перевод и быстрый ответ', () => {
    const m = moduleById.get('call-intro')!
    const parts = callSteps({ module: m, done: new Set(), seed: 1, quickGame: false }, 480)
    expect(parts.map((p) => p.label)).toEqual(['chunks', 'translate', 'quick'])
    const learned = callSteps({ module: m, done: new Set(moduleItems('call-intro')), seed: 1, quickGame: true }, 480)
    expect(learned.map((p) => p.label)).toEqual(['translate', 'quickGame'])
  })

  it('«Мой рассказ»: свой ответ в Позывном — по опорным словам, потом без подсказок', () => {
    const m = moduleById.get('call-intro')!
    const fresh = callSteps({ module: m, done: new Set(), seed: 1, quickGame: false, stories: [{ id: 'about', trained: 0 }] }, 480)
    expect(fresh.at(-1)).toEqual({ label: 'story', steps: [{ kind: 'storyKeys', story: 'about' }] })
    const trained = callSteps({ module: m, done: new Set(), seed: 1, quickGame: false, stories: [{ id: 'about', trained: 3 }] }, 480)
    expect(trained.at(-1)!.steps![0]!.kind).toBe('storyCold')
  })

  it('пройденный модуль уступает место следующему', () => {
    const progress: Progress = new Map([['air-weak', { moduleId: 'air-weak', startedAt: 1, completedAt: 2, done: moduleItems('air-weak') }]])
    expect(currentModule('air', progress)?.id).toBe('air-link')
  })

  it('разрезка на куски по 3 минуты', () => {
    const steps = Array.from({ length: 20 }, () => ({ kind: 'listen' as const, phrase: 'l-weak-01', speed: 1 }))
    const parts = chunkSteps(steps)
    expect(parts.every((p) => stepsSeconds(p) <= MAX_SEGMENT_SECONDS)).toBe(true)
    expect(parts.flat()).toHaveLength(20)
  })

  it('обновление плана: начатые блоки остаются, нетронутые берутся из свежего', () => {
    const old = planSegments({ minutes: 30, date: '2026-09-27', due: [], progress: new Map(), speed: 1 })
    old[0] = { ...old[0]!, status: 'done' }
    const fresh = planSegments({ minutes: 45, date: '2026-09-27', due: cards(12), progress: new Map(), speed: 1 })
    const merged = refreshSegments(old, fresh)
    expect(merged[0]).toMatchObject({ id: 'warmup', status: 'done' })
    expect(merged.some((s) => s.block === 'review')).toBe(true)
  })
})

describe('Техдок в сеансе', () => {
  const doc = () => moduleById.get('doc-structure')!

  it('текст: прочитать → найти → суть → разбор → пересказ; пересказ есть всегда', () => {
    const steps = docSteps({ module: doc(), done: new Set(), started: false, seed: 1 }, 360)
    expect(steps.map((s) => s.kind)).toEqual(['intro', 'docRead', 'docFind', 'docFind', 'docSummary', 'docParse', 'docRetell'])
    const short = docSteps({ module: doc(), done: new Set(), started: true, seed: 1 }, 120)
    expect(short.at(-1)!.kind).toBe('docRetell')
    expect(short.some((s) => s.kind === 'docParse')).toBe(false)
  })

  it('сначала непрочитанные тексты модуля', () => {
    const all = moduleItems('doc-structure')
    const done = new Set(all.slice(0, -1))
    const steps = docSteps({ module: doc(), done, started: true, seed: 5 }, 360)
    const read = steps.find((s) => s.kind === 'docRead')
    expect(read && read.kind === 'docRead' && read.text).toBe(all.at(-1))
  })

  it('ротация: треки без контента не участвуют, слабый получает вдвое больше дней', () => {
    expect(rotationTrack(3, [])).toBeUndefined()
    expect(rotationTrack(3, ['doc'])).toBe('doc')
    const days = Array.from({ length: 40 }, (_, d) => rotationTrack(d, ['doc', 'mail', 'clean'], { doc: 70, mail: 30, clean: 60 }))
    const n = (t: string) => days.filter((x) => x === t).length
    expect(n('mail')).toBe(2 * n('doc'))
    expect(n('clean')).toBe(n('doc'))
  })

  it('в сеансе ротация — Техдок, сегменты ≤ 3 минут, все шаги живые', () => {
    const segs = planSegments({ minutes: 30, date: '2026-09-27', due: [], progress: new Map(), speed: 1 })
    const rot = segs.filter((s) => s.block === 'rotation')
    expect(rot.length).toBeGreaterThan(0)
    expect(rot.every((s) => s.track === 'doc')).toBe(true)
    for (const s of rot) {
      expect(stepsSeconds(s.steps!)).toBeLessThanOrEqual(MAX_SEGMENT_SECONDS)
      expect(s.steps!.every(stepAlive)).toBe(true)
    }
  })
})
