'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Forma de un producto ya resuelto con su lote FIFO activo ─
export interface ProductoConStock {
  id: number
  nombre: string
  codigo_barras: string | null
  categoria_id: number | null
  precio_venta: number
  stock_actual: number
  imagen_url: string | null
  lote_activo: {
    id_lote: number
    precio_venta_sugerido: number
    stock_lote: number
    fecha_caducidad?: string | null
  } | null
}

export function useProductos(establecimientoId: number | undefined, sucursalId: number | null) {
  const [productos, setProductos] = useState<ProductoConStock[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargarProductos = useCallback(async () => {
    if (!establecimientoId) return
    setIsLoading(true)
    setError(null)

    try {
      const { data: productosData, error: productosError } = await supabase
        .from('productos')
        .select('id, nombre, codigo_barras, categoria_id, precio_venta, stock_actual, imagen_url')
        .eq('establecimiento_id', establecimientoId)
        .eq('visible_en_catalogo', true)

      if (productosError) throw productosError
      if (!productosData) {
        setProductos([])
        return
      }

      let lotesQuery = supabase
        .from('lotes_productos')
        .select('id_lote, producto_id, sucursal_id, precio_venta_sugerido, stock_lote, creado_en, fecha_caducidad')
        .gt('stock_lote', 0)
        .order('creado_en', { ascending: true })

      if (sucursalId) {
        lotesQuery = lotesQuery.eq('sucursal_id', sucursalId)
      }

      const { data: lotesData, error: lotesError } = await lotesQuery
      if (lotesError) throw lotesError

      const combinados: ProductoConStock[] = productosData.map((p) => {
        const lote = lotesData?.find((l) => l.producto_id === p.id) ?? null
        return {
          id: p.id,
          nombre: p.nombre,
          codigo_barras: p.codigo_barras,
          categoria_id: p.categoria_id,
          precio_venta: Number(p.precio_venta),
          stock_actual: p.stock_actual ?? 0,
          imagen_url: p.imagen_url,
          lote_activo: lote
            ? {
                id_lote: lote.id_lote,
                precio_venta_sugerido: Number(lote.precio_venta_sugerido),
                stock_lote: lote.stock_lote,
                fecha_caducidad: lote.fecha_caducidad,
              }
            : null,
        }
      })

      setProductos(combinados)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar productos')
    } finally {
      setIsLoading(false)
    }
  }, [establecimientoId, sucursalId])

  useEffect(() => {
    cargarProductos()
  }, [cargarProductos])

  const buscarPorCodigoBarras = useCallback(
    (codigo: string) => productos.find((p) => p.codigo_barras === codigo) ?? null,
    [productos]
  )

  return { productos, isLoading, error, recargar: cargarProductos, buscarPorCodigoBarras }
}