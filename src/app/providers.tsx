import { RouterProvider } from 'react-router-dom'

import { router } from '@/app/router'
import { PowerSyncStatusProvider } from '@/lib/powersync/PowerSyncStatusProvider'

export function AppProviders() {
  return (
    <PowerSyncStatusProvider>
      <RouterProvider router={router} />
    </PowerSyncStatusProvider>
  )
}
