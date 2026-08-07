import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

import type { Product } from '../types/product.types'

interface ProductListProps {
  products: Product[]
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
}

export function ProductList({ products, onEdit, onDelete }: ProductListProps) {
  if (products.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun produit pour le moment.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {products.map((product) => (
        <Card key={product.id}>
          <CardHeader>
            <CardTitle>{product.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span>Prix: {product.price}</span>
            <span>Stock: {product.stock}</span>
          </CardContent>
          <CardFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(product)}>
              Modifier
            </Button>
            <Button variant="destructive" size="sm" onClick={() => onDelete(product)}>
              Supprimer
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
