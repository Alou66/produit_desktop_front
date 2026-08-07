import { useContext } from 'react'

import { PowerSyncStatusContext } from './PowerSyncStatusProvider'
import type { PowerSyncStatus } from '@shared/powersync.types'

/**
 * Current PowerSync connection status, or `null` before the first status
 * arrives from the main process. Purely infrastructure (connection state
 * only) — no product/business queries live here yet.
 */
export function usePowerSyncStatus(): PowerSyncStatus | null {
  return useContext(PowerSyncStatusContext)
}
