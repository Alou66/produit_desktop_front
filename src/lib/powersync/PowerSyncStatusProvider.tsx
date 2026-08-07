import { createContext, useEffect, useState, type ReactNode } from 'react'

import type { PowerSyncStatus } from '@shared/powersync.types'

export const PowerSyncStatusContext = createContext<PowerSyncStatus | null>(null)

/**
 * Makes the PowerSync connection status available anywhere in the renderer
 * via `usePowerSyncStatus()`. The actual PowerSync client lives in the main
 * process (see electron/main/powersync/) — the renderer never talks to it
 * directly, only through the `window.api.powersync` bridge exposed by
 * electron/preload/index.ts. `null` means the initial status hasn't arrived
 * from the main process yet.
 */
export function PowerSyncStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<PowerSyncStatus | null>(null)

  useEffect(() => {
    let cancelled = false

    window.api.powersync.getStatus().then((initial) => {
      if (!cancelled) {
        setStatus(initial)
      }
    })

    const unsubscribe = window.api.powersync.onStatusChange((next) => {
      setStatus(next)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return <PowerSyncStatusContext.Provider value={status}>{children}</PowerSyncStatusContext.Provider>
}
