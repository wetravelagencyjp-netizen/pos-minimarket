'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const fmt = (n: number) => n < 0 ? `-$${Math.abs(n).toFixed(2)}` : `$${n.toFixed(2)}`
const hoyStr = () => new Date().toISOString().slice(0, 10)

const TIPOS_GASTO_LABEL: Record<string, string> = {
  inventario: '📦 Inventario', servicios: '🔧 Servicios', arriendo: '🏠 Arriendo', otro: '📋 Otro',
}
const TIPOS_GASTO_PLANO: Record<string, string> = {
  inventario: 'Inventario', servicios: 'Servicios', arriendo: 'Arriendo', otro: 'Otro',
}

function primerDiaMes(offsetMeses = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offsetMeses, 1)
  return d.toISOString().slice(0, 10)
}
function ultimoDiaMes(offsetMeses = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offsetMeses + 1, 0)
  return d.toISOString().slice(0, 10)
}

interface DatosReporte {
  establecimiento: string
  fechaInicio: string
  fechaFin: string
  ingresosTotales: number
  costoVentas: number
  gastosOperativos: number
  utilidadNeta: number
  margenCosto: number
  gastosPorTipo: Record<string, number>
}

function imprimirReporteFinanciero(d: DatosReporte) {
  const fmtFecha = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })
  const generado = new Date().toLocaleString('es-EC', { dateStyle: 'long', timeStyle: 'short' })

  const filasGastos = Object.entries(d.gastosPorTipo).map(([tipo, monto]) => `
    <tr><td>${TIPOS_GASTO_PLANO[tipo] ?? tipo}</td><td class="num">${fmt(monto)}</td></tr>
  `).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte P&amp;G</title>
  <style>
    * { margin:0;padding:0;box-sizing:border-box }
    body { font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;padding:30px;max-width:700px;margin:0 auto }
    h1 { font-size:20px;margin-bottom:2px }
    .subt { font-size:13px;color:#666;margin-bottom:20px }
    .periodo { font-size:13px;color:#444;margin-bottom:24px;padding-bottom:12px;border-bottom:2px solid #1a1a1a }
    table { width:100%;border-collapse:collapse;margin-bottom:24px }
    th, td { padding:8px 4px;text-align:left;font-size:13px }
    th { border-bottom:2px solid #1a1a1a;font-size:11px;text-transform:uppercase;color:#666 }
    td.num, th.num { text-align:right }
    .fila-total td { border-top:2px solid #1a1a1a;font-weight:bold;font-size:15px;padding-top:10px }
    .positivo { color:#15803d } .negativo { color:#b91c1c }
    .nota { font-size:11px;color:#888;margin-top:6px }
    .pie { font-size:10px;color:#999;margin-top:30px;border-top:1px solid #ddd;padding-top:10px }
    @media print { body{padding:15mm} }
  </style></head><body>
  <h1>${d.establecimiento}</h1>
  <p class="subt">Reporte de Pérdidas y Ganancias</p>
  <p class="periodo">Período: ${fmtFecha(d.fechaInicio)} — ${fmtFecha(d.fechaFin)}</p>

  <table>
    <tr><th>Concepto</th><th class="num">Monto</th></tr>
    <tr><td>Ingresos Totales</td><td class="num">${fmt(d.ingresosTotales)}</td></tr>
    <tr><td>Costo de Ventas (estimado, ${d.margenCosto}% sobre ventas)</td><td class="num">−${fmt(d.costoVentas)}</td></tr>
    <tr><td>Gastos Operativos</td><td class="num">−${fmt(d.gastosOperativos)}</td></tr>
    <tr class="fila-total"><td>Utilidad Neta</td><td class="num ${d.utilidadNeta >= 0 ? 'positivo' : 'negativo'}">${fmt(d.utilidadNeta)}</td></tr>
  </table>

  ${Object.keys(d.gastosPorTipo).length > 0 ? `
  <table>
    <tr><th>Gastos por tipo</th><th class="num">Monto</th></tr>
    ${filasGastos}
  </table>
  ` : ''}

  <p class="nota">El Costo de Ventas es una estimación basada en un margen configurado, no en costos reales por producto.</p>
  <div class="pie">Generado el ${generado}</div>
  </body></html>`

  const ventana = window.open('', '_blank', 'width=850,height=900')
  if (!ventana) return
  ventana.document.write(html)
  ventana.document.close()
  ventana.focus()
  setTimeout(() => { ventana.print() }, 300)
}

function exportarCSV(d: DatosReporte) {
  const filas: string[] = []
  filas.push(`Reporte de Perdidas y Ganancias - ${d.establecimiento}`)
  filas.push(`Periodo,${d.fechaInicio} a ${d.fechaFin}`)
  filas.push('')
  filas.push('Concepto,Monto')
  filas.push(`Ingresos Totales,${d.ingresosTotales.toFixed(2)}`)
  filas.push(`Costo de Ventas (estimado ${d.margenCosto}%),-${d.costoVentas.toFixed(2)}`)
  filas.push(`Gastos Operativos,-${d.gastosOperativos.toFixed(2)}`)
  filas.push(`Utilidad Neta,${d.utilidadNeta.toFixed(2)}`)
  filas.push('')
  filas.push('Gastos por tipo,Monto')
  Object.entries(d.gastosPorTipo).forEach(([tipo, monto]) => {
    filas.push(`${TIPOS_GASTO_PLANO[tipo] ?? tipo},${monto.toFixed(2)}`)
  })

  const csv = filas.join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reporte-financiero-${d.fechaInicio}-a-${d.fechaFin}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function FinanzasPage() {
  const { usuario, logout } = useAuth()
  const router = useRouter()
  const estabId = usuario?.establecimiento_id ?? 1

  const [fechaInicio, setFechaInicio] = useState(primerDiaMes())
  const [fechaFin, setFechaFin] = useState(hoyStr())
  const [loading, setLoading] = useState(true)
  const [ingresosTotales, setIngresosTotales] = useState(0)
  const [gastosOperativos, setGastosOperativos] = useState(0)
  const [gastosPorTipo, setGastosPorTipo] = useState<Record<string, number>>({})
  const [margenCosto, setMargenCosto] = useState(50)
  const [margenInput, setMargenInput] = useState('50')
  const [guardandoMargen, setGuardandoMargen] = useState(false)

  useEffect(() => {
    if (usuario && usuario.rol === 'cajero') router.push('/pos')
  }, [usuario, router])

  const cargar = useCallback(async () => {
    setLoading(true)
    const inicioISO = new Date(fechaInicio + 'T00:00:00').toISOString()
    const finISO = new Date(fechaFin + 'T23:59:59').toISOString()

    const [{ data: ventas }, { data: gastos }, { data: estab }] = await Promise.all([
      supabase.from('ventas').select('total').eq('establecimiento_id', estabId)
        .gte('fecha_venta', inicioISO).lte('fecha_venta', finISO),
      supabase.from('gastos').select('monto, iva_gasto, tipo_gasto').eq('establecimiento_id', estabId)
        .gte('fecha', fechaInicio).lte('fecha', fechaFin),
      supabase.from('establecimientos').select('margen_costo_estimado').eq('id', estabId).single(),
    ])

    setIngresosTotales((ventas ?? []).reduce((s, v) => s + v.total, 0))
    setGastosOperativos((gastos ?? []).reduce((s, g) => s + g.monto + (g.iva_gasto ?? 0), 0))

    const porTipo: Record<string, number> = {}
    ;(gastos ?? []).forEach(g => { porTipo[g.tipo_gasto] = (porTipo[g.tipo_gasto] ?? 0) + g.monto + (g.iva_gasto ?? 0) })
    setGastosPorTipo(porTipo)

    const margen = estab?.margen_costo_estimado ?? 50
    setMargenCosto(margen)
    setMargenInput(String(margen))

    setLoading(false)
  }, [estabId, fechaInicio, fechaFin])

  useEffect(() => { cargar() }, [cargar])

  const guardarMargen = async () => {
    const valor = parseFloat(margenInput)
    if (isNaN(valor) || valor < 0 || valor > 100) return
    setGuardandoMargen(true)
    await supabase.from('establecimientos').update({ margen_costo_estimado: valor }).eq('id', estabId)
    setMargenCosto(valor)
    setGuardandoMargen(false)
  }

  const costoVentas = +(ingresosTotales * (margenCosto / 100)).toFixed(2)
  const utilidadNeta = +(ingresosTotales - costoVentas - gastosOperativos).toFixed(2)

  const setPreset = (inicio: string, fin: string) => { setFechaInicio(inicio); setFechaFin(fin) }

  const datosReporte: DatosReporte = {
    establecimiento: usuario?.establecimiento?.nombre ?? 'Mi Negocio',
    fechaInicio, fechaFin, ingresosTotales, costoVentas, gastosOperativos, utilidadNeta, margenCosto, gastosPorTipo,
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/admin')} className="text-xs text-gray-400 hover:text-gray-600">← Volver a Admin</button>
          <h1 className="text-sm font-semibold text-gray-900">📊 Pérdidas y Ganancias</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/gastos')} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50">💸 Gastos</button>
          <button onClick={() => router.push('/pos')} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50">🛒 POS</button>
          <span className="text-xs text-gray-500">{usuario?.nombre ?? 'Admin'}</span>
          <button onClick={logout} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700">Salir</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl mx-auto w-full">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Rango de fechas</h2>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setPreset(hoyStr(), hoyStr())} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200">Hoy</button>
            <button onClick={() => setPreset(primerDiaMes(), hoyStr())} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200">Este mes</button>
            <button onClick={() => setPreset(primerDiaMes(-1), ultimoDiaMes(-1))} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200">Mes pasado</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Desde</label>
              <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Hasta</label>
              <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs text-blue-600">Ingresos Totales</p>
                <p className="text-2xl font-semibold text-blue-800 mt-1">{fmt(ingresosTotales)}</p>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                <p className="text-xs text-orange-600">Costo de Ventas (estimado)</p>
                <p className="text-2xl font-semibold text-orange-800 mt-1">{fmt(costoVentas)}</p>
              </div>
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="text-xs text-red-600">Gastos Operativos</p>
                <p className="text-2xl font-semibold text-red-800 mt-1">{fmt(gastosOperativos)}</p>
              </div>
              <div className={`rounded-2xl border p-4 ${utilidadNeta >= 0 ? 'border-green-100 bg-green-50' : 'border-red-200 bg-red-100'}`}>
                <p className={`text-xs ${utilidadNeta >= 0 ? 'text-green-600' : 'text-red-700'}`}>Utilidad Neta</p>
                <p className={`text-2xl font-semibold mt-1 ${utilidadNeta >= 0 ? 'text-green-800' : 'text-red-800'}`}>{fmt(utilidadNeta)}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => imprimirReporteFinanciero(datosReporte)}
                className="flex-1 rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                🖨️ Exportar a PDF
              </button>
              <button onClick={() => exportarCSV(datosReporte)}
                className="flex-1 rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                📊 Exportar a Excel (CSV)
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-2">
              <h2 className="text-sm font-semibold text-gray-900">⚙️ Margen de costo estimado</h2>
              <p className="text-xs text-gray-400">Qué porcentaje del precio de venta representa, en promedio, tu costo. Se usa para calcular el &quot;Costo de Ventas&quot; ya que hoy no registras el costo de cada producto.</p>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="100" step="1" value={margenInput} onChange={e => setMargenInput(e.target.value)}
                  className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                <span className="text-sm text-gray-500">%</span>
                <button onClick={guardarMargen} disabled={guardandoMargen}
                  className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50">
                  {guardandoMargen ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>

            {Object.keys(gastosPorTipo).length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-2">
                <h2 className="text-sm font-semibold text-gray-900">Gastos por tipo (rango seleccionado)</h2>
                {Object.entries(gastosPorTipo).map(([tipo, monto]) => (
                  <div key={tipo} className="flex justify-between text-sm">
                    <span className="text-gray-600">{TIPOS_GASTO_LABEL[tipo] ?? tipo}</span>
                    <span className="font-medium text-gray-900">{fmt(monto)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}