import { useEffect, useState } from 'react'

import { usePowerSyncStatus } from '@/lib/powersync/usePowerSyncStatus'

import { ProductError, ProductService } from '../services/ProductService'
import type { CreateProductInput, Product, UpdateProductInput } from '../types/product.types'

export interface UseProductsResult {
  products: Product[]
  isLoading: boolean
  error: ProductError | null
  /** PowerSync connection/sync state, `null` until the first status arrives. Not a product-CRUD error — see ProductsPage for how the two are shown separately. */
  syncStatus: ReturnType<typeof usePowerSyncStatus>
  createProduct: (input: CreateProductInput) => Promise<void>
  updateProduct: (id: string, input: UpdateProductInput) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
}

/**
 * Sole React entry point for the products feature. Components must use
 * this hook (or ProductService directly for one-off actions) — never
 * ProductRepository or window.api.products.
 *
 * The list combines an initial `list()` pull (so state isn't empty while
 * the first `watch()` push from the main process is still in flight) with
 * `subscribe()` for every subsequent change — local write or incoming sync.
 */
export function useProducts(): UseProductsResult {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<ProductError | null>(null)
  const syncStatus = usePowerSyncStatus()

  useEffect(() => {
    let cancelled = false

    ProductService.list()
      .then((data) => {
        if (!cancelled) setProducts(data)
      })
      .catch((loadError: ProductError) => {
        if (!cancelled) setError(loadError)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    const unsubscribe = ProductService.subscribe((data) => {
      if (!cancelled) setProducts(data)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  async function createProduct(input: CreateProductInput): Promise<void> {
    setError(null)
    try {
      await ProductService.create(input)
    } catch (createError) {
      setError(createError as ProductError)
      throw createError
    }
  }

  async function updateProduct(id: string, input: UpdateProductInput): Promise<void> {
    setError(null)
    try {
      await ProductService.update(id, input)
    } catch (updateError) {
      setError(updateError as ProductError)
      throw updateError
    }
  }

  async function deleteProduct(id: string): Promise<void> {
    setError(null)
    try {
      await ProductService.delete(id)
    } catch (deleteError) {
      setError(deleteError as ProductError)
      throw deleteError
    }
  }

  return { products, isLoading, error, syncStatus, createProduct, updateProduct, deleteProduct }
}
