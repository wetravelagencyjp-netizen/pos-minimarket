'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const fmt = (n: number) => `$${n.toFixed(2)}`

const TIPOS_GASTO = [
  { value: 'inventario', label: '📦 Inventario' },
  { value: 'servicios', label: '🔧 Servicios' },
  { value: 'arriendo', label: '🏠 Arriendo' },
  { value: 'otro', label: '📋 Otro' },
]

export default function GastosPage() {
  const { usuario, logout } = useAuth()
  const router = useRouter()
  const estabId = usuario?.establecimiento_id ?? 1

  const [gastos, setGastos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [proveedor, setProveedor] = useState('')
  const [tipoGasto, setTipoGasto] = useState('inventario')
  const [monto, setMonto] = useState('')
  const [ivaGasto, setIvaGasto] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [numeroFactura, setNumeroFactura] = useState('')
  const [notas, setNotas] = useState('')

  useEffect(() => {
    if (usuario && usuario.rol === 'cajero') router.push('/pos')
  }, [usuario, router])

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('gastos')
      .select('*')
      .eq('establecimiento_id', estabId)
      .order('fecha', { ascending: false })
      .order('id', { ascending: false })
      .limit(50)
    setGastos(data ?? [])
    setLoading(false)
  }, [estabId])

  useEffect(() => { cargar() }, [cargar])

  const limpiarForm = () => {
    setProveedor(''); setMonto(''); setIvaGasto(''); setNumeroFactura(''); setNotas('')
    setFecha(new Date().toISOString().slice(0, 10))
  }

  const registrarGasto = async () => {
    if (!monto || !fecha) return
    setGuardando(true)
    const { error } = await supabase.from('gastos').insert({
      establecimiento_id: estabId,
      proveedor: proveedor.trim() || null,
      tipo_gasto: tipoGasto,
      monto: parseFloat(monto),
      iva_gasto: parseFloat(ivaGasto) || 0,
      fecha,
      numero_factura: numeroFactura.trim() || null,
      notas: notas.trim() || null,
    })
    setGuardando(false)
    if (error) {
      alert(`Error al guardar: ${error.message}`)
      return
    }
    limpiarForm()
    cargar()
  }

  const eliminarGasto = async (id: number) => {
    if (!confirm('¿Eliminar este gasto?')) return
    await supabase.from('gastos').delete().eq('id', id)
    cargar()
  }

  const totalListado = gastos.reduce((s, g) => s + g.monto, 0)

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/admin')} className="text-xs text-gray-400 hover:text-gray-600">← Volver a Admin</button>
          <h1 className="text-sm font-semibold text-gray-900">💸 Registro de Gastos</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/pos')} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50">🛒 POS</button>
          <span className="text-xs text-gray-500">{usuario?.nombre ?? 'Admin'}</span>
          <button onClick={logout} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700">Salir</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl mx-auto w-full">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">➕ Nuevo gasto</h2>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de gasto</label>
            <div className="grid grid-cols-4 gap-1.5">
              {TIPOS_GASTO.map(t => (
                <button key={t.value} onClick={() => setTipoGasto(t.value)}
                  className={`rounded-lg border py-2 text-xs font-medium transition-all
                    ${tipoGasto === t.value ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-white'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Proveedor <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input type="text" value={proveedor} onChange={e => setProveedor(e.target.value)}
                placeholder="Nombre del proveedor"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">N° de factura <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input type="text" value={numeroFactura} onChange={e => setNumeroFactura(e.target.value)}
                placeholder="001-001-000123"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Monto</label>
              <input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">IVA del gasto <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input type="number" min="0" step="0.01" value={ivaGasto} onChange={e => setIvaGasto(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notas <span className="text-gray-400 font-normal">(opcional)</span></label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              placeholder="Detalle adicional…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" />
          </div>

          <button onClick={registrarGasto} disabled={guardando || !monto || !fecha}
            className="w-full rounded-xl bg-red-600 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
            {guardando ? 'Guardando…' : '💾 Registrar gasto'}
          </button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">📋 Últimos gastos registrados</h2>
            {gastos.length > 0 && <span className="text-xs text-gray-500">Total: {fmt(totalListado)}</span>}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : gastos.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Todavía no hay gastos registrados</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {gastos.map(g => (
                <div key={g.id} className="flex items-center justify-between py-2.5 group">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-900">{TIPOS_GASTO.find(t => t.value === g.tipo_gasto)?.label ?? g.tipo_gasto}</span>
                      <span className="text-[11px] text-gray-400">{new Date(g.fecha + 'T00:00:00').toLocaleDateString('es-EC')}</span>
                    </div>
                    <p className="truncate text-xs text-gray-500">
                      {g.proveedor || 'Sin proveedor'}{g.numero_factura ? ` · ${g.numero_factura}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">{fmt(g.monto)}</span>
                    <button onClick={() => eliminarGasto(g.id)} className="text-gray-200 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}