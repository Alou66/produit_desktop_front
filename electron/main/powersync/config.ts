  /**
   * Reads the PowerSync-related environment variable and exposes it as one
   * typed object, so no other file in this module reads `import.meta.env`
   * directly. `MAIN_VITE_` is the electron-vite prefix required for a
   * variable to be available in the main process (see electron-vite's
   * env-and-mode guide) — an unprefixed `POWERSYNC_URL` would silently be
   * `undefined` here.
   */
  export interface PowerSyncConfig {
    /**
     * Base URL of `produit-api`'s REST API (e.g. `http://localhost:3000/api`).
     * Used both by connector.ts::uploadData() to write local changes back to
     * Neon via Prisma, and by fetchCredentials() to fetch a short-lived
     * PowerSync JWT from `${apiUrl}/auth/token`. The PowerSync instance URL
     * itself is not configured locally — it's returned by that endpoint on
     * every call, so it can't drift from what produit-api actually signed
     * the token for.
     */
    apiUrl: string | undefined
    /** True once `apiUrl` is set. */
    isConfigured: boolean
  }

  const apiUrl = import.meta.env.MAIN_VITE_API_URL || undefined

  export const powersyncConfig: PowerSyncConfig = {
    apiUrl,
    isConfigured: Boolean(apiUrl)
  }

  if (!powersyncConfig.isConfigured) {
    console.warn(
      '[powersync] MAIN_VITE_API_URL missing — local writes cannot be uploaded to produit-api and sync credentials cannot be fetched; running local-only.'
    )
  }
