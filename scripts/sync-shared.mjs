// Copies the code both dashboards share from web/ (the source of truth) into frontend/:
// the farm automation engine and the translations. Run after editing either:
//   node scripts/sync-shared.mjs
import { cpSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const pairs = [
  ['web/src/lib/farm', 'frontend/src/farm', ['india.ts', 'engine.ts', 'simulator.ts']],
  ['web/src/lib/i18n', 'frontend/src/i18n', ['core.ts', 'en.ts']],
]
const note = (from) => `// Shared with ${from} - edit it there and run node scripts/sync-shared.mjs.\n`

for (const [from, to, files] of pairs) {
  mkdirSync(to, { recursive: true })
  for (const file of files) writeFileSync(join(to, file), note(from) + readFileSync(join(from, file), 'utf8'))
}
cpSync('web/src/lib/i18n/locales', 'frontend/src/i18n/locales', { recursive: true })
console.log('synced', readdirSync('frontend/src/i18n/locales').length, 'locales')
