import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/* Контраст текста WCAG AA (≥ 4.5:1) для обеих тем — по значениям из tokens.css. */
const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]))
}

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
}

function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]
  return (x + 0.05) / (y + 0.05)
}

const PAIRS: [string, string][] = [
  ['ink', 'paper'],
  ['ink', 'surface'],
  ['ink-2', 'paper'],
  ['ink-2', 'surface'],
  ['signal-ink', 'paper'],
  ['signal-ink', 'surface'],
  ['on-signal', 'signal'],
  ['ok', 'surface'],
  ['danger', 'surface'],
  ['on-ink', 'ink'],
  ['ink', 'lcd'],
]

describe('контраст токенов', () => {
  for (const [name, sel] of [
    ['светлая', ':root {'],
    ['тёмная', ":root[data-theme='dark']"],
  ] as const) {
    const light = block(':root {')
    const t = { ...light, ...block(sel) }
    for (const [fg, bg] of PAIRS) {
      it(`${name}: ${fg} на ${bg}`, () => {
        expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})
