'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { type Producto, type Categoria, type Vendedor, type ItemCarrito, type GrupoVendedor, type MetodoPago } from '@/types'

export function useInventario(establecimientoId: number) {
  const [todos, setTodos]         = useState<Producto[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

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

export function useCarrito(establecimientoId: number) {
  const [items, setItems]       = useState<Record<number, ItemCarrito>>({})
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo')

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
  }, [])

  const vaciar = useCallback(() => setItems({}), [])

  const total = useMemo(() => +Object.values(items).reduce((s, i) => s + i.subtotal, 0).toFixed(2), [items])
  const totalItems = useMemo(() => Object.values(items).reduce((s, i) => s + i.cantidad, 0), [items])

  const grupos = useMemo<GrupoVendedor[]>(() => {
    const map: Record<number, GrupoVendedor> = {}
    Object.values(items).forEach(item => {
      const v = item.producto.vendedor; if (!v) return
      if (!map[v.id]) map[v.id] = { vendedor: v, items: [], subtotal: 0 }
      map[v.id].items.push(item)
      map[v.id].subtotal = +(map[v.id].subtotal + item.subtotal).toFixed(2)
    })
    return Object.values(map)
  }, [items])

  const procesarVenta = useCallback(async () => {
    if (!Object.keys(items).length) return { ok: false, error: 'Carrito vacío' }
    try {
      const { data: last } = await supabase.from('ventas')
        .select('numero_comprobante').eq('establecimiento_id', establecimientoId)
        .order('id', { ascending: false }).limit(1).maybeSingle()
      const lastData = last as { numero_comprobante: string } | null
      const siguiente = lastData ? parseInt(lastData.numero_comprobante.split('-')[2] ?? '0') + 1 : 1
      const comprobante = `001-001-${String(siguiente).padStart(7, '0')}`

      const { error } = await supabase.rpc('registrar_venta', {
        establecimiento_id: establecimientoId,
        numero_comprobante: comprobante,
        total,
        metodo_pago: metodoPago,
        detalles: Object.values(items).map(i => ({
          producto_id: i.producto.id,
          vendedor_id: i.producto.vendedor_id,
          cantidad: i.cantidad,
          precio_unitario: i.producto.precio_venta,
        })),
      } as never)
      if (error) throw error
      vaciar()
      return { ok: true, comprobante }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Error al procesar' }
    }
  }, [items, total, metodoPago, establecimientoId, vaciar])

  return { items, grupos, total, totalItems, metodoPago, setMetodoPago, agregar, cambiarCantidad, eliminar, vaciar, procesarVenta }
}
