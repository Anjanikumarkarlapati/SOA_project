// Checks every locale against en.ts: no unknown keys, the same {placeholders}, and coverage.
// Run: node scripts/check-i18n.mjs [dir]   (defaults to src/lib/i18n)
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2] ?? 'src/lib/i18n'
const parse = (file) => {
  const src = readFileSync(file, 'utf8')
  const body = src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1)
  // The dictionaries are plain object literals of string values.
  return Function(`return (${body})`)()
}
const holes = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')

const en = parse(join(dir, 'en.ts'))
const enKeys = Object.keys(en)
let failed = false
for (const file of readdirSync(join(dir, 'locales')).sort()) {
  const code = file.replace(/\.ts$/, '')
  const dict = parse(join(dir, 'locales', file))
  const problems = []
  for (const [key, value] of Object.entries(dict)) {
    if (!(key in en)) problems.push(`unknown key ${key}`)
    else if (holes(value) !== holes(en[key])) problems.push(`placeholders differ in ${key}: "${value}"`)
  }
  const covered = enKeys.filter((k) => k in dict).length
  console.log(`${code.padEnd(4)} ${String(covered).padStart(4)}/${enKeys.length}${problems.length ? '  ' + problems.length + ' problem(s)' : ''}`)
  for (const p of problems) console.log('     ' + p)
  if (problems.length) failed = true
}
process.exit(failed ? 1 : 0)
