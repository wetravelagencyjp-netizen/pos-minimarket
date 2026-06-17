'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const fmt = (n: number) => `$${n.toFixed(2)}`

const Icon = {
  ArrowLeft: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  ),
  Sliders: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h14"/>
      <circle cx="16" cy="6" r="1.8"/><circle cx="8" cy="12" r="1.8"/><circle cx="18" cy="18" r="1.8"/>
    </svg>
  ),
  Document: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/>
      <path d="M14 3v4h4"/><path d="M9 12.5h6M9 15.5h6M9 9.5h3"/>
    </svg>
  ),
  Users: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
      <circle cx="17" cy="9" r="2.3"/><path d="M15 14.3c2.7.4 4.8 2.6 4.8 5.4"/>
    </svg>
  ),
  Check: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Alert: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4M12 16.5h.01"/>
      <path d="M10.3 3.9L2.5 17.5a1.5 1.5 0 001.3 2.3h16.4a1.5 1.5 0 001.3-2.3L13.7 3.9a1.5 1.5 0 00-2.6 0z"/>
    </svg>
  ),
  TrendingUp: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>
    </svg>
  ),
  BarChart: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="12" width="3.5" height="8" rx="1"/>
      <rect x="10.25" y="5" width="3.5" height="15" rx="1"/>
      <rect x="16.5" y="9" width="3.5" height="11" rx="1"/>
    </svg>
  ),
  CreditCard: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5"/>
      <path d="M2.5 9.5h19"/><path d="M6 14.5h4"/>
    </svg>
  ),
  Sparkle: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.5l2 6.5 6.5 2-6.5 2-2 6.5-2-6.5L3.5 11l6.5-2z"/>
    </svg>
  ),
}

export default function DashboardPage() {
  const { usuario, logout, loading: authLoading } = useAuth()
  const router = useRouter()
  const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes'>('hoy')
  const [metricas, setMetricas] = useState({ totalVentas: 0, numVentas: 0, ticketPromedio: 0 })
  const [ventasPorMetodo, setVentasPorMetodo] = useState<any[]>([])
  const [ventasPorVendedor, setVentasPorVendedor] = useState<any[]>([])
  const [productosMasVendidos, setProductosMasVendidos] = useState<any[]>([])
  const [stockBajo, setStockBajo] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const estabId = usuario?.establecimiento_id ?? 1

  useEffect(() => {
    if (!authLoading && !usuario) {
      router.push('/login')
    }
  }, [authLoading, usuario, router])

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
      supabase.from('detalle_ventas')
        .select('*, producto:productos(nombre), vendedor:vendedores(nombre), venta:ventas!inner(fecha_venta, establecimiento_id)')
        .eq('venta.establecimiento_id', estabId)
        .gte('venta.fecha_venta', fechaInicio),
      supabase.from('productos').select('nombre, stock_actual').eq('establecimiento_id', estabId).lt('stock_actual', 5).order('stock_actual'),
    ])

    const v = ventas.data ?? []
    const totalVentas = v.reduce((s, x) => s + x.total, 0)
    const numVentas = v.length
    setMetricas({ totalVentas, numVentas, ticketPromedio: numVentas ? totalVentas / numVentas : 0 })

    const porMetodo: Record<string, number> = {}
    v.forEach(x => { porMetodo[x.metodo_pago] = (porMetodo[x.metodo_pago] ?? 0) + x.total })
    setVentasPorMetodo(Object.entries(porMetodo).map(([metodo, total]) => ({ metodo, total })))

    const porVendedor: Record<string, { nombre: string; total: number; cantidad: number }> = {}
    ;(detalle.data ?? []).forEach(d => {
      const nombre = d.vendedor?.nombre ?? 'Sin vendedor'
      if (!porVendedor[nombre]) porVendedor[nombre] = { nombre, total: 0, cantidad: 0 }
      porVendedor[nombre].total += d.precio_unitario * d.cantidad
      porVendedor[nombre].cantidad += d.cantidad
    })
    setVentasPorVendedor(Object.values(porVendedor).sort((a, b) => b.total - a.total))

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

  useEffect(() => {
    if (usuario) cargar()
  }, [cargar, usuario])

  const metodoLabel: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', mixto: 'Mixto' }
  const metodoColor: Record<string, string> = { efectivo: 'bg-emerald-400', tarjeta: 'bg-indigo-400', transferencia: 'bg-sky-400', mixto: 'bg-violet-400' }

  if (authLoading || !usuario) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/pos')} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
            <Icon.ArrowLeft className="h-3.5 w-3.5" /> Volver al POS
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <h1 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Icon.BarChart className="h-4 w-4 text-indigo-500" /> Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin')} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
            <Icon.Sliders className="h-3.5 w-3.5" /> Admin
          </button>
          <span className="text-xs text-slate-500">{usuario?.nombre ?? 'Admin'}</span>
          <button onClick={logout} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors">Salir</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex gap-2">
          {[{ id: 'hoy', label: 'Hoy' }, { id: 'semana', label: 'Últimos 7 días' }, { id: 'mes', label: 'Últimos 30 días' }].map(({ id, label }) => (
            <button key={id} onClick={() => setPeriodo(id as any)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors
                ${periodo === id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total vendido', valor: fmt(metricas.totalVentas), icono: Icon.TrendingUp, chip: 'bg-indigo-50 text-indigo-600' },
                { label: 'Número de ventas', valor: String(metricas.numVentas), icono: Icon.Document, chip: 'bg-sky-50 text-sky-600' },
                { label: 'Ticket promedio', valor: fmt(metricas.ticketPromedio), icono: Icon.BarChart, chip: 'bg-violet-50 text-violet-600' },
              ].map(({ label, valor, icono: ItemIcon, chip }) => (
                <div key={label} className="rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${chip} mb-4`}>
                    <ItemIcon className="h-5 w-5" />
                  </div>
                  <div className="text-2xl font-semibold text-slate-800">{valor}</div>
                  <div className="text-sm text-slate-500 mt-1">{label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
                <h2 className="flex items-center gap-2 mb-4 text-sm font-semibold text-slate-800">
                  <Icon.Users className="h-4 w-4 text-indigo-500" /> Ventas por vendedor
                </h2>
                {ventasPorVendedor.length === 0 ? <p className="text-sm text-slate-400">Sin datos</p> : (
                  <div className="space-y-4">
                    {ventasPorVendedor.map(v => (
                      <div key={v.nombre}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-slate-700">{v.nombre}</span>
                          <span className="font-medium text-slate-800">{fmt(v.total)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100">
                          <div className="h-1.5 rounded-full bg-indigo-500 transition-all duration-300"
                            style={{ width: `${(v.total / (ventasPorVendedor[0]?.total || 1)) * 100}%` }} />
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">{v.cantidad} unidades</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
                <h2 className="flex items-center gap-2 mb-4 text-sm font-semibold text-slate-800">
                  <Icon.CreditCard className="h-4 w-4 text-indigo-500" /> Métodos de pago
                </h2>
                {ventasPorMetodo.length === 0 ? <p className="text-sm text-slate-400">Sin datos</p> : (
                  <div className="space-y-3">
                    {ventasPorMetodo.map(m => (
                      <div key={m.metodo} className="flex justify-between items-center">
                        <span className="flex items-center gap-2 text-sm text-slate-700">
                          <span className={`h-2 w-2 rounded-full ${metodoColor[m.metodo] ?? 'bg-slate-400'}`} />
                          {metodoLabel[m.metodo] ?? m.metodo}
                        </span>
                        <span className="text-sm font-medium text-slate-800">{fmt(m.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
                <h2 className="flex items-center gap-2 mb-4 text-sm font-semibold text-slate-800">
                  <Icon.Sparkle className="h-4 w-4 text-indigo-500" /> Productos más vendidos
                </h2>
                {productosMasVendidos.length === 0 ? <p className="text-sm text-slate-400">Sin datos</p> : (
                  <div className="space-y-2.5">
                    {productosMasVendidos.map((p, i) => (
                      <div key={p.nombre} className="flex items-center gap-3">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">{i + 1}</span>
                        <span className="flex-1 text-sm text-slate-700 truncate">{p.nombre}</span>
                        <span className="text-xs font-medium text-slate-500">{p.cantidad} uds</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
                <h2 className="flex items-center gap-2 mb-4 text-sm font-semibold text-slate-800">
                  <Icon.Alert className="h-4 w-4 text-amber-500" /> Stock bajo (menos de 5 unidades)
                </h2>
                {stockBajo.length === 0 ? (
                  <p className="flex items-center gap-1.5 text-sm text-emerald-600"><Icon.Check className="h-4 w-4" /> Todo el stock está bien</p>
                ) : (
                  <div className="space-y-2.5">
                    {stockBajo.map(p => (
                      <div key={p.nombre} className="flex justify-between items-center">
                        <span className="text-sm text-slate-700 truncate">{p.nombre}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${p.stock_actual === 0 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
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