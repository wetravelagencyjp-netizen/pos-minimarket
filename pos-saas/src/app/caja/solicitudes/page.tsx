'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useEstablecimiento } from '@/core/context/EstablecimientoContext'
import { useRegistrarVenta } from '@/core/hooks/useRegistrarVenta'
import { supabase } from '@/lib/supabase'
import { imprimirRecibo } from '@/lib/imprimirRecibo'
import { ArrowLeft, Printer, Sun, Moon, Inbox } from 'lucide-react'

interface Solicitud {
  id: number
  monto_excedente: number
  total_venta: number
  estado: string
  creado_en: string
  cliente_id: number
  items_json: any
  nombre_cliente?: string
}

export default function SolicitudesPage() {
  const { usuario } = useAuth()
  const { tema, cambiarTema } = useEstablecimiento()
  const router = useRouter()
  const { registrarVenta, isProcesando } = useRegistrarVenta()
  const esOscuro = tema === 'oscuro'

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [completando, setCompletando] = useState<number | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [ultimaVenta, setUltimaVenta] = useState<{ numeroComprobante: string; datos: any } | null>(null)

  const t = {
    bg: esOscuro ? 'bg-zinc-950' : 'bg-slate-50',
    header: esOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-100',
    headerText: esOscuro ? 'text-zinc-100' : 'text-slate-900',
    headerSub: esOscuro ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-400 hover:text-slate-600',
    card: esOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200',
    cardTitle: esOscuro ? 'text-zinc-100' : 'text-slate-900',
    cardSub: esOscuro ? 'text-zinc-500' : 'text-slate-500',
    cardText: esOscuro ? 'text-zinc-400' : 'text-slate-600',
    btnSecondary: esOscuro ? 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  }

  const cargar = useCallback(async () => {
    if (!usuario) return
    setLoading(true)
    const { data: sols } = await supabase
      .from('solicitudes_autorizacion').select('*')
      .eq('cajero_id', usuario.id).in('estado', ['pendiente', 'aprobada'])
      .order('creado_en', { ascending: false })

    const clienteIds = Array.from(new Set((sols ?? []).map((s) => s.cliente_id)))
    const { data: clientes } = clienteIds.length
      ? await supabase.from('clientes').select('id, razon_social').in('id', clienteIds)
      : { data: [] }
    const mapaClientes = new Map((clientes ?? []).map((c) => [c.id, c.razon_social]))
    setSolicitudes((sols ?? []).map((s) => ({ ...s, nombre_cliente: mapaClientes.get(s.cliente_id) ?? '—' })))
    setLoading(false)
  }, [usuario])

  useEffect(() => {
    if (!usuario) return
    cargar()
    const canal = supabase.channel('mis-solicitudes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_autorizacion', filter: `cajero_id=eq.${usuario.id}` }, () => cargar())
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [usuario, cargar])

  const completarVenta = async (s: Solicitud) => {
    setCompletando(s.id)
    setMensaje(null)
    const datos = s.items_json
    if (!datos || !datos.items || !datos.pagos) {
      setMensaje('❌ Esta solicitud no tiene datos de venta guardados y no puede completarse.')
      setCompletando(null)
      return
    }
    const res = await registrarVenta({
      establecimientoId: Number(usuario?.establecimiento_id ?? 1),
      vendedorId: null, clienteId: datos.clienteId, cajaId: null, bancoId: null,
      items: datos.items, total: datos.total,
      metodoPago: datos.pagos.length > 1 ? ('mixto' as any) : datos.pagos[0].metodo,
      pagos: datos.pagos,
    })
    if (res.success) {
      try { await supabase.rpc('completar_solicitud_autorizacion', { p_solicitud_id: s.id }) } catch (_) {}
      setMensaje(`✅ Venta completada — comprobante ${res.numeroComprobante}`)
      setUltimaVenta({ numeroComprobante: res.numeroComprobante ?? '', datos: s })
      cargar()
    } else {
      setMensaje(`❌ ${res.error}`)
    }
    setCompletando(null)
  }

  function handleImprimir() {
    if (!ultimaVenta) return
    const datos = ultimaVenta.datos.items_json
    imprimirRecibo({
      nombreNegocio: 'Mi Negocio', ruc: null, direccion: null,
      numeroComprobante: ultimaVenta.numeroComprobante, claveAcceso: null,
      fecha: new Date().toLocaleString('es-EC'), cajero: null,
      items: (datos.items ?? []).map((it: any) => ({ nombre: it.nombre, cantidad: it.cantidad, precioUnitario: it.precioUnitario })),
      pagos: (datos.pagos ?? []).map((p: any) => ({ metodo: p.metodo, monto: parseFloat(p.monto) || 0 })),
      total: datos.total ?? 0, ancho: '80mm',
    })
  }

  const fmt = (n: number) => `$${Number(n).toFixed(2)}`

  return (
    <div className={`min-h-screen ${t.bg}`}>
      <header className={`flex items-center justify-between border-b ${t.header} px-4 sm:px-6 py-4`}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/caja')} className={`flex items-center gap-1.5 text-xs ${t.headerSub} transition-colors`}>
            <ArrowLeft size={14} /> Volver
          </button>
          <div className={`h-4 w-px ${esOscuro ? 'bg-zinc-800' : 'bg-slate-200'}`} />
          <h1 className={`text-sm font-semibold ${t.headerText} flex items-center gap-2`}>
            <Inbox size={14} className="text-indigo-500" /> Mis solicitudes
          </h1>
        </div>
        <button onClick={() => cambiarTema(esOscuro ? 'claro' : 'oscuro')} className={`p-1.5 rounded-lg transition-colors ${esOscuro ? 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
          {esOscuro ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </header>

      <main className="mx-auto max-w-lg p-4 sm:p-6 space-y-3">
        {mensaje && (
          <div className={`rounded-xl px-4 py-3 text-sm ${mensaje.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
            {mensaje}
          </div>
        )}
        {ultimaVenta && (
          <button onClick={handleImprimir} className={`w-full rounded-xl border px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${t.btnSecondary}`}>
            <Printer size={14} /> Imprimir recibo
          </button>
        )}

        {loading ? (
          <div className={`text-center py-10 text-sm ${t.cardSub}`}>Cargando…</div>
        ) : solicitudes.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${esOscuro ? 'bg-zinc-800' : 'bg-slate-100'}`}>
              <Inbox size={24} className={esOscuro ? 'text-zinc-600' : 'text-slate-400'} />
            </div>
            <p className={`text-sm ${t.cardSub}`}>No tienes solicitudes activas</p>
          </div>
        ) : (
          solicitudes.map((s) => (
            <div key={s.id} className={`rounded-2xl border shadow-sm p-5 space-y-3 ${esOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className={`text-sm font-semibold ${t.cardTitle}`}>{s.nombre_cliente}</p>
                  <p className={`text-xs ${t.cardSub}`}>{new Date(s.creado_en).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
                <span className={`text-[11px] font-medium rounded-full px-2.5 py-1 ${
                  s.estado === 'pendiente' ? 'bg-amber-50 text-amber-700' :
                  s.estado === 'aprobada' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                }`}>
                  {s.estado === 'pendiente' ? '⏳ Pendiente' : s.estado === 'aprobada' ? '✅ Aprobada' : '❌ Rechazada'}
                </span>
              </div>
              <p className={`text-sm ${t.cardText}`}>Total venta: <span className={`font-medium ${t.cardTitle}`}>{fmt(s.total_venta)}</span></p>
              {s.estado === 'aprobada' && (
                <button onClick={() => completarVenta(s)} disabled={completando === s.id || isProcesando}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm transition-colors">
                  {completando === s.id ? 'Completando…' : 'Completar venta'}
                </button>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  )
}