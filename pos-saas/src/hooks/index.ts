'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { type Producto, type Categoria, type Vendedor, type ItemCarrito, type GrupoVendedor, type MetodoPago } from '@/types'

export function useInventario(establecimientoId: number) {
  const [todos, setTodos]           = useState<Producto[]>([])
  const [productos, setProductos]   = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [p, c, v] = await Promise.all([
        supabase.from('productos')
          .select('*, vendedor:vendedores(*), categoria:categorias(*)')
          .eq('establecimiento_id', establecimientoId)
          .gt('stock_actual', 0).order('nombre'),
        supabase.from('categorias').select('*').eq('establecimiento_id', establecimientoId).order('nombre'),
        supabase.from('vendedores').select('*').eq('establecimiento_id', establecimientoId).order('nombre'),
      ])
      if (p.error) throw p.error
      if (c.error) throw c.error
      if (v.error) throw v.error
      setTodos(p.data ?? [])
      setProductos(p.data ?? [])
      setCategorias(c.data ?? [])
      setVendedores(v.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando inventario')
    } finally { setLoading(false) }
  }, [establecimientoId])

  useEffect(() => {
    cargar()
    const ch = supabase.channel(`inv-${establecimientoId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'productos',
        filter: `establecimiento_id=eq.${establecimientoId}` },
        payload => setTodos(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p))
      ).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [establecimientoId, cargar])

  const buscar = useCallback((q: string, catId: number | null) => {
    let r = todos
    if (catId !== null) r = r.filter(p => p.categoria_id === catId)
    if (q.trim()) {
      const lq = q.toLowerCase()
      r = r.filter(p => p.nombre.toLowerCase().includes(lq) || p.codigo_barras?.includes(lq))
    }
    setProductos(r)
  }, [todos])

  return { productos, categorias, vendedores, loading, error, buscar, recargar: cargar }
}

export type TipoDescuento = 'porcentaje' | 'fijo'
export interface Descuento { tipo: TipoDescuento; valor: number }

export function useCarrito(establecimientoId: number) {
  const [items, setItems]           = useState<Record<number, ItemCarrito>>({})
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo')
  const [descuentosItem, setDescuentosItem] = useState<Record<number, Descuento>>({})
  const [descuentoGlobal, setDescuentoGlobalState] = useState<Descuento>({ tipo: 'porcentaje', valor: 0 })

  const agregar = useCallback((producto: Producto) => {
    setItems(prev => {
      const qty = (prev[producto.id]?.cantidad ?? 0) + 1
      if (qty > producto.stock_actual) return prev
      return { ...prev, [producto.id]: { producto, cantidad: qty, subtotal: +(producto.precio_venta * qty).toFixed(2) } }
    })
  }, [])

  const cambiarCantidad = useCallback((id: number, delta: number) => {
    setItems(prev => {
      const item = prev[id]; if (!item) return prev
      const qty = item.cantidad + delta
      if (qty <= 0) { const { [id]: _, ...rest } = prev; return rest }
      if (qty > item.producto.stock_actual) return prev
      return { ...prev, [id]: { ...item, cantidad: qty, subtotal: +(item.producto.precio_venta * qty).toFixed(2) } }
    })
  }, [])

  const eliminar = useCallback((id: number) => {
    setItems(prev => { const { [id]: _, ...rest } = prev; return rest })
    setDescuentosItem(prev => { const { [id]: _, ...rest } = prev; return rest })
  }, [])

  const vaciar = useCallback(() => {
    setItems({})
    setDescuentosItem({})
    setDescuentoGlobalState({ tipo: 'porcentaje', valor: 0 })
  }, [])

  const setDescuentoItem = useCallback((id: number, descuento: Descuento | null) => {
    setDescuentosItem(prev => {
      if (!descuento || descuento.valor <= 0) { const { [id]: _, ...rest } = prev; return rest }
      return { ...prev, [id]: descuento }
    })
  }, [])

  const setDescuentoGlobal = useCallback((descuento: Descuento) => setDescuentoGlobalState(descuento), [])

  // Aplica el descuento de cada producto y luego prorratea el descuento global entre todos
  const itemsConDescuento = useMemo(() => {
    const base = Object.values(items).map(item => {
      const original = +(item.producto.precio_venta * item.cantidad).toFixed(2)
      const d = descuentosItem[item.producto.id]
      const descuentoItem = !d ? 0
        : d.tipo === 'porcentaje' ? +(original * d.valor / 100).toFixed(2)
        : Math.min(d.valor, original)
      const trasItem = +(original - descuentoItem).toFixed(2)
      return { item, original, descuentoItem, trasItem }
    })
    const sumaTrasItem = +base.reduce((s, x) => s + x.trasItem, 0).toFixed(2)
    const descuentoGlobalMonto = sumaTrasItem <= 0 ? 0
      : descuentoGlobal.tipo === 'porcentaje' ? +(sumaTrasItem * descuentoGlobal.valor / 100).toFixed(2)
      : Math.min(descuentoGlobal.valor, sumaTrasItem)

    return base.map(x => {
      const proporcion = sumaTrasItem > 0 ? x.trasItem / sumaTrasItem : 0
      const globalProrrateado = +(descuentoGlobalMonto * proporcion).toFixed(2)
      const descuento = +(x.descuentoItem + globalProrrateado).toFixed(2)
      const subtotal = +(x.original - descuento).toFixed(2)
      return { ...x.item, original: x.original, descuento, subtotal }
    })
  }, [items, descuentosItem, descuentoGlobal])

  const subtotalSinDescuento   = useMemo(() => +itemsConDescuento.reduce((s, i) => s + i.original, 0).toFixed(2), [itemsConDescuento])
  const total                  = useMemo(() => +itemsConDescuento.reduce((s, i) => s + i.subtotal, 0).toFixed(2), [itemsConDescuento])
  const descuentoTotalAplicado = useMemo(() => +(subtotalSinDescuento - total).toFixed(2), [subtotalSinDescuento, total])
  const totalItems             = useMemo(() => Object.values(items).reduce((s, i) => s + i.cantidad, 0), [items])

  const grupos = useMemo<GrupoVendedor[]>(() => {
    const map: Record<number, GrupoVendedor> = {}
    itemsConDescuento.forEach(item => {
      const v = item.producto.vendedor ?? ({ id: 0, nombre: 'Sin vendedor' } as Vendedor)
      if (!map[v.id]) map[v.id] = { vendedor: v, items: [], subtotal: 0 }
      map[v.id].items.push(item)
      map[v.id].subtotal = +(map[v.id].subtotal + item.subtotal).toFixed(2)
    })
    return Object.values(map)
  }, [itemsConDescuento])

  const procesarVenta = useCallback(async (clienteId?: number | null) => {
    if (!Object.keys(items).length) return { ok: false, error: 'Carrito vacío' }
    try {
      const { data: last } = await supabase.from('ventas')
        .select('numero_comprobante').eq('establecimiento_id', establecimientoId)
        .order('id', { ascending: false }).limit(1).maybeSingle()
      const lastData = last as { numero_comprobante: string } | null
      const siguiente = lastData ? parseInt(lastData.numero_comprobante.split('-')[2] ?? '0') + 1 : 1
      const comprobante = `001-001-${String(siguiente).padStart(7, '0')}`

      const { data: ventaData, error } = await supabase.rpc('registrar_venta', {
        establecimiento_id: establecimientoId,
        numero_comprobante: comprobante,
        total,
        metodo_pago: metodoPago,
        detalles: itemsConDescuento.map(i => ({
          producto_id:     i.producto.id,
          vendedor_id:     i.producto.vendedor_id,
          cantidad:        i.cantidad,
          precio_unitario: i.producto.precio_venta,
          descuento:       i.descuento,
        })),
        descuento_total: descuentoTotalAplicado,
        cliente_id: clienteId ?? null,
      } as never)

      if (error) throw error
      vaciar()

      const venta_id = typeof ventaData === 'number'
        ? ventaData
        : (ventaData as any)?.id ?? null

      const cambiosPrecio: { producto_id: number; precio_inicial: number; precio_final: number }[] =
        (ventaData as any)?.cambios_precio ?? []

      return { ok: true, comprobante, venta_id, cambiosPrecio }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Error al procesar' }
    }
  }, [items, itemsConDescuento, total, descuentoTotalAplicado, metodoPago, establecimientoId, vaciar])

  return {
    items, grupos, total, totalItems, metodoPago, setMetodoPago,
    agregar, cambiarCantidad, eliminar, vaciar, procesarVenta,
    descuentosItem, setDescuentoItem, descuentoGlobal, setDescuentoGlobal,
    subtotalSinDescuento, descuentoTotalAplicado,
  }
}