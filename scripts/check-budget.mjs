// Gzip JS budget per entry (own file + static imports, recursive); viewer is the dynamic chunk, measured alone.
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const KB = 1024
const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'))

const size = (key, seen = new Set()) => {
  if (seen.has(key)) return 0
  seen.add(key)
  const chunk = manifest[key]
  const own = gzipSync(readFileSync(`dist/${chunk.file}`)).length
  return (chunk.imports ?? []).reduce((sum, k) => sum + size(k, seen), own)
}

const rows = []
for (const [name, limit] of [['index', 30], ['catalogue', 30], ['exercise', 30]]) {
  const key = Object.keys(manifest).find((k) => manifest[k].isEntry && k === `${name}.html`)
  rows.push([name, key ? size(key) : null, limit])
}
const viewerKey = Object.keys(manifest).find((k) => manifest[k].src === 'src/viewer/viewer.ts')
rows.push(['viewer', viewerKey ? size(viewerKey) : null, 200])

let failed = false
for (const [name, bytes, limit] of rows) {
  if (bytes === null) {
    console.log(name === 'viewer' ? 'viewer: not built yet' : `${name}: MISSING from manifest`)
    if (name !== 'viewer') failed = true
    continue
  }
  const over = bytes > limit * KB
  failed ||= over
  console.log(`${name.padEnd(10)} ${(bytes / KB).toFixed(1).padStart(7)} KB gz / ${String(limit).padStart(3)} KB  ${over ? 'OVER' : 'ok'}`)
}
process.exit(failed ? 1 : 0)
