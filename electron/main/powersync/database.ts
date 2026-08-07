import fs from 'node:fs'

import { app } from 'electron'
import { createConsoleLogger, LogLevels, PowerSyncDatabase } from '@powersync/node'

import { AppSchema } from './schema'

// Electron's standard per-user, per-OS writable directory — the right place
// for a local database in a packaged app (unlike electron/main/database/prisma.ts's
// process.cwd(), which only works for this project's dev-only Prisma/SQLite setup).
const dataDirectory = app.getPath('userData')
if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true })
}

const logger = createConsoleLogger({
  prefix: '[powersync]',
  minLevel: import.meta.env.DEV ? LogLevels.debug : LogLevels.info
})

/**
 * Single PowerSyncDatabase instance for the whole app, instantiated once at
 * module load (the SDK's own guidance: "only instantiate one database
 * instance per file"). Opens the local SQLite database, managed entirely by
 * PowerSync's Node.js SDK — no `openWorker` override is needed here because
 * electron-vite's `externalizeDepsPlugin()` (see electron.vite.config.ts)
 * keeps `@powersync/node` as a plain `require()` instead of bundling it, so
 * the SDK's default worker resolves its own files from node_modules exactly
 * as it would in a plain Node.js app. Actually connecting to the PowerSync
 * service happens later, in ./index.ts via `connect()`.
 */
export const powersyncDb = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'powersync.db',
    dbLocation: dataDirectory
  },
  logger
})
