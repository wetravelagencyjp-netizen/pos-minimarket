'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const fmt = (n: number) => `$${n.toFixed(2)}`

export default function CajaPage() {
  const { usuario, logout } = useAuth()
  const router = useRouter()
  const [cajaActual, setCajaActual] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [montoInicial, setMontoInicial] = useState('')
  const [montoFisico, setMontoFisico] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [ventasDelTurno, setVentasDelTurno] = useState<any[]>([])
  const [totalSistema, setTotalSistema] = useState(0)
  const estabId = usuario?.establecimiento_id ?? 1

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('cajas')
      .select('*')
      .eq('establecimiento_id', estabId)
      .eq('estado', 'abierta')
      .order('fecha_apertura', { ascending: false })
      .limit(1)
      .maybeSingle()
    setCajaActual(data)

    if (data) {
      const { data: ventas } = await supabase
        .from('ventas')
        .select('*')
        .eq('establecimiento_id', estabId)
        .gte('fecha_venta', data.fecha_apertura)
      const v = ventas ?? []
      setVentasDelTurno(v)
      setTotalSistema(v.reduce((s, x) => s + x.total, 0))
    }
    setLoading(false)
  }, [estabId])

  useEffect(() => { cargar() }, [cargar])

  const abrirCaja = async () => {
    if (!montoInicial) return
    setGuardando(true)
    await supabase.from('cajas').insert({
      establecimiento_id: estabId,
      usuario_id: usuario?.id,
      monto_inicial: parseFloat(montoInicial),
      estado: 'abierta',
    })
    setMontoInicial('')
    setGuardando(false)
    cargar()
  }

  const cerrarCaja = async () => {
    if (!montoFisico) return
    if (!confirm('¿Confirmas el cierre de caja?')) return
    setGuardando(true)
    const fisico = parseFloat(montoFisico)
    const diferencia = fisico - (cajaActual.monto_inicial + totalSistema)
    await supabase.from('cajas').update({
      fecha_cierre: new Date().toISOString(),
      monto_final_sistema: cajaActual.monto_inicial + totalSistema,
      monto_final_fisico: fisico,
      diferencia,
      estado: 'cerrada',
      notas,
    }).eq('id', cajaActual.id)
    setMontoFisico('')
    setNotas('')
    setGuardando(false)
    cargar()
  }

  const porMetodo = ventasDelTurno.reduce((acc, v) => {
    acc[v.metodo_pago] = (acc[v.metodo_pago] ?? 0) + v.total
    return acc
  }, {} as Record<string, number>)

  const metodoLabel: Record<string, string> = { efectivo: '💵 Efectivo', tarjeta: '💳 Tarjeta', transferencia: '🏦 Transferencia', mixto: '🔀 Mixto' }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/pos')} className="text-xs text-gray-400 hover:text-gray-600">← Volver al POS</button>
          <h1 className="text-sm font-semibold text-gray-900">🏦 Arqueo de Caja</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50">📊 Dashboard</button>
          <button onClick={() => router.push('/admin')} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50">⚙️ Admin</button>
          <span className="text-xs text-gray-500">{usuario?.nombre ?? 'Admin'}</span>
          <button onClick={logout} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700">Salir</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : !cajaActual ? (
          /* Apertura de caja */
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🔓</div>
              <h2 className="text-lg font-semibold text-gray-900">Abrir caja</h2>
              <p className="text-sm text-gray-400 mt-1">Ingresa el monto inicial en efectivo para comenzar el turno</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Monto inicial en efectivo</label>
                <input type="number" placeholder="0.00" value={montoInicial} onChange={e => setMontoInicial(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-3 text-lg text-center outline-none focus:border-blue-400" />
              </div>
              <button onClick={abrirCaja} disabled={guardando || !montoInicial}
                className="w-full rounded-xl bg-green-600 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                {guardando ? 'Abriendo…' : '✅ Abrir caja'}
              </button>
            </div>
          </div>
        ) : (
          /* Caja abierta */
          <>
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">✅ Caja abierta</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Desde: {new Date(cajaActual.fecha_apertura).toLocaleString('es-EC')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-green-600">Monto inicial</p>
                <p className="text-lg font-semibold text-green-800">{fmt(cajaActual.monto_inicial)}</p>
              </div>
            </div>

            {/* Resumen del turno */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">📊 Resumen del turno</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-semibold text-gray-900">{ventasDelTurno.length}</p>
                  <p className="text-xs text-gray-400 mt-1">Ventas realizadas</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-4 text-center">
                  <p className="text-2xl font-semibold text-blue-700">{fmt(totalSistema)}</p>
                  <p className="text-xs text-gray-400 mt-1">Total en ventas</p>
                </div>
              </div>

              {Object.entries(porMetodo).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">Por método de pago:</p>
                  {Object.entries(porMetodo).map(([metodo, total]) => (
                    <div key={metodo} className="flex justify-between text-sm">
                      <span className="text-gray-600">{metodoLabel[metodo] ?? metodo}</span>
                      <span className="font-medium">{fmt(total as number)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-gray-100 pt-3">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-gray-700">Efectivo esperado en caja</span>
                  <span className="text-gray-900">{fmt(cajaActual.monto_inicial + (porMetodo['efectivo'] ?? 0))}</span>
                </div>
              </div>
            </div>

            {/* Cierre de caja */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">🔒 Cerrar caja</h2>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Monto físico contado</label>
                <input type="number" placeholder="0.00" value={montoFisico} onChange={e => setMontoFisico(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
              </div>
              {montoFisico && (
                <div className={`rounded-xl p-3 text-sm ${
                  parseFloat(montoFisico) - (cajaActual.monto_inicial + (porMetodo['efectivo'] ?? 0)) === 0
                    ? 'bg-green-50 text-green-700'
                    : parseFloat(montoFisico) - (cajaActual.monto_inicial + (porMetodo['efectivo'] ?? 0)) > 0
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-red-50 text-red-700'
                }`}>
                  {(() => {
                    const dif = parseFloat(montoFisico) - (cajaActual.monto_inicial + (porMetodo['efectivo'] ?? 0))
                    if (dif === 0) return '✅ Caja cuadrada perfectamente'
                    if (dif > 0) return `📈 Sobrante: ${fmt(dif)}`
                    return `📉 Faltante: ${fmt(Math.abs(dif))}`
                  })()}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea placeholder="Observaciones del turno…" value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" />
              </div>
              <button onClick={cerrarCaja} disabled={guardando || !montoFisico}
                className="w-full rounded-xl bg-red-600 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {guardando ? 'Cerrando…' : '🔒 Cerrar caja'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
