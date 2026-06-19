'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Forma de un producto ya resuelto con su lote FIFO activo ─
export interface ProductoConLote {
  id: string
  nombre_producto: string
  categoria: string
  codigo_barras_sku: string | null
  lote_id: string
  precio_venta: number
  stock_disponible: number
}

export function useLotesFIFO(tenantId: string | undefined, sucursalId: string | null) {
  const [productos, setProductos] = useState<ProductoConLote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tenantId) return

    async function cargarProductos() {
      setIsLoading(true)
      setError(null)

      try {
        // 1. Trae los productos del tenant
        const { data: productosData, error: productosError } = await supabase
          .from('productos')
          .select('id, nombre_producto, categoria, codigo_barras_sku')
          .eq('tenant_id', tenantId)

        if (productosError) throw productosError
        if (!productosData || productosData.length === 0) {
          setProductos([])
          return
        }

        // 2. Trae los lotes con stock, ordenados del más antiguo al más nuevo (FIFO)
        let lotesQuery = supabase
          .from('lotes_productos')
          .select('id_lote, producto_id, precio_venta_sugerido, stock_lote, sucursal_id, creado_en')
          .gt('stock_lote', 0)
          .order('creado_en', { ascending: true })

        // Filtra por sucursal si el usuario tiene una asignada
        if (sucursalId) {
          lotesQuery = lotesQuery.eq('sucursal_id', sucursalId)
        }

        const { data: lotesData, error: lotesError } = await lotesQuery
        if (lotesError) throw lotesError

        // 3. Combina: para cada producto, toma su PRIMER lote disponible (el más antiguo)
        const productosConLote: ProductoConLote[] = productosData
          .map((producto) => {
            const loteActivo = lotesData?.find((l) => l.producto_id === producto.id)
            if (!loteActivo) return null // sin stock en ningún lote = no se muestra

            return {
              id: producto.id,
              nombre_producto: producto.nombre_producto,
              categoria: producto.categoria,
              codigo_barras_sku: producto.codigo_barras_sku,
              lote_id: loteActivo.id_lote,
              precio_venta: Number(loteActivo.precio_venta_sugerido),
              stock_disponible: loteActivo.stock_lote,
            }
          })
          .filter((p): p is ProductoConLote => p !== null)

        setProductos(productosConLote)

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar productos')
      } finally {
        setIsLoading(false)
      }
    }

    cargarProductos()
  }, [tenantId, sucursalId])

  return { productos, isLoading, error }
}