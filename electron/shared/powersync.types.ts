/**
 * Connection lifecycle exposed to the renderer. `disabled` means no
 * POWERSYNC_URL/POWERSYNC_TOKEN is configured yet: the local SQLite database
 * still works (Local First), sync is simply off until configured.
 */
export type PowerSyncConnectionState = 'disabled' | 'connecting' | 'connected' | 'error'

export interface PowerSyncStatus {
  state: PowerSyncConnectionState
  connected: boolean
  hasSynced: boolean
  lastSyncedAt: string | null
  downloadError: string | null
  uploadError: string | null
}
