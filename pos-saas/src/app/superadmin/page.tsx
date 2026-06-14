'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const fmt = (n: number) => `$${n.toFixed(2)}`

export default function SuperAdminPage() {
  const { usuario, logout } = useAuth()
  const router = useRouter()
  const [establecimientos, setEstablecimientos] = useState<any[]>([])
  const [metricas, setMetricas] = useState({ totalTiendas: 0, tiendaActivas: 0, totalVentas: 0 })
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState<number | null>(null)

  // Verificar que es superadmin
  useEffect(() => {
    if (usuario && !(usuario as any).es_superadmin) {
      router.push('/pos')
    }
  }, [usuario, router])

  const cargar = useCallback(async () => {
    setLoading(true)
    const [estabs, ventas] = await Promise.all([
      supabase.from('establecimientos').select('*').order('id'),
      supabase.from('ventas').select('establecimiento_id, total'),
    ])

    const e = estabs.data ?? []
    const v = ventas.data ?? []

    const conVentas = e.map(est => ({
      ...est,
      totalVentas: v.filter(x => x.establecimiento_id === est.id).reduce((s, x) => s + x.total, 0),
      numVentas: v.filter(x => x.establecimiento_id === est.id).length,
    }))

    setEstablecimientos(conVentas)
    setMetricas({
      totalTiendas: e.length,
      tiendaActivas: e.filter(x => x.estado_cuenta === 'activo').length,
      totalVentas: v.reduce((s, x) => s + x.total, 0),
    })
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const cambiarEstado = async (id: number, estado: string) => {
    setGuardando(id)
    await supabase.from('establecimientos').update({ estado_cuenta: estado }).eq('id', id)
    setGuardando(null)
    cargar()
  }

  const cambiarPlan = async (id: number, plan: string) => {
    setGuardando(id)
    const limite = plan === 'pro' ? 500 : 50
    await supabase.from('establecimientos').update({ plan_actual: plan, limite_productos: limite }).eq('id', id)
    setGuardando(null)
    cargar()
  }

  const cambiarFecha = async (id: number, fecha: string) => {
    await supabase.from('establecimientos').update({ fecha_vencimiento: fecha }).eq('id', id)
    cargar()
  }

  return (
    <div className="flex h-screen flex-col bg-gray-900">
      <header className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-white">⚡ Super Admin</h1>
          <span className="rounded-full bg-yellow-500 px-2 py-0.5 text-[10px] font-bold text-gray-900">DUEÑO</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/pos')} className="rounded-lg border border-gray-600 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-gray-700">← POS</button>
          <span className="text-xs text-gray-400">{usuario?.nombre}</span>
          <button onClick={logout} className="rounded-lg border border-gray-600 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-gray-700">Salir</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Métricas del negocio SaaS */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total de tiendas', valor: String(metricas.totalTiendas), icono: '🏪' },
                { label: 'Tiendas activas', valor: String(metricas.tiendaActivas), icono: '✅' },
                { label: 'Ventas totales procesadas', valor: fmt(metricas.totalVentas), icono: '💰' },
              ].map(({ label, valor, icono }) => (
                <div key={label} className="rounded-2xl border border-gray-700 bg-gray-800 p-5">
                  <div className="text-2xl mb-2">{icono}</div>
                  <div className="text-2xl font-semibold text-white">{valor}</div>
                  <div className="text-xs text-gray-400 mt-1">{label}</div>
                </div>
              ))}
            </div>

            {/* Lista de establecimientos */}
            <div className="rounded-2xl border border-gray-700 bg-gray-800">
              <div className="border-b border-gray-700 px-5 py-3">
                <h2 className="text-sm font-semibold text-white">🏪 Tiendas registradas</h2>
              </div>
              <div className="divide-y divide-gray-700">
                {establecimientos.map(est => (
                  <div key={est.id} className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{est.nombre}</p>
                        <p className="text-xs text-gray-400">ID: {est.id} · {est.numVentas} ventas · {fmt(est.totalVentas)} total</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          est.estado_cuenta === 'activo' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
                        }`}>
                          {est.estado_cuenta === 'activo' ? '✅ Activo' : '🔴 Suspendido'}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          est.plan_actual === 'pro' ? 'bg-yellow-900 text-yellow-400' : 'bg-gray-700 text-gray-400'
                        }`}>
                          {est.plan_actual === 'pro' ? '⭐ Pro' : '📦 Básico'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {/* Estado */}
                      <div>
                        <p className="text-[10px] text-gray-500 mb-1">Estado cuenta</p>
                        <select value={est.estado_cuenta}
                          onChange={e => cambiarEstado(est.id, e.target.value)}
                          disabled={guardando === est.id}
                          className="w-full rounded-lg border border-gray-600 bg-gray-700 px-2 py-1.5 text-xs text-white outline-none">
                          <option value="activo">✅ Activo</option>
                          <option value="suspendido">🔴 Suspendido</option>
                        </select>
                      </div>

                      {/* Plan */}
                      <div>
                        <p className="text-[10px] text-gray-500 mb-1">Plan</p>
                        <select value={est.plan_actual}
                          onChange={e => cambiarPlan(est.id, e.target.value)}
                          disabled={guardando === est.id}
                          className="w-full rounded-lg border border-gray-600 bg-gray-700 px-2 py-1.5 text-xs text-white outline-none">
                          <option value="basico">📦 Básico (50 productos)</option>
                          <option value="pro">⭐ Pro (500 productos)</option>
                        </select>
                      </div>

                      {/* Fecha vencimiento */}
                      <div>
                        <p className="text-[10px] text-gray-500 mb-1">Vence el</p>
                        <input type="date" defaultValue={est.fecha_vencimiento}
                          onBlur={e => cambiarFecha(est.id, e.target.value)}
                          className="w-full rounded-lg border border-gray-600 bg-gray-700 px-2 py-1.5 text-xs text-white outline-none" />
                      </div>
                    </div>

                    {guardando === est.id && (
                      <p className="text-xs text-yellow-400">Guardando cambios…</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
