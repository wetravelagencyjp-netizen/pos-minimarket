'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ItemCarrito } from '@/core/context/CarritoContext'

export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'credito'

interface RegistrarVentaParams {
  establecimientoId: number
  vendedorId: number | null
  clienteId: number | null
  items: ItemCarrito[]
  total: number
  metodoPago: MetodoPago
  cajaId: number | null
  bancoId: number | null
}

export function useRegistrarVenta() {
  const [isProcesando, setIsProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const registrarVenta = useCallback(async (params: RegistrarVentaParams) => {
    setIsProcesando(true)
    setError(null)

    try {
      const numeroComprobante = `V-${Date.now()}`

      const itemsPayload = params.items.map((item) => ({
        producto_id: item.productoId,
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
      }))

      const { data, error: rpcError } = await supabase.rpc('registrar_venta_completa', {
        p_establecimiento_id: params.establecimientoId,
        p_numero_comprobante: numeroComprobante,
        p_total: params.total,
        p_metodo_pago: params.metodoPago,
        p_cliente_id: params.clienteId,
        p_caja_id: params.cajaId,
        p_vendedor_id: params.vendedorId,
        p_items: itemsPayload,
        p_banco_id: params.bancoId,
      })

      if (rpcError) throw new Error(rpcError.message)

      return { success: true, ventaId: data?.venta_id, numeroComprobante: data?.comprobante ?? numeroComprobante }
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error al registrar la venta'
      setError(mensaje)
      return { success: false, error: mensaje }
    } finally {
      setIsProcesando(false)
    }
  }, [])

  return { registrarVenta, isProcesando, error }
}