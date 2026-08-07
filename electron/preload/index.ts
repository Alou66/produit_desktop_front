import { contextBridge, ipcRenderer } from 'electron'

import type { CreateProductInput, Product, UpdateProductInput } from '../shared/products.types'
import type { PowerSyncStatus } from '../shared/powersync.types'

const productsApi = {
  list: (): Promise<Product[]> => ipcRenderer.invoke('products:list'),
  create: (input: CreateProductInput): Promise<Product> => ipcRenderer.invoke('products:create', input),
  update: (id: string, input: UpdateProductInput): Promise<Product> =>
    ipcRenderer.invoke('products:update', id, input),
  delete: (id: string): Promise<void> => ipcRenderer.invoke('products:delete', id),
  onChange: (callback: (products: Product[]) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, products: Product[]): void => callback(products)
    ipcRenderer.on('products:changed', listener)
    return () => ipcRenderer.removeListener('products:changed', listener)
  }
}

const powersyncApi = {
  getStatus: (): Promise<PowerSyncStatus | null> => ipcRenderer.invoke('powersync:getStatus'),
  onStatusChange: (callback: (status: PowerSyncStatus) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: PowerSyncStatus): void => callback(status)
    ipcRenderer.on('powersync:status', listener)
    return () => ipcRenderer.removeListener('powersync:status', listener)
  }
}

const api = {
  products: productsApi,
  powersync: powersyncApi
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
