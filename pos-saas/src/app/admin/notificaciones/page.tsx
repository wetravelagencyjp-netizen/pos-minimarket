'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Solicitud {
  id: number
  monto_excedente: number
  total_venta: number
  estado: string
  creado_en: string
  cajero_id: string
  cliente_id: number
  nombre_cajero?: string
  nombre_cliente?: string
}

export default function NotificacionesPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const estabId = Number(usuario?.establecimiento_id ?? 1)

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [resolviendo, setResolviendo] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data: sols } = await supabase
      .from('solicitudes_autorizacion')
      .select('*')
      .eq('establecimiento_id', estabId)
      .eq('estado', 'pendiente')
      .order('creado_en', { ascending: false })

    const cajeroIds = Array.from(new Set((sols ?? []).map((s) => s.cajero_id)))
    const clienteIds = Array.from(new Set((sols ?? []).map((s) => s.cliente_id)))

    const [{ data: cajeros }, { data: clientes }] = await Promise.all([
      cajeroIds.length ? supabase.from('usuarios').select('id, nombre').in('id', cajeroIds) : Promise.resolve({ data: [] }),
      clienteIds.length ? supabase.from('clientes').select('id, razon_social').in('id', clienteIds) : Promise.resolve({ data: [] }),
    ])

    const mapaCajeros = new Map((cajeros ?? []).map((c) => [c.id, c.nombre]))
    const mapaClientes = new Map((clientes ?? []).map((c) => [c.id, c.razon_social]))

    setSolicitudes((sols ?? []).map((s) => ({
      ...s,
      nombre_cajero: mapaCajeros.get(s.cajero_id) ?? '—',
      nombre_cliente: mapaClientes.get(s.cliente_id) ?? '—',
    })))
    setLoading(false)
  }, [estabId])

  useEffect(() => {
    cargar()

    const canal = supabase
      .channel('solicitudes-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'solicitudes_autorizacion',
        filter: `establecimiento_id=eq.${estabId}`,
      }, () => cargar())
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [estabId, cargar])

  const resolver = async (id: number, estado: 'aprobada' | 'rechazada') => {
    setResolviendo(id)
    await supabase
      .from('solicitudes_autorizacion')
      .update({ estado, resuelto_por: usuario?.id, resuelto_en: new Date().toISOString() })
      .eq('id', id)
    setResolviendo(null)
  }

  if (usuario && usuario.rol !== 'admin') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-3 max-w-xs">
          <p className="text-sm font-medium text-slate-700">Acceso restringido</p>
          <p className="text-xs text-slate-400">Esta sección es solo para administradores.</p>
          <button onClick={() => router.push('/pos')}
            className="mt-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
            Volver al POS
          </button>
        </div>
      </div>
    )
  }

  const fmt = (n: number) => `$${Number(n).toFixed(2)}`

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-100 bg-white px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin')} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
            ← Volver
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <h1 className="text-sm font-semibold text-slate-900">🔔 Autorizaciones Pendientes</h1>
        </div>
        {solicitudes.length > 0 && (
          <span className="rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-1">
            {solicitudes.length}
          </span>
        )}
      </header>

      <main className="mx-auto max-w-lg p-4 sm:p-6 space-y-3">
        {loading ? (
          <div className="text-center py-10 text-sm text-slate-400">Cargando…</div>
        ) : solicitudes.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <p className="text-3xl">✅</p>
            <p className="text-sm text-slate-500">Sin solicitudes pendientes</p>
          </div>
        ) : (
          solicitudes.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{s.nombre_cliente}</p>
                  <p className="text-xs text-slate-400">Cajero: {s.nombre_cajero}</p>
                </div>
                <span className="text-[11px] text-slate-400">
                  {new Date(s.creado_en).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 flex justify-between text-sm">
                <span className="text-slate-600">Excedente solicitado</span>
                <span className="font-bold text-amber-700">{fmt(s.monto_excedente)}</span>
              </div>
              <p className="text-xs text-slate-400">Total de la venta: {fmt(s.total_venta)}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => resolver(s.id, 'rechazada')}
                  disabled={resolviendo === s.id}
                  className="flex-1 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-medium py-2.5 text-sm transition-colors disabled:opacity-50"
                >
                  Rechazar
                </button>
                <button
                  onClick={() => resolver(s.id, 'aprobada')}
                  disabled={resolviendo === s.id}
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 text-sm transition-colors disabled:opacity-50"
                >
                  {resolviendo === s.id ? 'Procesando…' : 'Aprobar'}
                </button>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}