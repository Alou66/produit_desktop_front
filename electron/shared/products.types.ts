export interface Product {
  id: string
  name: string
  price: number
  stock: number
  /** ISO 8601 string: PowerSync's local SQLite has no native date type (see powersync/schema.ts). */
  createdAt: string
  /** ISO 8601 string: PowerSync's local SQLite has no native date type (see powersync/schema.ts). */
  updatedAt: string
}

export type CreateProductInput = Pick<Product, 'name' | 'price' | 'stock'>

export type UpdateProductInput = Pick<Product, 'name' | 'price' | 'stock'>
