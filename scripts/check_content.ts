/*
  npm run check:content — контроль качества контента (ТЗ §9.5).
  Падает (код 1) при отсутствии звука, битых файлах, словах не из своей частотной полосы.
  Печатает долю reviewed: false и число фраз со связной речью на проверку на слух.
*/
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { audioNeeds, checkCourse, checkIntake, loadContentFiles, loadWordLists, reviewedStats } from './content_lib.ts'

const root = join(import.meta.dirname, '..')
const files = loadContentFiles(root)
const manifest = JSON.parse(readFileSync(join(root, 'public/audio/manifest.json'), 'utf8')) as {
  texts: Record<string, { voice: string; file: string }[]>
}
const errors: string[] = []
const warnings: string[] = []

// Звук: всё, что нужно контенту, есть в манифесте, и все файлы манифеста на месте.
const have = new Set(Object.entries(manifest.texts).flatMap(([text, es]) => es.map((e) => `${text}|${e.voice}`)))
const needed = new Set<string>()
for (const f of files) {
  for (const need of audioNeeds(f.data)) {
    needed.add(need)
    if (!have.has(need)) errors.push(`нет звука: «${need.replace('|', '» голосом ')} (${f.path}) — запусти scripts/generate_audio.py`)
  }
}
for (const [text, es] of Object.entries(manifest.texts))
  for (const e of es) if (!existsSync(join(root, 'public/audio', e.file))) errors.push(`звук «${text}»: нет файла ${e.file}`)

// Вводный тест: полосы частотности, псевдослова, варианты ответов.
const lists = loadWordLists(root)
const intake = files.find((f) => f.path.endsWith('content/intake.json'))
if (intake) errors.push(...checkIntake(intake.data as Parameters<typeof checkIntake>[0], lists))
else errors.push('нет src/content/intake.json')

// Курс: модули, id, варианты ответов, персонажи, повторы чанков.
errors.push(...checkCourse(files))

// Доля непроверенного.
let total = 0
let unreviewed = 0
for (const f of files) {
  const r = reviewedStats(f.data)
  total += r.total
  unreviewed += r.unreviewed
}

const review = existsSync(join(root, 'docs/audio-review.md'))
  ? readFileSync(join(root, 'docs/audio-review.md'), 'utf8').split('\n').filter((l) => /^\| [^-|]/.test(l) && !l.startsWith('| Фраза')).length
  : 0

console.log(`Контент: ${files.length} файлов JSON; звук: нужно ${needed.size}, в манифесте ${have.size}`)
for (const w of warnings) console.log(`  предупреждение: ${w}`)
for (const e of errors) console.error(`  ОШИБКА: ${e}`)
console.log(`Не проверено вручную (reviewed: false): ${unreviewed} из ${total}${total ? ` (${Math.round((100 * unreviewed) / total)}%)` : ''}`)
console.log(`Связная речь на проверку на слух: ${review} фраз → docs/audio-review.md`)

if (errors.length) {
  console.error(`\nПроверка не пройдена: ${errors.length} ошибок.`)
  process.exit(1)
}
console.log('\nПроверка пройдена.')
