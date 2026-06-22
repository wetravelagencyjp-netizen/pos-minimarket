'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useRegistrarVenta } from '@/core/hooks/useRegistrarVenta'
import { supabase } from '@/lib/supabase'
import { imprimirRecibo } from '@/lib/imprimirRecibo'

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
  const router = useRouter()
  const { registrarVenta, isProcesando } = useRegistrarVenta()

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [completando, setCompletando] = useState<number | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [ultimaVenta, setUltimaVenta] = useState<{ numeroComprobante: string; datos: any } | null>(null)

  const cargar = useCallback(async () => {
    if (!usuario) return
    setLoading(true)
    const { data: sols } = await supabase
      .from('solicitudes_autorizacion')
      .select('*')
      .eq('cajero_id', usuario.id)
      .in('estado', ['pendiente', 'aprobada'])
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
    const canal = supabase
      .channel('mis-solicitudes')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'solicitudes_autorizacion',
        filter: `cajero_id=eq.${usuario.id}`,
      }, () => cargar())
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
    const { data: { user } } = await supabase.auth.getUser()

    const res = await registrarVenta({
      establecimientoId: Number(usuario?.establecimiento_id ?? 1),
      vendedorId: null,
      clienteId: datos.clienteId,
      cajaId: null,
      bancoId: null,
      items: datos.items,
      total: datos.total,
      metodoPago: datos.pagos.length > 1 ? ('mixto' as any) : datos.pagos[0].metodo,
      pagos: datos.pagos,
    })

    if (res.success) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await supabase.rpc('completar_solicitud_autorizacion', { p_solicitud_id: s.id })
      }
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
      nombreNegocio: 'Mi Negocio',
      ruc: null,
      direccion: null,
      numeroComprobante: ultimaVenta.numeroComprobante,
      claveAcceso: null,
      fecha: new Date().toLocaleString('es-EC'),
      cajero: null,
      items: (datos.items ?? []).map((it: any) => ({
        nombre: it.nombre,
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario,
      })),
      pagos: (datos.pagos ?? []).map((p: any) => ({
        metodo: p.metodo,
        monto: parseFloat(p.monto) || 0,
      })),
      total: datos.total ?? 0,
      ancho: '80mm',
    })
  }

  const fmt = (n: number) => `$${Number(n).toFixed(2)}`

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-100 bg-white px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/caja')} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
            ← Volver
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <h1 className="text-sm font-semibold text-slate-900">📲 Mis solicitudes</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg p-4 sm:p-6 space-y-3">
        {mensaje && (
          <div className={`rounded-xl px-4 py-3 text-sm ${mensaje.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
            {mensaje}
          </div>
        )}
        {ultimaVenta && (
          <button
            onClick={handleImprimir}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            🖨️ Imprimir recibo
          </button>
        )}

        {loading ? (
          <div className="text-center py-10 text-sm text-slate-400">Cargando…</div>
        ) : solicitudes.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <p className="text-3xl">📭</p>
            <p className="text-sm text-slate-500">No tienes solicitudes activas</p>
          </div>
        ) : (
          solicitudes.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{s.nombre_cliente}</p>
                  <p className="text-xs text-slate-400">{new Date(s.creado_en).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
                <span className={`text-[11px] font-medium rounded-full px-2.5 py-1 ${
                  s.estado === 'pendiente' ? 'bg-amber-50 text-amber-700' :
                  s.estado === 'aprobada' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                }`}>
                  {s.estado === 'pendiente' ? '⏳ Pendiente' : s.estado === 'aprobada' ? '✅ Aprobada' : '❌ Rechazada'}
                </span>
              </div>
              <p className="text-sm text-slate-600">Total venta: <span className="font-medium text-slate-900">{fmt(s.total_venta)}</span></p>

              {s.estado === 'aprobada' && (
                <button
                  onClick={() => completarVenta(s)}
                  disabled={completando === s.id || isProcesando}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
                >
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