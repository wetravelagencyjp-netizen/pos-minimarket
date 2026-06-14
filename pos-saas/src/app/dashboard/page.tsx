'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const fmt = (n: number) => `$${n.toFixed(2)}`

export default function DashboardPage() {
  const { usuario, logout } = useAuth()
  const router = useRouter()
  const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes'>('hoy')
  const [metricas, setMetricas] = useState({ totalVentas: 0, numVentas: 0, ticketPromedio: 0 })
  const [ventasPorMetodo, setVentasPorMetodo] = useState<any[]>([])
  const [ventasPorVendedor, setVentasPorVendedor] = useState<any[]>([])
  const [productosMasVendidos, setProductosMasVendidos] = useState<any[]>([])
  const [stockBajo, setStockBajo] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const estabId = usuario?.establecimiento_id ?? 1

  const getFechaInicio = useCallback(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    if (periodo === 'hoy') return hoy.toISOString()
    if (periodo === 'semana') { hoy.setDate(hoy.getDate() - 7); return hoy.toISOString() }
    hoy.setDate(hoy.getDate() - 30); return hoy.toISOString()
  }, [periodo])

  const cargar = useCallback(async () => {
    setLoading(true)
    const fechaInicio = getFechaInicio()

    const [ventas, detalle, productos] = await Promise.all([
      supabase.from('ventas').select('*').eq('establecimiento_id', estabId).gte('fecha_venta', fechaInicio),
      supabase.from('detalle_ventas').select('*, producto:productos(nombre), vendedor:vendedores(nombre)').gte('created_at', fechaInicio),
      supabase.from('productos').select('nombre, stock_actual, stock_minimo').eq('establecimiento_id', estabId).lt('stock_actual', 5).order('stock_actual'),
    ])

    const v = ventas.data ?? []
    const totalVentas = v.reduce((s, x) => s + x.total, 0)
    const numVentas = v.length
    setMetricas({ totalVentas, numVentas, ticketPromedio: numVentas ? totalVentas / numVentas : 0 })

    // Ventas por método de pago
    const porMetodo: Record<string, number> = {}
    v.forEach(x => { porMetodo[x.metodo_pago] = (porMetodo[x.metodo_pago] ?? 0) + x.total })
    setVentasPorMetodo(Object.entries(porMetodo).map(([metodo, total]) => ({ metodo, total })))

    // Ventas por vendedor
    const porVendedor: Record<string, { nombre: string; total: number; cantidad: number }> = {}
    ;(detalle.data ?? []).forEach(d => {
      const nombre = d.vendedor?.nombre ?? 'Sin vendedor'
      if (!porVendedor[nombre]) porVendedor[nombre] = { nombre, total: 0, cantidad: 0 }
      porVendedor[nombre].total += d.precio_unitario * d.cantidad
      porVendedor[nombre].cantidad += d.cantidad
    })
    setVentasPorVendedor(Object.values(porVendedor).sort((a, b) => b.total - a.total))

    // Productos más vendidos
    const porProducto: Record<string, { nombre: string; cantidad: number }> = {}
    ;(detalle.data ?? []).forEach(d => {
      const nombre = d.producto?.nombre ?? 'Desconocido'
      if (!porProducto[nombre]) porProducto[nombre] = { nombre, cantidad: 0 }
      porProducto[nombre].cantidad += d.cantidad
    })
    setProductosMasVendidos(Object.values(porProducto).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10))

    setStockBajo(productos.data ?? [])
    setLoading(false)
  }, [estabId, getFechaInicio])

  useEffect(() => { cargar() }, [cargar])

  const metodoLabel: Record<string, string> = { efectivo: '💵 Efectivo', tarjeta: '💳 Tarjeta', transferencia: '🏦 Transferencia', mixto: '🔀 Mixto' }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/pos')} className="text-xs text-gray-400 hover:text-gray-600">← Volver al POS</button>
          <h1 className="text-sm font-semibold text-gray-900">📊 Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin')} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50">⚙️ Admin</button>
          <span className="text-xs text-gray-500">{usuario?.nombre ?? 'Admin'}</span>
          <button onClick={logout} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700">Salir</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Selector de período */}
        <div className="flex gap-2">
          {[{ id: 'hoy', label: 'Hoy' }, { id: 'semana', label: 'Últimos 7 días' }, { id: 'mes', label: 'Últimos 30 días' }].map(({ id, label }) => (
            <button key={id} onClick={() => setPeriodo(id as any)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors
                ${periodo === id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Métricas principales */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total vendido', valor: fmt(metricas.totalVentas), icono: '💰' },
                { label: 'Número de ventas', valor: String(metricas.numVentas), icono: '🧾' },
                { label: 'Ticket promedio', valor: fmt(metricas.ticketPromedio), icono: '📊' },
              ].map(({ label, valor, icono }) => (
                <div key={label} className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="text-2xl mb-2">{icono}</div>
                  <div className="text-2xl font-semibold text-gray-900">{valor}</div>
                  <div className="text-xs text-gray-400 mt-1">{label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Ventas por vendedor */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">👤 Ventas por vendedor</h2>
                {ventasPorVendedor.length === 0 ? <p className="text-sm text-gray-400">Sin datos</p> : (
                  <div className="space-y-3">
                    {ventasPorVendedor.map(v => (
                      <div key={v.nombre}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700">{v.nombre}</span>
                          <span className="font-medium">{fmt(v.total)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100">
                          <div className="h-1.5 rounded-full bg-blue-500"
                            style={{ width: `${(v.total / (ventasPorVendedor[0]?.total || 1)) * 100}%` }} />
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{v.cantidad} unidades</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Métodos de pago */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">💳 Métodos de pago</h2>
                {ventasPorMetodo.length === 0 ? <p className="text-sm text-gray-400">Sin datos</p> : (
                  <div className="space-y-3">
                    {ventasPorMetodo.map(m => (
                      <div key={m.metodo} className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">{metodoLabel[m.metodo] ?? m.metodo}</span>
                        <span className="text-sm font-medium">{fmt(m.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Productos más vendidos */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">🏆 Productos más vendidos</h2>
                {productosMasVendidos.length === 0 ? <p className="text-sm text-gray-400">Sin datos</p> : (
                  <div className="space-y-2">
                    {productosMasVendidos.map((p, i) => (
                      <div key={p.nombre} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                        <span className="flex-1 text-sm text-gray-700 truncate">{p.nombre}</span>
                        <span className="text-xs font-medium text-gray-500">{p.cantidad} uds</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Stock bajo */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">⚠️ Stock bajo (menos de 5 unidades)</h2>
                {stockBajo.length === 0 ? <p className="text-sm text-green-500">✓ Todo el stock está bien</p> : (
                  <div className="space-y-2">
                    {stockBajo.map(p => (
                      <div key={p.nombre} className="flex justify-between items-center">
                        <span className="text-sm text-gray-700 truncate">{p.nombre}</span>
                        <span className={`text-xs font-bold ${p.stock_actual === 0 ? 'text-red-500' : 'text-amber-500'}`}>
                          {p.stock_actual === 0 ? 'Agotado' : `${p.stock_actual} uds`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
