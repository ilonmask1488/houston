/* Какие звуки понадобятся шагу — чтобы скачать заранее и играть без задержки. */
import { chunkById, passageById, phraseById, questionById, spokenText, substById, textById, translateById } from '../../content'
import type { VoiceId } from '../../content/types'
import { defaultVoice } from '../../lib/audio/audio'
import type { Step } from '../../lib/run/steps'
import { dictById } from '../../lib/dict/dict'
import { parseCardId } from '../../lib/srs/srs'

type T = { text: string; voice?: VoiceId }

export function preloadFor(s: Step): T[] {
  switch (s.kind) {
    case 'listen':
    case 'dictation':
    case 'ladder': {
      const p = phraseById.get(s.phrase)
      return p ? [{ text: spokenText(p), voice: p.voice }] : []
    }
    case 'accents': {
      const p = phraseById.get(s.phrase)
      return p ? (p.voices ?? [p.voice]).map((voice) => ({ text: p.text, voice })) : []
    }
    case 'passage':
      return passageById.get(s.passage)?.lines.map((l) => ({ text: l.text, voice: l.voice })) ?? []
    case 'chunk': {
      const c = chunkById.get(s.chunk)
      return c ? [c.en, c.example].filter((x): x is string => !!x).map((text) => ({ text, voice: defaultVoice() })) : []
    }
    case 'quick': {
      const q = questionById.get(s.question)
      return q ? [{ text: q.q, voice: q.voice }] : []
    }
    case 'translate': {
      const t = translateById.get(s.item)
      return t ? [{ text: t.en, voice: defaultVoice() }] : []
    }
    case 'substitute': {
      const x = substById.get(s.item)
      return x ? [{ text: x.base, voice: defaultVoice() }, { text: x.swaps[s.swap]?.en ?? '', voice: defaultVoice() }] : []
    }
    case 'card': {
      const { itemId } = parseCardId(s.card)
      const p = phraseById.get(itemId)
      if (p) return [{ text: spokenText(p), voice: p.voice }]
      const c = chunkById.get(itemId)
      if (c) return [{ text: c.en, voice: defaultVoice() }]
      const w = dictById.get(itemId)
      return w?.voices?.length ? [{ text: w.text, voice: w.voices.includes(defaultVoice()) ? defaultVoice() : w.voices[0] }] : []
    }
    case 'docRetell': {
      const t = textById.get(s.text)
      return t?.retell[s.p] ? [{ text: t.retell[s.p]!, voice: defaultVoice() }] : []
    }
    default:
      return []
  }
}
