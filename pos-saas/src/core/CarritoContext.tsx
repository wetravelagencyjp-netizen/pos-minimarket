'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { ProductoConStock } from '@/core/hooks/useProductos'

// ─── Forma de un item dentro del carrito ───────────────────────
export interface ItemCarrito {
  productoId: number
  nombre: string
  precioUnitario: number
  cantidad: number
  stockDisponible: number
}

interface CarritoContextValue {
  items: ItemCarrito[]
  total: number
  ultimoEscaneadoId: number | null
  agregarItem: (producto: ProductoConStock) => void
  quitarItem: (productoId: number) => void
  cambiarCantidad: (productoId: number, cantidad: number) => void
  vaciarCarrito: () => void
}

const CarritoContext = createContext<CarritoContextValue | null>(null)

export function CarritoProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ItemCarrito[]>([])
  const [ultimoEscaneadoId, setUltimoEscaneadoId] = useState<number | null>(null)

  const agregarItem = useCallback((producto: ProductoConStock) => {
    const precio = producto.lote_activo?.precio_venta_sugerido ?? producto.precio_venta
    const stock = producto.lote_activo?.stock_lote ?? producto.stock_actual

    setItems((prev) => {
      const existente = prev.find((i) => i.productoId === producto.id)
      if (existente) {
        if (existente.cantidad >= stock) return prev // no exceder stock
        return prev.map((i) =>
          i.productoId === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
        )
      }
      return [
        ...prev,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          precioUnitario: precio,
          cantidad: 1,
          stockDisponible: stock,
        },
      ]
    })

    setUltimoEscaneadoId(producto.id)
    setTimeout(() => setUltimoEscaneadoId(null), 800)
  }, [])

  const quitarItem = useCallback((productoId: number) => {
    setItems((prev) => prev.filter((i) => i.productoId !== productoId))
  }, [])

  const cambiarCantidad = useCallback((productoId: number, cantidad: number) => {
    if (cantidad <= 0) {
      setItems((prev) => prev.filter((i) => i.productoId !== productoId))
      return
    }
    setItems((prev) =>
      prev.map((i) =>
        i.productoId === productoId
          ? { ...i, cantidad: Math.min(cantidad, i.stockDisponible) }
          : i
      )
    )
  }, [])

  const vaciarCarrito = useCallback(() => setItems([]), [])

  const total = items.reduce((sum, i) => sum + i.precioUnitario * i.cantidad, 0)

  return (
    <CarritoContext.Provider
      value={{ items, total, ultimoEscaneadoId, agregarItem, quitarItem, cambiarCantidad, vaciarCarrito }}
    >
      {children}
    </CarritoContext.Provider>
  )
}

export function useCarrito() {
  const ctx = useContext(CarritoContext)
  if (!ctx) throw new Error('useCarrito debe usarse dentro de <CarritoProvider>')
  return ctx
}