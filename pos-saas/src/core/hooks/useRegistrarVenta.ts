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
}

export function useRegistrarVenta() {
  const [isProcesando, setIsProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const registrarVenta = useCallback(async (params: RegistrarVentaParams) => {
    setIsProcesando(true)
    setError(null)

    try {
      const numeroComprobante = `V-${Date.now()}`

      // 1. Crear la venta
      const { data: venta, error: ventaError } = await supabase
        .from('ventas')
        .insert({
          establecimiento_id: params.establecimientoId,
          numero_comprobante: numeroComprobante,
          total: params.total,
          metodo_pago: params.metodoPago,
          cliente_id: params.clienteId,
          caja_id: params.cajaId,
        })
        .select('id')
        .single()

      if (ventaError || !venta) throw new Error(ventaError?.message ?? 'No se pudo crear la venta')

      // 2. Insertar cada línea de detalle_ventas
      const detalles = params.items.map((item) => ({
        venta_id: venta.id,
        producto_id: item.productoId,
        vendedor_id: params.vendedorId,
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
        subtotal: item.precioUnitario * item.cantidad,
      }))

      const { error: detalleError } = await supabase.from('detalle_ventas').insert(detalles)
      if (detalleError) throw new Error(detalleError.message)

      // 3. Descontar stock del lote FIFO activo de cada producto
      for (const item of params.items) {
        const { data: lote, error: loteError } = await supabase
          .from('lotes_productos')
          .select('id_lote, stock_lote')
          .eq('producto_id', item.productoId)
          .gt('stock_lote', 0)
          .order('creado_en', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (loteError || !lote) continue // sin lote activo, se omite (stock_actual queda como respaldo)

        const nuevoStock = Math.max(0, lote.stock_lote - item.cantidad)
        await supabase
          .from('lotes_productos')
          .update({ stock_lote: nuevoStock })
          .eq('id_lote', lote.id_lote)
      }

      // 4. Si la venta es a crédito, sumar el total al saldo pendiente del cliente
      if (params.metodoPago === 'credito' && params.clienteId) {
        const { data: clienteActual, error: clienteFetchError } = await supabase
          .from('clientes')
          .select('saldo_pendiente')
          .eq('id', params.clienteId)
          .single()

        if (!clienteFetchError && clienteActual) {
          const nuevoSaldo = Number(clienteActual.saldo_pendiente) + params.total
          await supabase
            .from('clientes')
            .update({ saldo_pendiente: nuevoSaldo })
            .eq('id', params.clienteId)
        }
      }

      return { success: true, ventaId: venta.id, numeroComprobante }
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