'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

interface CierreCaja {
  id: number
  fecha_apertura: string
  fecha_cierre: string
  monto_inicial: number
  monto_final_sistema: number
  monto_final_fisico: number
  diferencia: number
  usuario_id: string
  nombre_cajero?: string
}

export default function CajasAdminPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const estabId = Number(usuario?.establecimiento_id ?? 1)

  const [cierres, setCierres] = useState<CierreCaja[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data: cajas } = await supabase
      .from('cajas')
      .select('id, fecha_apertura, fecha_cierre, monto_inicial, monto_final_sistema, monto_final_fisico, diferencia, usuario_id')
      .eq('establecimiento_id', estabId)
      .not('fecha_cierre', 'is', null)
      .order('fecha_cierre', { ascending: false })

    const userIds = Array.from(new Set((cajas ?? []).map((c) => c.usuario_id).filter(Boolean)))
    const { data: usuarios } = userIds.length
      ? await supabase.from('usuarios').select('id, nombre').in('id', userIds)
      : { data: [] }

    const mapaNombres = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]))
    const enriquecidos = (cajas ?? []).map((c) => ({
      ...c,
      nombre_cajero: mapaNombres.get(c.usuario_id) ?? '—',
    }))
    setCierres(enriquecidos)
    setLoading(false)
  }, [estabId])

  useEffect(() => { cargar() }, [cargar])

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
  const colorDiferencia = (d: number) => d < 0 ? 'text-rose-600' : d > 0 ? 'text-blue-600' : 'text-emerald-600'
  const bgDiferencia = (d: number) => d < 0 ? 'bg-rose-50' : d > 0 ? 'bg-blue-50' : 'bg-emerald-50'

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin')} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
            ← Volver al Admin
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <h1 className="text-sm font-semibold text-slate-900">📋 Historial de Cierres de Caja</h1>
        </div>
        <span className="text-xs text-slate-500">{usuario?.nombre ?? 'Admin'}</span>
      </header>

      <main className="mx-auto max-w-5xl p-6 space-y-4">
        {cierres.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/50">
              <p className="text-xs text-slate-400 mb-1">Total cierres</p>
              <p className="text-2xl font-bold text-slate-900">{cierres.length}</p>
            </div>
            <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/50">
              <p className="text-xs text-slate-400 mb-1">Diferencia acumulada</p>
              <p className={`text-2xl font-bold ${colorDiferencia(cierres.reduce((s, c) => s + Number(c.diferencia), 0))}`}>
                {fmt(cierres.reduce((s, c) => s + Number(c.diferencia), 0))}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/50">
              <p className="text-xs text-slate-400 mb-1">Cajas con descuadre</p>
              <p className="text-2xl font-bold text-slate-900">
                {cierres.filter((c) => Number(c.diferencia) !== 0).length}
                <span className="text-sm font-normal text-slate-400"> / {cierres.length}</span>
              </p>
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/50 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">Cargando…</div>
          ) : cierres.length === 0 ? (
            <div className="p-14 text-center">
              <p className="text-sm font-medium text-slate-600">Sin cierres de caja todavía</p>
              <p className="text-xs text-slate-400 mt-1">Aparecerán aquí cuando los cajeros cierren su turno.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-xs text-slate-400">
                <tr>
                  <th className="px-5 py-4 text-left font-medium">Fecha / Hora</th>
                  <th className="px-5 py-4 text-left font-medium">Cajero</th>
                  <th className="px-5 py-4 text-right font-medium">Apertura</th>
                  <th className="px-5 py-4 text-right font-medium">Esperado</th>
                  <th className="px-5 py-4 text-right font-medium">Declarado</th>
                  <th className="px-5 py-4 text-right font-medium">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {cierres.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 text-xs text-slate-600">
                      {new Date(c.fecha_cierre).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-900">{c.nombre_cajero}</td>
                    <td className="px-5 py-4 text-right text-slate-700">{fmt(c.monto_inicial)}</td>
                    <td className="px-5 py-4 text-right text-slate-700">{fmt(c.monto_final_sistema)}</td>
                    <td className="px-5 py-4 text-right text-slate-700">{fmt(c.monto_final_fisico)}</td>
                    <td className="px-5 py-4 text-right">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${bgDiferencia(c.diferencia)} ${colorDiferencia(c.diferencia)}`}>
                        {c.diferencia > 0 ? '+' : ''}{fmt(c.diferencia)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}