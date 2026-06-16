'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const fmt = (n: number) => `$${n.toFixed(2)}`

interface DesgloseMetodo {
  esperado: number
  contado: number
  diferencia: number
}

interface LiquidacionVendedor {
  vendedor_id: number
  nombre: string
  total: number
}

function imprimirArqueo(datos: {
  establecimiento: string
  cajero: string
  fechaApertura: string
  fechaCierre: string
  montoInicial: number
  efectivo: DesgloseMetodo
  transferencia: DesgloseMetodo
  tarjeta: DesgloseMetodo
  totalMixto: number
  diferenciaTotal: number
  modoMultivendedor: boolean
  vendedores: LiquidacionVendedor[]
}) {
  const { establecimiento, cajero, fechaApertura, fechaCierre, montoInicial, efectivo, transferencia, tarjeta, totalMixto, diferenciaTotal, modoMultivendedor, vendedores } = datos
  const fmtFecha = (iso: string) => new Date(iso).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })

  const filaMetodo = (titulo: string, d: DesgloseMetodo) => `
    <div class="seccion">
      <div class="metodo-titulo">${titulo}</div>
      <div class="info"><span>Esperado:</span><span>${fmt(d.esperado)}</span></div>
      <div class="info"><span>Contado:</span><span>${fmt(d.contado)}</span></div>
      <div class="info"><span>Diferencia:</span><span>${fmt(d.diferencia)}</span></div>
    </div>
  `

  const filaMixto = totalMixto > 0 ? `
    <div class="separador"></div>
    <div class="seccion">
      <div class="metodo-titulo">Mixto (informativo)</div>
      <div class="info"><span>Total vendido:</span><span>${fmt(totalMixto)}</span></div>
    </div>
  ` : ''

  const tablaVendedoras = modoMultivendedor && vendedores.length > 0 ? `
    <div class="linea"></div>
    <div class="vendedor">Liquidación por vendedora</div>
    ${vendedores.map(v => `<div class="info"><span>${v.nombre}</span><span>${fmt(v.total)}</span></div>`).join('')}
  ` : ''

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Arqueo de caja</title>
  <style>
    * { margin:0;padding:0;box-sizing:border-box }
    body { font-family:'Courier New',monospace;font-size:11px;width:80mm;max-width:80mm;padding:4mm;color:#000 }
    .cabecera{text-align:center;margin-bottom:6px} .cabecera h1{font-size:14px;font-weight:bold} .cabecera p{font-size:10px}
    .linea{border-top:1px dashed #000;margin:6px 0} .info{display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px}
    .vendedor{text-align:center;font-weight:bold;font-size:10px;margin:6px 0 4px}
    .metodo-titulo{font-size:11px;font-weight:bold;margin-bottom:2px}
    .separador{border-top:1px dotted #999;margin:6px 0} .total{display:flex;justify-content:space-between;font-size:14px;font-weight:bold;margin-top:6px}
    .pie{text-align:center;font-size:9px;margin-top:8px;color:#555} .seccion{margin:4px 0}
    @media print{body{width:80mm}@page{size:80mm auto;margin:0}}
  </style></head><body>
  <div class="cabecera">
    <h1>🏦 ${establecimiento}</h1>
    <p>Arqueo de Caja</p>
  </div>
  <div class="linea"></div>
  <div class="info"><span>Cajero:</span><span>${cajero}</span></div>
  <div class="info"><span>Apertura:</span><span>${fmtFecha(fechaApertura)}</span></div>
  <div class="info"><span>Cierre:</span><span>${fmtFecha(fechaCierre)}</span></div>
  <div class="info"><span>Fondo inicial:</span><span>${fmt(montoInicial)}</span></div>
  <div class="linea"></div>
  ${filaMetodo('Efectivo', efectivo)}
  <div class="separador"></div>
  ${filaMetodo('Transferencia', transferencia)}
  <div class="separador"></div>
  ${filaMetodo('Tarjeta', tarjeta)}
  ${filaMixto}
  <div class="linea"></div>
  <div class="total"><span>DESCUADRE TOTAL</span><span>${fmt(diferenciaTotal)}</span></div>
  ${tablaVendedoras}
  <div class="linea"></div>
  <div class="pie">Cierre de turno registrado</div>
  </body></html>`

  const ventana = window.open('', '_blank', 'width=320,height=600')
  if (!ventana) return
  ventana.document.write(html)
  ventana.document.close()
  ventana.focus()
  setTimeout(() => { ventana.print(); ventana.close() }, 300)
}

export default function CajaPage() {
  const { usuario, logout } = useAuth()
  const router = useRouter()
  const [cajaActual, setCajaActual] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [montoInicial, setMontoInicial] = useState('')
  const [efectivoContado, setEfectivoContado] = useState('')
  const [transferenciaContada, setTransferenciaContada] = useState('')
  const [tarjetaContada, setTarjetaContada] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [ventasDelTurno, setVentasDelTurno] = useState<any[]>([])
  const [totalSistema, setTotalSistema] = useState(0)
  const [liquidacionVendedoras, setLiquidacionVendedoras] = useState<LiquidacionVendedor[]>([])
  const estabId = usuario?.establecimiento_id ?? 1
  const modoMultivendedor = usuario?.establecimiento?.modo_multivendedor ?? true

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
        .eq('caja_id', data.id)
      const v = ventas ?? []
      setVentasDelTurno(v)
      setTotalSistema(v.reduce((s, x) => s + x.total, 0))

      if (modoMultivendedor && v.length > 0) {
        const ventaIds = v.map(x => x.id)
        const { data: detalles } = await supabase
          .from('detalle_ventas')
          .select('*')
          .in('venta_id', ventaIds)
        const { data: vendedoresData } = await supabase
          .from('vendedores')
          .select('id, nombre')
          .eq('establecimiento_id', estabId)
        const nombrePorId = new Map((vendedoresData ?? []).map((vd: any) => [vd.id, vd.nombre]))
        const totales = new Map<number, number>()
        ;(detalles ?? []).forEach((d: any) => {
          const monto = d.cantidad * d.precio_unitario - (d.descuento ?? 0)
          totales.set(d.vendedor_id, (totales.get(d.vendedor_id) ?? 0) + monto)
        })
        const liquidacion: LiquidacionVendedor[] = Array.from(totales.entries()).map(([vendedor_id, total]) => ({
          vendedor_id,
          nombre: (nombrePorId.get(vendedor_id) as string) ?? `Vendedor #${vendedor_id}`,
          total: +total.toFixed(2),
        }))
        setLiquidacionVendedoras(liquidacion)
      } else {
        setLiquidacionVendedoras([])
      }
    } else {
      setVentasDelTurno([])
      setTotalSistema(0)
      setLiquidacionVendedoras([])
    }
    setLoading(false)
  }, [estabId, modoMultivendedor])

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

  const porMetodo = ventasDelTurno.reduce((acc, v) => {
    acc[v.metodo_pago] = (acc[v.metodo_pago] ?? 0) + v.total
    return acc
  }, {} as Record<string, number>)

  const metodoLabel: Record<string, string> = { efectivo: '💵 Efectivo', tarjeta: '💳 Tarjeta', transferencia: '🏦 Transferencia', mixto: '🔀 Mixto' }

  const esperadoEfectivo = +(((cajaActual?.monto_inicial ?? 0) + (porMetodo['efectivo'] ?? 0))).toFixed(2)
  const esperadoTransferencia = +((porMetodo['transferencia'] ?? 0)).toFixed(2)
  const esperadoTarjeta = +((porMetodo['tarjeta'] ?? 0)).toFixed(2)
  const totalMixto = +((porMetodo['mixto'] ?? 0)).toFixed(2)

  const efeContado = parseFloat(efectivoContado) || 0
  const transContado = parseFloat(transferenciaContada) || 0
  const tarjContado = parseFloat(tarjetaContada) || 0

  const difEfectivo = +(efeContado - esperadoEfectivo).toFixed(2)
  const difTransferencia = +(transContado - esperadoTransferencia).toFixed(2)
  const difTarjeta = +(tarjContado - esperadoTarjeta).toFixed(2)
  const difTotal = +(difEfectivo + difTransferencia + difTarjeta).toFixed(2)

  const renderDiferencia = (dif: number) => (
    <div className={`rounded-lg p-2.5 text-xs mt-1.5 ${
      dif === 0 ? 'bg-green-50 text-green-700' : dif > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
    }`}>
      {dif === 0 ? '✅ Cuadrado' : dif > 0 ? `📈 Sobrante: ${fmt(dif)}` : `📉 Faltante: ${fmt(Math.abs(dif))}`}
    </div>
  )

  const cerrarCaja = async () => {
    if (!efectivoContado) return
    if (!confirm('¿Confirmas el cierre de caja?')) return
    setGuardando(true)

    const desglosePagos: any = {
      efectivo: { esperado: esperadoEfectivo, contado: efeContado, diferencia: difEfectivo },
      transferencia: { esperado: esperadoTransferencia, contado: transContado, diferencia: difTransferencia },
      tarjeta: { esperado: esperadoTarjeta, contado: tarjContado, diferencia: difTarjeta },
    }
    if (totalMixto > 0) desglosePagos.mixto = { total: totalMixto }

    const desgloseVendedoresFinal = modoMultivendedor ? liquidacionVendedoras : []
    const montoFinalSistema = esperadoEfectivo + esperadoTransferencia + esperadoTarjeta + totalMixto
    const montoFinalFisico = efeContado + transContado + tarjContado
    const fechaCierre = new Date().toISOString()

    await supabase.from('cajas').update({
      fecha_cierre: fechaCierre,
      monto_final_sistema: montoFinalSistema,
      monto_final_fisico: montoFinalFisico,
      diferencia: difTotal,
      desglose_pagos: desglosePagos,
      desglose_vendedores: desgloseVendedoresFinal,
      estado: 'cerrada',
      notas,
    }).eq('id', cajaActual.id)

    imprimirArqueo({
      establecimiento: usuario?.establecimiento?.nombre ?? 'Negocio',
      cajero: usuario?.nombre ?? 'Cajero',
      fechaApertura: cajaActual.fecha_apertura,
      fechaCierre,
      montoInicial: cajaActual.monto_inicial,
      efectivo: { esperado: esperadoEfectivo, contado: efeContado, diferencia: difEfectivo },
      transferencia: { esperado: esperadoTransferencia, contado: transContado, diferencia: difTransferencia },
      tarjeta: { esperado: esperadoTarjeta, contado: tarjContado, diferencia: difTarjeta },
      totalMixto,
      diferenciaTotal: difTotal,
      modoMultivendedor,
      vendedores: desgloseVendedoresFinal,
    })

    setEfectivoContado('')
    setTransferenciaContada('')
    setTarjetaContada('')
    setNotas('')
    setGuardando(false)
    cargar()
  }

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
                  <p className="text-xs font-medium text-gray-500">Por método de pago (ventas del turno):</p>
                  {Object.entries(porMetodo).map(([metodo, total]) => (
                    <div key={metodo} className="flex justify-between text-sm">
                      <span className="text-gray-600">{metodoLabel[metodo] ?? metodo}</span>
                      <span className="font-medium">{fmt(total as number)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-gray-100 pt-3 space-y-2">
                <p className="text-xs font-medium text-gray-500">Esperado en caja por método:</p>
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-gray-700">💵 Efectivo (incluye fondo inicial)</span>
                  <span className="text-gray-900">{fmt(esperadoEfectivo)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-gray-700">🏦 Transferencia</span>
                  <span className="text-gray-900">{fmt(esperadoTransferencia)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-gray-700">💳 Tarjeta</span>
                  <span className="text-gray-900">{fmt(esperadoTarjeta)}</span>
                </div>
                {totalMixto > 0 && (
                  <p className="text-[11px] text-gray-400 pt-1">🔀 Mixto vendido: {fmt(totalMixto)} (revisar manualmente, no incluido en el cuadre)</p>
                )}
              </div>

              {modoMultivendedor && liquidacionVendedoras.length > 0 && (
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <p className="text-xs font-medium text-gray-500">Liquidación por vendedora (vista previa):</p>
                  {liquidacionVendedoras.map(v => (
                    <div key={v.vendedor_id} className="flex justify-between text-sm">
                      <span className="text-gray-600">{v.nombre}</span>
                      <span className="font-medium">{fmt(v.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cierre de caja */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">🔒 Cerrar caja</h2>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">💵 Efectivo contado</label>
                <input type="number" placeholder="0.00" value={efectivoContado} onChange={e => setEfectivoContado(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
                {efectivoContado && renderDiferencia(difEfectivo)}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">🏦 Transferencias verificadas</label>
                <input type="number" placeholder="0.00" value={transferenciaContada} onChange={e => setTransferenciaContada(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
                {transferenciaContada && renderDiferencia(difTransferencia)}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">💳 Tarjetas (vouchers) contadas</label>
                <input type="number" placeholder="0.00" value={tarjetaContada} onChange={e => setTarjetaContada(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
                {tarjetaContada && renderDiferencia(difTarjeta)}
              </div>

              {(efectivoContado || transferenciaContada || tarjetaContada) && (
                <div className={`rounded-xl p-3 text-sm font-medium ${
                  difTotal === 0 ? 'bg-green-50 text-green-700' : difTotal > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
                }`}>
                  {difTotal === 0 ? '✅ Descuadre total: $0.00' : difTotal > 0 ? `📈 Descuadre total — Sobrante: ${fmt(difTotal)}` : `📉 Descuadre total — Faltante: ${fmt(Math.abs(difTotal))}`}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea placeholder="Observaciones del turno…" value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" />
              </div>
              <button onClick={cerrarCaja} disabled={guardando || !efectivoContado}
                className="w-full rounded-xl bg-red-600 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {guardando ? 'Cerrando…' : '🔒 Cerrar caja e imprimir arqueo'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}