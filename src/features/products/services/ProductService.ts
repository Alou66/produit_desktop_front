import { ProductRepository } from '../repositories/ProductRepository'
import type { CreateProductInput, Product, UpdateProductInput } from '../types/product.types'

export type ProductErrorKind = 'validation' | 'sqlite' | 'connection' | 'unknown'

/**
 * Extends `Error` (rather than being a plain object) so existing
 * `instanceof Error` handling — e.g. ProductForm's submit handler — keeps
 * working unchanged and still gets the classified, user-facing `message`.
 */
export class ProductError extends Error {
  readonly kind: ProductErrorKind

  constructor(kind: ProductErrorKind, message: string) {
    super(message)
    this.name = 'ProductError'
    this.kind = kind
  }
}

/**
 * Classifies the error message electron/main/ipc/products.ipc.ts's
 * `toCleanError()` produces, so the UI can react differently to a bad
 * input than to a broken local database instead of showing a raw Error.
 */
function toProductError(error: unknown): ProductError {
  const message = error instanceof Error ? error.message : 'Une erreur inattendue est survenue.'

  if (/obligatoire|positif|entier/.test(message)) {
    return new ProductError('validation', message)
  }
  if (/SQLite|base de données locale|contrainte/.test(message)) {
    return new ProductError('sqlite', message)
  }
  if (/ipcRenderer|window\.api|not configured/.test(message)) {
    return new ProductError('connection', 'Impossible de joindre le processus local. Redémarrez l’application.')
  }
  return new ProductError('unknown', message)
}

/**
 * Wraps ProductRepository with error classification. No revalidation of
 * input here — ProductForm already validates for UX, and
 * products.ipc.ts is the authoritative boundary check; this layer only
 * translates whatever comes back from that boundary.
 */
export const ProductService = {
  async list(): Promise<Product[]> {
    try {
      return await ProductRepository.list()
    } catch (error) {
      throw toProductError(error)
    }
  },

  subscribe(onChange: (products: Product[]) => void): () => void {
    return ProductRepository.subscribe(onChange)
  },

  async create(input: CreateProductInput): Promise<Product> {
    try {
      return await ProductRepository.create(input)
    } catch (error) {
      throw toProductError(error)
    }
  },

  async update(id: string, input: UpdateProductInput): Promise<Product> {
    try {
      return await ProductRepository.update(id, input)
    } catch (error) {
      throw toProductError(error)
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await ProductRepository.delete(id)
    } catch (error) {
      throw toProductError(error)
    }
  }
}
