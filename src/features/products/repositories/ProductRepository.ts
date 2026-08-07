import type { CreateProductInput, Product, UpdateProductInput } from '../types/product.types'

/**
 * Contract the rest of the app (ProductService, and nothing above it) codes
 * against. Swapping the local-storage engine — the only realistic reason to
 * ever do so — means writing a new class that satisfies this interface, with
 * zero changes to ProductService, the hooks, or any component.
 */
export interface IProductRepository {
  list(): Promise<Product[]>
  create(input: CreateProductInput): Promise<Product>
  update(id: string, input: UpdateProductInput): Promise<Product>
  delete(id: string): Promise<void>
  /**
   * Subscribes to the live product list. Fires once per change — a local
   * write or a row arriving through sync. Returns an unsubscribe function.
   */
  subscribe(onChange: (products: Product[]) => void): () => void
}

/**
 * PowerSync-backed implementation of IProductRepository. Only file in the
 * renderer allowed to reference `window.api.products` — the PowerSync SDK
 * itself lives in the Electron main process (electron/main/powersync/),
 * reached here through the IPC bridge exposed by electron/preload/index.ts.
 * Pure data access — no validation, no error translation, no React. Every
 * other layer (services, hooks, components) goes through this.
 */
class PowerSyncProductRepository implements IProductRepository {
  list(): Promise<Product[]> {
    return window.api.products.list()
  }

  create(input: CreateProductInput): Promise<Product> {
    return window.api.products.create(input)
  }

  update(id: string, input: UpdateProductInput): Promise<Product> {
    return window.api.products.update(id, input)
  }

  delete(id: string): Promise<void> {
    return window.api.products.delete(id)
  }

  /**
   * Backed by `powersyncDb.watch()` in electron/main/ipc/products.ipc.ts,
   * broadcast to every renderer window on the `products:changed` channel.
   */
  subscribe(onChange: (products: Product[]) => void): () => void {
    return window.api.products.onChange(onChange)
  }
}

export const ProductRepository: IProductRepository = new PowerSyncProductRepository()
