/* Подписи занятия простыми словами (UX §3.2–3.3): блоки по смыслу, план одной строкой, следующий блок. */
import type { TrackId } from '../../content/types'
import { ru } from '../../i18n/ru'
import type { SessionBlock, SessionRow, SessionSegment } from '../../lib/db/types'

export function segmentUrl(seg: SessionSegment): string {
  if (seg.kind === 'game' && seg.game) return `/game/${seg.game}?seg=${seg.id}`
  return `/run/seg/${seg.id}`
}

/** Название блока: «Быстрая речь на слух»; у раздела дня — «Сегодня: чтение». */
export function blockTitle(block: SessionBlock, track?: TrackId): string {
  if (block === 'rotation' && track) return ru.blockToday(ru.tracks[track].short)
  return ru.blocks[block].title
}

export function segmentBlockTitle(seg: SessionSegment): string {
  return blockTitle(seg.block, seg.track)
}

export type PlanBlock = { block: SessionBlock; title: string; minutes: number; status: 'done' | 'current' | 'pending'; segments: SessionSegment[] }

/** Блоки занятия в порядке первого появления (сегменты одного блока идут вперемешку с другими). */
export function planBlocks(row: SessionRow): PlanBlock[] {
  const next = row.segments.find((s) => s.status === 'pending')
  const out: PlanBlock[] = []
  for (const seg of row.segments) {
    let b = out.find((x) => x.block === seg.block)
    if (!b) {
      b = { block: seg.block, title: segmentBlockTitle(seg), minutes: 0, status: 'done', segments: [] }
      out.push(b)
    }
    b.minutes += seg.minutes
    b.segments.push(seg)
  }
  for (const b of out) {
    const pending = b.segments.some((s) => s.status === 'pending')
    b.status = next && b.segments.includes(next) ? 'current' : pending ? 'pending' : 'done'
  }
  return out
}

/** План одной строкой: «Разминка (игра) · Повторить 14 фраз и слов · Быстрая речь на слух · …». */
export function planLine(row: SessionRow): string[] {
  return planBlocks(row).map((b) => (b.block === 'review' ? ru.home.planReview(b.segments.reduce((n, s) => n + (s.steps?.length ?? 0), 0)) : b.title))
}

export function nextSegment(row: SessionRow | undefined, after?: string): SessionSegment | undefined {
  if (!row) return undefined
  return row.segments.find((s) => s.status === 'pending' && s.id !== after)
}
