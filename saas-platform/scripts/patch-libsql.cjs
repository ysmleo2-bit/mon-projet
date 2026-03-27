/**
 * Patch @libsql/client to disable SQL caching (sqlCacheCapacity = 0).
 *
 * Root cause: @libsql/client v0.17+ sends "store_sql" requests (hrana v3)
 * in batch mode. Turso only supports hrana v2 and returns HTTP 400.
 * Setting sqlCacheCapacity = 0 disables the cache → SQL sent inline → works.
 */
const fs = require('fs')
const path = require('path')

const targets = [
  'node_modules/@libsql/client/lib-esm/http.js',
  'node_modules/@libsql/client/lib-cjs/http.js',
]

let patched = 0
for (const rel of targets) {
  const file = path.join(__dirname, '..', rel)
  if (!fs.existsSync(file)) continue
  const before = fs.readFileSync(file, 'utf8')
  const after = before.replace(
    'const sqlCacheCapacity = 30;',
    'const sqlCacheCapacity = 0; // patched: store_sql not supported by Turso v2'
  )
  if (before !== after) {
    fs.writeFileSync(file, after, 'utf8')
    console.log('patched:', rel)
    patched++
  } else {
    console.log('already patched or not found in:', rel)
  }
}
if (patched === 0) console.log('nothing to patch')
