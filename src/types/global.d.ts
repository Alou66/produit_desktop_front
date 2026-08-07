import type { CreateProductInput, Product, UpdateProductInput } from '@shared/products.types'
import type { PowerSyncStatus } from '@shared/powersync.types'

export {}

declare global {
  interface Window {
    api: {
      products: {
        list: () => Promise<Product[]>
        create: (input: CreateProductInput) => Promise<Product>
        update: (id: string, input: UpdateProductInput) => Promise<Product>
        delete: (id: string) => Promise<void>
        onChange: (callback: (products: Product[]) => void) => () => void
      }
      powersync: {
        getStatus: () => Promise<PowerSyncStatus | null>
        onStatusChange: (callback: (status: PowerSyncStatus) => void) => () => void
      }
    }
  }
}
