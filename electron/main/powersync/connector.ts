import {
  UpdateType,
  type CommonPowerSyncDatabase,
  type CrudEntry,
  type PowerSyncBackendConnector,
  type PowerSyncCredentials
} from '@powersync/node'

import { powersyncConfig } from './config'

/**
 * Bridges the PowerSync client to the outside world: where to connect
 * (`fetchCredentials`) and where local writes go (`uploadData`).
 */
export class AppConnector implements PowerSyncBackendConnector {
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    if (!powersyncConfig.isConfigured) {
      // Returning null tells the SDK there's nothing to sync against yet;
      // the local SQLite database keeps working (Local First).
      return null
    }

    // fetch() throwing here (produit-api unreachable) is left to propagate
    // as-is, same as uploadEntry() below — the SDK treats it as retryable.
    const response = await fetch(`${powersyncConfig.apiUrl}/auth/token`, { method: 'POST' })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`produit-api returned ${response.status} for POST /auth/token: ${body}`)
    }

    const { token, powersync_url: powersyncUrl } = (await response.json()) as {
      token: string
      powersync_url: string
    }

    return {
      endpoint: powersyncUrl,
      token
    }
  }

  /**
   * Sends locally queued writes to produit-api, one CrudEntry at a time, in
   * the order PowerSync recorded them — mirrors the REST routes in
   * produit-api/src/modules/products/product.routes.ts. Per PowerSync's
   * "Writing Client Changes" guidance: a network/5xx failure is rethrown so
   * the SDK retries the whole transaction later; a 4xx (validation/conflict)
   * is logged and skipped instead of blocking the upload queue forever.
   */
  async uploadData(database: CommonPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction()
    if (!transaction) {
      return
    }

    if (!powersyncConfig.apiUrl) {
      throw new Error('MAIN_VITE_API_URL is not configured — cannot upload local changes to produit-api.')
    }

    try {
      for (const op of transaction.crud) {
        await uploadEntry(powersyncConfig.apiUrl, op)
      }
      await transaction.complete()
    } catch (error) {
      if (error instanceof NonRetryableUploadError) {
        console.error('[powersync] discarding non-retryable upload error', error.cause)
        await transaction.complete()
        return
      }
      // Network error or 5xx: rethrow so the SDK keeps the transaction
      // queued and retries automatically.
      throw error
    }
  }
}

class NonRetryableUploadError extends Error {
  constructor(public readonly cause: unknown) {
    super('Non-retryable upload error')
  }
}

async function uploadEntry(apiUrl: string, op: CrudEntry): Promise<void> {
  const table = op.table // 'products'
  const endpoint = `${apiUrl}/${table}/${op.id}`
  const collectionEndpoint = `${apiUrl}/${table}`

  // fetch() throwing here (backend unreachable) is left to propagate as-is:
  // it's a plain network error, which uploadData()'s caller treats as
  // retryable since it isn't a NonRetryableUploadError.
  let response: Response
  switch (op.op) {
    case UpdateType.PUT:
      response = await fetch(collectionEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: op.id, ...op.opData })
      })
      break
    case UpdateType.PATCH:
      response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op.opData)
      })
      break
    case UpdateType.DELETE:
      response = await fetch(endpoint, { method: 'DELETE' })
      break
    default:
      throw new NonRetryableUploadError(new Error(`Unknown PowerSync op type: ${op.op as string}`))
  }

  if (response.ok) {
    return
  }

  if (response.status >= 500) {
    throw new Error(`produit-api returned ${response.status} for ${op.op} ${table}/${op.id}`)
  }

  // 4xx: validation error or the row is already gone/duplicated — not
  // something a retry will fix.
  const body = await response.text().catch(() => '')
  throw new NonRetryableUploadError(new Error(`produit-api returned ${response.status}: ${body}`))
}
