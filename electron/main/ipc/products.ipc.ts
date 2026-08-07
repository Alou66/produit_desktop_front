import { randomUUID } from 'node:crypto'

import { BrowserWindow, ipcMain } from 'electron'

import { powersyncDb } from '../powersync'
import type { CreateProductInput, Product, UpdateProductInput } from '../../shared/products.types'

const LIST_QUERY = 'SELECT id, name, price, stock, createdAt, updatedAt FROM products ORDER BY createdAt DESC'

function assertValidProductInput(input: CreateProductInput | UpdateProductInput): void {
  if (typeof input.name !== 'string' || input.name.trim().length === 0) {
    throw new Error('Le nom du produit est obligatoire.')
  }
  if (typeof input.price !== 'number' || Number.isNaN(input.price) || input.price < 0) {
    throw new Error('Le prix doit être un nombre positif.')
  }
  if (typeof input.stock !== 'number' || !Number.isInteger(input.stock) || input.stock < 0) {
    throw new Error('Le stock doit être un nombre entier positif.')
  }
}

/**
 * Turns a raw error from better-sqlite3 (local writes) or the PowerSync SDK
 * (e.g. not connected, closed database) into a message the renderer can
 * display as-is, without leaking stack traces or driver-specific codes.
 */
function toCleanError(error: unknown): Error {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code
    if (typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT')) {
      return new Error('Ce produit ne respecte pas une contrainte de la base locale.')
    }
    if (typeof code === 'string' && code.startsWith('SQLITE_')) {
      return new Error('Erreur de la base de données locale (SQLite).')
    }
    return error
  }
  return new Error('Une erreur inattendue est survenue.')
}

function broadcastProducts(products: Product[]): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('products:changed', products)
  }
}

/**
 * Starts a live PowerSync watch on `products` and pushes the fresh list to
 * every renderer window on every change — a local write, or a row that just
 * arrived from sync. This is what makes the UI "reactive" instead of
 * requiring a manual refetch after each mutation.
 */
function watchProducts(): void {
  powersyncDb.watch(LIST_QUERY, [], {
    // QueryResult's `array` is typed against the generic SqliteRecord
    // shape (WatchHandler isn't parameterizable); the actual rows match
    // LIST_QUERY's column list, i.e. Product.
    onResult: (results) => broadcastProducts(results.array as unknown as Product[]),
    onError: (error) => console.error('[products:watch]', toCleanError(error))
  })
}

export function registerProductsIpc(): void {
  watchProducts()

  ipcMain.handle('products:list', async () => {
    try {
      return await powersyncDb.getAll<Product>(LIST_QUERY)
    } catch (error) {
      console.error('[products:list]', error)
      throw toCleanError(error)
    }
  })

  ipcMain.handle('products:create', async (_event, input: CreateProductInput) => {
    try {
      assertValidProductInput(input)
      const id = randomUUID()
      const now = new Date().toISOString()
      await powersyncDb.execute(
        'INSERT INTO products (id, name, price, stock, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [id, input.name.trim(), input.price, input.stock, now, now]
      )
      return await powersyncDb.get<Product>('SELECT id, name, price, stock, createdAt, updatedAt FROM products WHERE id = ?', [id])
    } catch (error) {
      console.error('[products:create]', error)
      throw toCleanError(error)
    }
  })

  ipcMain.handle('products:update', async (_event, id: string, input: UpdateProductInput) => {
    try {
      assertValidProductInput(input)
      const now = new Date().toISOString()
      await powersyncDb.execute('UPDATE products SET name = ?, price = ?, stock = ?, updatedAt = ? WHERE id = ?', [
        input.name.trim(),
        input.price,
        input.stock,
        now,
        id
      ])
      return await powersyncDb.get<Product>('SELECT id, name, price, stock, createdAt, updatedAt FROM products WHERE id = ?', [id])
    } catch (error) {
      console.error('[products:update]', error)
      throw toCleanError(error)
    }
  })

  ipcMain.handle('products:delete', async (_event, id: string) => {
    try {
      await powersyncDb.execute('DELETE FROM products WHERE id = ?', [id])
    } catch (error) {
      console.error('[products:delete]', error)
      throw toCleanError(error)
    }
  })
}
