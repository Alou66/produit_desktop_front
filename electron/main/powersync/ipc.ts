import { BrowserWindow, ipcMain } from 'electron'

import type { PowerSyncStatus } from '../../shared/powersync.types'
import { initializePowerSync } from './index'

let latestStatus: PowerSyncStatus | null = null

function broadcastStatus(status: PowerSyncStatus): void {
  latestStatus = status
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('powersync:status', status)
  }
}

/**
 * Starts PowerSync and exposes its connection status to the renderer:
 * `powersync:getStatus` (pull, for the initial render) and the
 * `powersync:status` event (push, on every change). Mirrors
 * ../ipc/products.ipc.ts's `registerProductsIpc()` pattern. No PowerSync
 * queries are exposed yet — only connection status, since no table is
 * synced (see ./schema.ts).
 */
export function registerPowerSyncIpc(): void {
  initializePowerSync(broadcastStatus)

  ipcMain.handle('powersync:getStatus', () => latestStatus)
}
