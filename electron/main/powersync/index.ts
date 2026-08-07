import type { SyncStatus } from '@powersync/node'

import type { PowerSyncStatus } from '../../shared/powersync.types'
import { powersyncConfig } from './config'
import { AppConnector } from './connector'
import { powersyncDb } from './database'

export { powersyncDb }

function toPowerSyncStatus(status: SyncStatus): PowerSyncStatus {
  const downloadError = status.downloadError?.message ?? null
  const uploadError = status.uploadError?.message ?? null

  return {
    state: !powersyncConfig.isConfigured
      ? 'disabled'
      : status.connected
        ? 'connected'
        : downloadError || uploadError
          ? 'error'
          : 'connecting',
    connected: status.connected,
    hasSynced: status.hasSynced ?? false,
    lastSyncedAt: status.lastSyncedAt?.toISOString() ?? null,
    downloadError,
    uploadError
  }
}

let initialized = false

/**
 * Opens the local SQLite database (already done at module load by
 * ./database.ts) and starts syncing against the PowerSync service, if
 * configured. `onStatusChange` is called immediately with the current
 * status and again on every change, so callers never have to poll.
 *
 * Never throws: a missing/invalid PowerSync configuration or a failed sync
 * connection is reported through `onStatusChange` (state: 'error' or
 * 'disabled') instead of crashing the app — the local database keeps
 * working either way, consistent with this app being Local First.
 */
export function initializePowerSync(onStatusChange: (status: PowerSyncStatus) => void): void {
  if (initialized) {
    return
  }
  initialized = true

  onStatusChange(toPowerSyncStatus(powersyncDb.currentStatus))
  powersyncDb.registerListener({
    statusChanged(status) {
      onStatusChange(toPowerSyncStatus(status))
    }
  })

  if (!powersyncConfig.isConfigured) {
    return
  }

  powersyncDb.connect(new AppConnector()).catch((error: unknown) => {
    console.error('[powersync] connect() failed', error)
    onStatusChange({
      state: 'error',
      connected: false,
      hasSynced: powersyncDb.currentStatus.hasSynced ?? false,
      lastSyncedAt: powersyncDb.currentStatus.lastSyncedAt?.toISOString() ?? null,
      downloadError: error instanceof Error ? error.message : String(error),
      uploadError: null
    })
  })
}

/** Stops syncing and closes the local SQLite database. Call on app quit. */
export async function shutdownPowerSync(): Promise<void> {
  if (!initialized) {
    return
  }
  await powersyncDb.close()
}
