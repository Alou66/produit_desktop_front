import { useState } from 'react'

import { ProductForm } from '@/features/products/components/ProductForm'
import { ProductList } from '@/features/products/components/ProductList'
import { useProducts } from '@/features/products/hooks/useProducts'
import type { CreateProductInput, Product } from '@/features/products/types/product.types'

const SYNC_WARNINGS: Record<string, string> = {
  disabled: 'Synchronisation désactivée : les produits restent enregistrés localement.',
  connecting: 'Connexion à la synchronisation en cours…',
  error: 'Erreur de synchronisation : les produits restent enregistrés localement en attendant.'
}

export function ProductsPage() {
  const { products, isLoading, error, syncStatus, createProduct, updateProduct, deleteProduct } = useProducts()
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  async function handleCreate(input: CreateProductInput): Promise<void> {
    await createProduct(input)
  }

  async function handleUpdate(input: CreateProductInput): Promise<void> {
    if (!editingProduct) return
    await updateProduct(editingProduct.id, input)
    setEditingProduct(null)
  }

  async function handleDelete(product: Product): Promise<void> {
    try {
      await deleteProduct(product.id)
      if (editingProduct?.id === product.id) {
        setEditingProduct(null)
      }
    } catch {
      // L'erreur est déjà exposée via `error` par useProducts().
    }
  }

  const syncWarning = syncStatus && syncStatus.state !== 'connected' ? SYNC_WARNINGS[syncStatus.state] : null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Produits</h2>
        <p className="text-muted-foreground">Module de gestion des produits</p>
      </div>

      {syncWarning && <p className="text-sm text-amber-600">{syncWarning}</p>}

      {editingProduct ? (
        <ProductForm
          key={editingProduct.id}
          initialValues={editingProduct}
          submitLabel="Enregistrer"
          onSubmit={handleUpdate}
          onCancel={() => setEditingProduct(null)}
        />
      ) : (
        <ProductForm submitLabel="Ajouter" onSubmit={handleCreate} />
      )}

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des produits...</p>
      ) : (
        <ProductList products={products} onEdit={setEditingProduct} onDelete={handleDelete} />
      )}
    </div>
  )
}
