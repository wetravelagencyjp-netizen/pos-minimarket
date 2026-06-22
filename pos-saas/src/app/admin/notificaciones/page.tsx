'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useEstablecimiento } from '@/core/context/EstablecimientoContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Bell, Sun, Moon, CheckCircle, XCircle } from 'lucide-react'

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
  const { tema, cambiarTema } = useEstablecimiento()
  const router = useRouter()
  const estabId = Number(usuario?.establecimiento_id ?? 1)
  const esOscuro = tema === 'oscuro'

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [resolviendo, setResolviendo] = useState<number | null>(null)

  const t = {
    bg: esOscuro ? 'bg-zinc-950' : 'bg-slate-50',
    header: esOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-100',
    headerText: esOscuro ? 'text-zinc-100' : 'text-slate-900',
    headerSub: esOscuro ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-400 hover:text-slate-600',
    card: esOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-amber-200',
    cardTitle: esOscuro ? 'text-zinc-100' : 'text-slate-900',
    cardSub: esOscuro ? 'text-zinc-500' : 'text-slate-400',
    excedente: esOscuro ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50',
    excedenteText: esOscuro ? 'text-zinc-400' : 'text-slate-600',
    excedenteValor: esOscuro ? 'text-amber-400' : 'text-amber-700',
  }

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data: sols } = await supabase
      .from('solicitudes_autorizacion').select('*')
      .eq('establecimiento_id', estabId).eq('estado', 'pendiente')
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
    const canal = supabase.channel('solicitudes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_autorizacion', filter: `establecimiento_id=eq.${estabId}` }, () => cargar())
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [estabId, cargar])

  const resolver = async (id: number, estado: 'aprobada' | 'rechazada') => {
    setResolviendo(id)
    await supabase.from('solicitudes_autorizacion')
      .update({ estado, resuelto_por: usuario?.id, resuelto_en: new Date().toISOString() })
      .eq('id', id)
    setResolviendo(null)
  }

  if (usuario && usuario.rol !== 'admin') {
    return (
      <div className={`flex h-screen items-center justify-center ${t.bg}`}>
        <div className="text-center space-y-3 max-w-xs">
          <p className={`text-sm font-medium ${t.headerText}`}>Acceso restringido</p>
          <p className={`text-xs ${t.cardSub}`}>Esta sección es solo para administradores.</p>
          <button onClick={() => router.push('/pos')} className="mt-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
            Volver al POS
          </button>
        </div>
      </div>
    )
  }

  const fmt = (n: number) => `$${Number(n).toFixed(2)}`

  return (
    <div className={`min-h-screen ${t.bg}`}>
      <header className={`flex items-center justify-between border-b ${t.header} px-4 sm:px-6 py-4`}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin')} className={`flex items-center gap-1.5 text-xs ${t.headerSub} transition-colors`}>
            <ArrowLeft size={14} /> Volver
          </button>
          <div className={`h-4 w-px ${esOscuro ? 'bg-zinc-800' : 'bg-slate-200'}`} />
          <h1 className={`text-sm font-semibold ${t.headerText} flex items-center gap-2`}>
            <Bell size={14} className="text-amber-500" /> Autorizaciones Pendientes
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {solicitudes.length > 0 && (
            <span className="rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-1">
              {solicitudes.length}
            </span>
          )}
          <button onClick={() => cambiarTema(esOscuro ? 'claro' : 'oscuro')} className={`p-1.5 rounded-lg transition-colors ${esOscuro ? 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
            {esOscuro ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg p-4 sm:p-6 space-y-3">
        {loading ? (
          <div className={`text-center py-10 text-sm ${t.cardSub}`}>Cargando…</div>
        ) : solicitudes.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${esOscuro ? 'bg-zinc-800' : 'bg-emerald-50'}`}>
              <CheckCircle size={24} className="text-emerald-500" />
            </div>
            <p className={`text-sm ${t.cardSub}`}>Sin solicitudes pendientes</p>
          </div>
        ) : (
          solicitudes.map((s) => (
            <div key={s.id} className={`rounded-2xl border shadow-sm p-5 space-y-3 ${t.card}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className={`text-sm font-semibold ${t.cardTitle}`}>{s.nombre_cliente}</p>
                  <p className={`text-xs ${t.cardSub}`}>Cajero: {s.nombre_cajero}</p>
                </div>
                <span className={`text-[11px] ${t.cardSub}`}>
                  {new Date(s.creado_en).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className={`${t.excedente} rounded-xl p-3 flex justify-between text-sm`}>
                <span className={t.excedenteText}>Excedente solicitado</span>
                <span className={`font-bold ${t.excedenteValor}`}>{fmt(s.monto_excedente)}</span>
              </div>
              <p className={`text-xs ${t.cardSub}`}>Total de la venta: {fmt(s.total_venta)}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => resolver(s.id, 'rechazada')}
                  disabled={resolviendo === s.id}
                  className="flex-1 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-medium py-2.5 text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <XCircle size={14} /> Rechazar
                </button>
                <button
                  onClick={() => resolver(s.id, 'aprobada')}
                  disabled={resolviendo === s.id}
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle size={14} /> {resolviendo === s.id ? 'Procesando…' : 'Aprobar'}
                </button>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}