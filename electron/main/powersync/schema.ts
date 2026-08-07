import { column, Schema, Table } from '@powersync/node'

/**
 * Client-side SQLite schema synced by PowerSync. One `Table` per Sync Rules
 * bucket (see produit-api/src/powersync/sync-rules.yaml). No `id` column is
 * declared: PowerSync always creates a `text` id column automatically, and
 * table/column names below must match the bucket's `SELECT` exactly for
 * data to flow into them.
 */
const products = new Table({
  name: column.text,
  price: column.real,
  stock: column.integer,
  createdAt: column.text,
  updatedAt: column.text
})

export const AppSchema = new Schema({ products })
