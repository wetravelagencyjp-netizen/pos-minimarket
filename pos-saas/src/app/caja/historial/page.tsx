'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useEstablecimiento } from '@/core/context/EstablecimientoContext'
import { supabase } from '@/lib/supabase'
import { imprimirRecibo } from '@/lib/imprimirRecibo'
import { Printer, CheckCircle, Clock, Sun, Moon, FileText } from 'lucide-react'

interface Venta {
  id: number
  numero_comprobante: string
  total: number
  metodo_pago: string
  fecha_venta: string
  sri_comprobante_id: number | null
  detalle_ventas: {
    cantidad: number
    precio_unitario: number
    productos: { nombre: string }
  }[]
}

export default function HistorialPage() {
  const { usuario: usuarioAuth } = useAuth()
  const { establecimiento, tema, cambiarTema } = useEstablecimiento()
  const esOscuro = tema === 'oscuro'
  const [ventas, setVentas] = useState<Venta[]>([])
  const [cargando, setCargando] = useState(true)

  const t = {
    bg: esOscuro ? 'bg-zinc-950' : 'bg-slate-50',
    header: esOscuro ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white/80 border-slate-200',
    headerText: esOscuro ? 'text-zinc-100' : 'text-slate-900',
    card: esOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200',
    title: esOscuro ? 'text-zinc-100' : 'text-slate-900',
    sub: esOscuro ? 'text-zinc-500' : 'text-slate-500',
    divider: esOscuro ? 'border-zinc-800' : 'border-slate-100',
    metodo: esOscuro ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-100 text-slate-600',
  }

  const cargar = useCallback(async () => {
    if (!establecimiento) return
    setCargando(true)
    const ahora = new Date()
    const fechaHoy = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}-${String(ahora.getDate()).padStart(2,'0')}`

    const { data, error } = await supabase
      .from('ventas')
      .select('id, numero_comprobante, total, metodo_pago, fecha_venta, sri_comprobante_id, detalle_ventas(cantidad, precio_unitario, productos(nombre))')
      .eq('establecimiento_id', establecimiento.id)
      .gte('fecha_venta', fechaHoy)
      .order('fecha_venta', { ascending: false })

    if (error) console.error('Error historial:', error)
    setVentas((data ?? []) as any)
    setCargando(false)
  }, [establecimiento])

  useEffect(() => {
    if (establecimiento) cargar()
  }, [cargar, establecimiento])

  const handleImprimir = (v: Venta) => {
    imprimirRecibo({
      nombreNegocio: establecimiento?.nombre ?? 'Mi Negocio',
      ruc: establecimiento?.ruc_nit ?? null,
      direccion: establecimiento?.direccion ?? null,
      numeroComprobante: v.numero_comprobante,
      claveAcceso: null,
      fecha: new Date(v.fecha_venta).toLocaleString('es-EC'),
      cajero: usuarioAuth?.nombre ?? null,
      items: v.detalle_ventas.map(d => ({
        nombre: (d.productos as any)?.nombre ?? '—',
        cantidad: d.cantidad,
        precioUnitario: d.precio_unitario,
      })),
      pagos: [{ metodo: v.metodo_pago, monto: v.total }],
      total: v.total,
      ancho: (establecimiento?.ancho_recibo as '80mm' | '58mm') ?? '80mm',
    })
  }

  const fmt = (n: number) => `$${Number(n).toFixed(2)}`
  const totalDia = ventas.reduce((s, v) => s + Number(v.total), 0)

  return (
    <div className={`min-h-screen ${t.bg}`}>
      <header className={`sticky top-0 z-30 backdrop-blur-md border-b ${t.header} px-4 py-4`}>
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <h1 className={`text-sm font-semibold ${t.headerText}`}>Historial del día</h1>
            <p className={`text-xs ${t.sub} mt-0.5`}>{ventas.length} ventas · {fmt(totalDia)}</p>
          </div>
          <button onClick={() => cambiarTema(esOscuro ? 'claro' : 'oscuro')}
            className={`p-1.5 rounded-xl transition-colors ${esOscuro ? 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
            {esOscuro ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-3">
        {cargando ? (
          <div className={`text-center py-16 text-sm ${t.sub}`}>Cargando…</div>
        ) : ventas.length === 0 ? (
          <div className={`rounded-3xl border ${t.card} p-12 text-center space-y-3`}>
            <FileText size={32} className={`mx-auto ${t.sub}`} />
            <p className={`text-sm ${t.sub}`}>Sin ventas hoy</p>
          </div>
        ) : (
          ventas.map(v => (
            <div key={v.id} className={`rounded-2xl border ${t.card} p-4 space-y-3`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-sm font-semibold ${t.title}`}>{v.numero_comprobante}</p>
                  <p className={`text-xs ${t.sub} mt-0.5`}>
                    {new Date(v.fecha_venta).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-indigo-500">{fmt(Number(v.total))}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${t.metodo}`}>{v.metodo_pago}</span>
                </div>
              </div>

              <div className={`space-y-1 border-t ${t.divider} pt-2`}>
                {v.detalle_ventas.slice(0, 3).map((d, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className={`${t.sub} truncate max-w-[200px]`}>{(d.productos as any)?.nombre}</span>
                    <span className={t.sub}>{d.cantidad} × {fmt(d.precio_unitario)}</span>
                  </div>
                ))}
                {v.detalle_ventas.length > 3 && (
                  <p className={`text-xs ${t.sub}`}>+{v.detalle_ventas.length - 3} más</p>
                )}
              </div>

              <div className={`flex items-center justify-between border-t ${t.divider} pt-2`}>
                <div className="flex items-center gap-1.5">
                  {v.sri_comprobante_id ? (
                    <>
                      <CheckCircle size={12} className="text-emerald-500" />
                      <span className="text-xs text-emerald-500">Facturada</span>
                    </>
                  ) : (
                    <>
                      <Clock size={12} className={t.sub} />
                      <span className={`text-xs ${t.sub}`}>Sin factura</span>
                    </>
                  )}
                </div>
                <button onClick={() => handleImprimir(v)}
                  className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-400 font-medium transition-colors">
                  <Printer size={13} /> Reimprimir
                </button>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}