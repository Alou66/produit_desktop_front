#!/usr/bin/env node
// Inspects the local PowerSync SQLite database (electron/main/powersync/database.ts).
// Must run under Electron's Node runtime (see package.json script) because
// better-sqlite3 is rebuilt for Electron's ABI via `electron-rebuild`, not
// the system Node's.

const os = require('node:os')
const path = require('node:path')
const Database = require('better-sqlite3')

const appName = require('../package.json').name

function userDataDir() {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', appName)
    case 'win32':
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), appName)
    default:
      return path.join(os.homedir(), '.config', appName)
  }
}

const dbPath = path.join(userDataDir(), 'powersync.db')
const db = new Database(dbPath, { readonly: true })

console.log(`Base : ${dbPath}\n`)

// PowerSync stores app data in `ps_data__<table>` and exposes a friendly
// SQL VIEW named after the schema table (e.g. "products") over it — query
// the views, since that's what the app itself reads from.
const appTables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='view' ORDER BY name")
  .all()
  .map((t) => t.name)

if (appTables.length === 0) {
  console.log('Aucune table de donnees applicatives trouvee.')
} else {
  for (const table of appTables) {
    const rows = db.prepare(`SELECT * FROM "${table}"`).all()
    console.log(`--- ${table} (${rows.length}) ---`)
    if (rows.length > 0) console.table(rows)
    console.log()
  }
}

const pending = db.prepare('SELECT count(*) as pending FROM ps_crud').get().pending
const syncState = db.prepare('SELECT * FROM ps_sync_state').all()
console.log(`Changements locaux non synchronises : ${pending}`)
console.log('Etat de synchronisation :', syncState)

db.close()
