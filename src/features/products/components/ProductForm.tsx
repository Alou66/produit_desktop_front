import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { CreateProductInput, Product } from '../types/product.types'

interface ProductFormProps {
  initialValues?: Product
  submitLabel: string
  onSubmit: (input: CreateProductInput) => Promise<void>
  onCancel?: () => void
}

export function ProductForm({ initialValues, submitLabel, onSubmit, onCancel }: ProductFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '')
  const [price, setPrice] = useState(initialValues ? String(initialValues.price) : '')
  const [stock, setStock] = useState(initialValues ? String(initialValues.stock) : '')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)

    if (name.trim().length === 0) {
      setError('Le nom du produit est obligatoire.')
      return
    }

    const parsedPrice = Number(price)
    if (price.trim().length === 0 || Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Le prix doit être un nombre positif.')
      return
    }

    const parsedStock = Number(stock)
    if (stock.trim().length === 0 || !Number.isInteger(parsedStock) || parsedStock < 0) {
      setError('Le stock doit être un nombre entier positif.')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({ name: name.trim(), price: parsedPrice, stock: parsedStock })
      if (!initialValues) {
        setName('')
        setPrice('')
        setStock('')
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Une erreur est survenue.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="product-name" className="text-sm font-medium">
            Nom
          </label>
          <Input
            id="product-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Coca"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="product-price" className="text-sm font-medium">
            Prix
          </label>
          <Input
            id="product-price"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="500"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="product-stock" className="text-sm font-medium">
            Stock
          </label>
          <Input
            id="product-stock"
            type="number"
            min="0"
            step="1"
            value={stock}
            onChange={(event) => setStock(event.target.value)}
            placeholder="20"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  )
}
