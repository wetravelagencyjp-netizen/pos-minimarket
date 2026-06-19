import type { ModuloConfig } from '@/core/types/modulos.types'
import BarcodeScanner from './BarcodeScanner'
import CatalogoProductos from '@/components/pos/CatalogoProductos'

export const RetailModule: ModuloConfig = {
  displayName: 'Retail / Minimarket',
  topBarSlot:       BarcodeScanner,
  catalogoSlot:      CatalogoProductos,
  carritoSlot:       null,
  alertaSlot:        null,
  clienteExtraSlot:  null,
}