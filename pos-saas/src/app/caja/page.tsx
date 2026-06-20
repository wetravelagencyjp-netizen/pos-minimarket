'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { exportarCierreCSV, exportarCierrePDF } from '@/lib/exportarCierreCaja'

interface CajaActiva {
  id: number
  monto_inicial: number
  fecha_apertura: string
}

export default function CajaPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const estabId = Number(usuario?.establecimiento_id ?? 1)

  const [cajaActiva, setCajaActiva] = useState<CajaActiva | null>(null)
  const [cargando, setCargando] = useState(true)
  const [montoInicial, setMontoInicial] = useState('')
  const [abriendo, setAbriendo] = useState(false)
  const [montoFisico, setMontoFisico] = useState('')
  const [cerrando, setCerrando] = useState(false)
  const [resumen, setResumen] = useState<{ porMetodo: Record<string, number>; porBanco: Record<string, number>; totalSistema: number } | null>(null)
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null)
  const [cierreFinal, setCierreFinal] = useState<{ esperado: number; fisico: number; diferencia: number; cajaId: number; fechaApertura: string } | null>(null)
  const [mostrarCierre, setMostrarCierre] = useState(false)
  const [mostrarEgreso, setMostrarEgreso] = useState(false)
  const [montoEgreso, setMontoEgreso] = useState('')
  const [motivoEgreso, setMotivoEgreso] = useState('')
  const [pinEgreso, setPinEgreso] = useState('')
  const [validandoEgreso, setValidandoEgreso] = useState(false)
  const [errorEgreso, setErrorEgreso] = useState<string | null>(null)
  const [totalEgresos, setTotalEgresos] = useState(0)

  const cargarCajaActiva = useCallback(async () => {
    setCargando(true)
    const { data } = await supabase
      .from('cajas')
      .select('id, monto_inicial, fecha_apertura')
      .eq('usuario_id', usuario?.id)
      .eq('establecimiento_id', estabId)
      .is('fecha_cierre', null)
      .order('fecha_apertura', { ascending: false })
      .limit(1)
      .maybeSingle()
    setCajaActiva(data)
    setCargando(false)
  }, [usuario?.id, estabId])

  useEffect(() => { if (usuario) cargarCajaActiva() }, [usuario, cargarCajaActiva])

  useEffect(() => {
    if (!cajaActiva) return
    const cargarResumen = async () => {
      const { data: ventas } = await supabase
        .from('ventas')
        .select('id, total, fecha_venta')
        .eq('caja_id', cajaActiva.id)
      const idsVenta = (ventas ?? []).map((v) => v.id)
      if (idsVenta.length === 0) {
        setResumen({ porMetodo: {}, porBanco: {}, totalSistema: 0 })
        return
      }
      const { data: pagos } = await supabase
        .from('pagos_venta')
        .select('metodo_pago, monto, banco_id, bancos(nombre)')
        .in('venta_id', idsVenta)

      const porMetodo: Record<string, number> = {}
      const porBanco: Record<string, number> = {}
      let totalSistema = 0
      for (const p of pagos ?? []) {
        const monto = Number(p.monto)
        porMetodo[p.metodo_pago] = (porMetodo[p.metodo_pago] ?? 0) + monto
        totalSistema += monto
        if (p.metodo_pago === 'transferencia') {
          const nombreBanco = (p as any).bancos?.nombre ?? 'Sin banco'
          porBanco[nombreBanco] = (porBanco[nombreBanco] ?? 0) + monto
        }
      }
      setResumen({ porMetodo, porBanco, totalSistema })

      const { data: egresos } = await supabase
        .from('movimientos_caja')
        .select('monto')
        .eq('caja_id', cajaActiva.id)
      setTotalEgresos((egresos ?? []).reduce((s, e) => s + Number(e.monto), 0))
    }
    cargarResumen()
  }, [cajaActiva])

  const abrirCaja = async () => {
    const monto = parseFloat(montoInicial)
    if (isNaN(monto) || monto < 0) {
      setMensaje({ texto: '❌ Ingresa un monto inicial válido', tipo: 'error' })
      return
    }
    setAbriendo(true)
    const { error } = await supabase.from('cajas').insert({
      establecimiento_id: estabId,
      usuario_id: usuario?.id,
      monto_inicial: monto,
      fecha_apertura: new Date().toISOString(),
      estado: 'abierta',
    })
    setAbriendo(false)
    if (error) {
      setMensaje({ texto: `❌ ${error.message}`, tipo: 'error' })
    } else {
      router.push('/pos')
    }
  }

  const registrarEgreso = async () => {
    setErrorEgreso(null)
    const monto = parseFloat(montoEgreso)
    if (isNaN(monto) || monto <= 0) {
      setErrorEgreso('Ingresa un monto válido')
      return
    }
    if (!motivoEgreso.trim()) {
      setErrorEgreso('Ingresa el motivo del egreso')
      return
    }
    if (!/^[0-9]{4,6}$/.test(pinEgreso)) {
      setErrorEgreso('Ingresa el PIN de supervisor')
      return
    }

    setValidandoEgreso(true)
    const { data: validacion, error: errorPin } = await supabase.rpc('validar_pin_supervisor', {
      p_establecimiento_id: estabId,
      p_pin: pinEgreso,
    })

    if (errorPin || !validacion?.autorizado) {
      setValidandoEgreso(false)
      if (validacion?.bloqueado_hasta) {
        const minutos = Math.ceil((new Date(validacion.bloqueado_hasta).getTime() - Date.now()) / 60000)
        setErrorEgreso(`Demasiados intentos fallidos. Intenta en ${minutos > 0 ? minutos : 1} minuto(s).`)
      } else {
        setErrorEgreso('PIN incorrecto')
      }
      return
    }

    const { error } = await supabase.from('movimientos_caja').insert({
      caja_id: cajaActiva!.id,
      monto,
      motivo: motivoEgreso.trim(),
      autorizado_por: usuario?.id,
    })
    setValidandoEgreso(false)

    if (error) {
      setErrorEgreso(error.message)
    } else {
      setMontoEgreso('')
      setMotivoEgreso('')
      setPinEgreso('')
      setMostrarEgreso(false)
      cargarCajaActiva()
    }
  }

  const cerrarCaja = async () => {
    if (!cajaActiva || !resumen) return
    const fisico = parseFloat(montoFisico)
    if (isNaN(fisico)) {
      setMensaje({ texto: '❌ Ingresa el monto físico contado', tipo: 'error' })
      return
    }
    setCerrando(true)
    const efectivoEsperado = cajaActiva.monto_inicial + (resumen.porMetodo['efectivo'] ?? 0) - totalEgresos
    const diferencia = +(fisico - efectivoEsperado).toFixed(2)

    const { error } = await supabase.from('cajas').update({
      fecha_cierre: new Date().toISOString(),
      monto_final_sistema: efectivoEsperado,
      monto_final_fisico: fisico,
      diferencia,
      estado: 'cerrada',
      desglose_pagos: resumen.porMetodo,
    }).eq('id', cajaActiva.id)

    setCerrando(false)
    if (error) {
      setMensaje({ texto: `❌ ${error.message}`, tipo: 'error' })
    } else {
      setCierreFinal({ esperado: efectivoEsperado, fisico, diferencia, cajaId: cajaActiva.id, fechaApertura: cajaActiva.fecha_apertura })
      setCajaActiva(null)
    }
  }

  const fmt = (n: number) => `$${n.toFixed(2)}`

  if (cargando) {
    return <div className="flex h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">Cargando…</div>
  }

  if (cierreFinal) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/70 p-6 max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 bg-emerald-50 rounded-full mx-auto flex items-center justify-center text-2xl">✅</div>
          <h2 className="text-sm font-semibold text-slate-900">Caja cerrada</h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Efectivo esperado</span><span className="font-medium text-slate-900">{fmt(cierreFinal.esperado)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Efectivo contado</span><span className="font-medium text-slate-900">{fmt(cierreFinal.fisico)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Diferencia</span><span className={`font-semibold ${cierreFinal.diferencia === 0 ? 'text-emerald-600' : cierreFinal.diferencia > 0 ? 'text-blue-600' : 'text-rose-600'}`}>{fmt(cierreFinal.diferencia)}</span></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportarCierrePDF({
              nombreNegocio: usuario?.nombre ?? 'Negocio', ruc: null, cajero: usuario?.nombre ?? '',
              cajaId: cierreFinal.cajaId, fechaApertura: cierreFinal.fechaApertura, fechaCierre: new Date().toISOString(),
              montoInicial: 0, porMetodo: resumen?.porMetodo ?? {}, porBanco: resumen?.porBanco ?? {}, totalEgresos,
              efectivoEsperado: cierreFinal.esperado, efectivoDeclarado: cierreFinal.fisico, diferencia: cierreFinal.diferencia,
            })} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              📄 PDF
            </button>
            <button onClick={() => exportarCierreCSV({
              nombreNegocio: usuario?.nombre ?? 'Negocio', ruc: null, cajero: usuario?.nombre ?? '',
              cajaId: cierreFinal.cajaId, fechaApertura: cierreFinal.fechaApertura, fechaCierre: new Date().toISOString(),
              montoInicial: 0, porMetodo: resumen?.porMetodo ?? {}, porBanco: resumen?.porBanco ?? {}, totalEgresos,
              efectivoEsperado: cierreFinal.esperado, efectivoDeclarado: cierreFinal.fisico, diferencia: cierreFinal.diferencia,
            })} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              📊 Excel
            </button>
          </div>
          <button onClick={() => router.push('/pos')}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
            Volver al POS
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/pos')} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
            ← Volver al POS
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <h1 className="text-sm font-semibold text-slate-900">💰 Control de Caja</h1>
        </div>
        <span className="text-xs text-slate-500">{usuario?.nombre ?? ''}</span>
      </header>

      <main className="mx-auto max-w-md p-6 space-y-4">
        {!cajaActiva ? (
          <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">Abrir caja</h2>
            <p className="mb-4 text-xs text-slate-500">Ingresa el monto inicial en efectivo para empezar tu turno.</p>
            <input
              type="number" step="0.01"
              value={montoInicial}
              onChange={(e) => setMontoInicial(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
            />
            {mensaje && <div className="mt-3 rounded-xl px-4 py-2.5 text-sm bg-rose-50 text-rose-600">{mensaje.texto}</div>}
            <button onClick={abrirCaja} disabled={abriendo}
              className="mt-4 w-full rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {abriendo ? 'Abriendo…' : 'Abrir caja'}
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Caja abierta</h2>
              <p className="text-xs text-slate-500">Monto inicial: {fmt(cajaActiva.monto_inicial)}</p>
            </div>

            {resumen && (
              <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">Resumen del turno</h2>
                {Object.entries(resumen.porMetodo).map(([metodo, monto]) => (
                  <div key={metodo} className="flex justify-between text-sm">
                    <span className="text-slate-600 capitalize">{metodo}</span>
                    <span className="font-medium text-slate-900">
                      {metodo === 'efectivo' ? '••••' : fmt(monto)}
                    </span>
                  </div>
                ))}
                {Object.keys(resumen.porBanco).length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Por banco</p>
                    {Object.entries(resumen.porBanco).map(([banco, monto]) => (
                      <div key={banco} className="flex justify-between text-xs">
                        <span className="text-slate-500">{banco}</span>
                        <span className="text-slate-700">{fmt(monto)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="pt-2 border-t border-slate-100 flex justify-between text-sm font-semibold">
                  <span className="text-slate-700">Total ventas (no efectivo)</span>
                  <span className="text-slate-900">{fmt(resumen.totalSistema - (resumen.porMetodo['efectivo'] ?? 0))}</span>
                </div>
                {totalEgresos > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-rose-500">Egresos de caja</span>
                    <span className="text-rose-500">-{fmt(totalEgresos)}</span>
                  </div>
                )}
              </div>
            )}

            {!mostrarEgreso ? (
              <button onClick={() => setMostrarEgreso(true)}
                className="w-full rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                💸 Registrar egreso de caja
              </button>
            ) : (
              <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">Registrar egreso</h2>
                <input
                  type="number" step="0.01"
                  value={montoEgreso}
                  onChange={(e) => setMontoEgreso(e.target.value)}
                  placeholder="Monto"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
                />
                <input
                  value={motivoEgreso}
                  onChange={(e) => setMotivoEgreso(e.target.value)}
                  placeholder="Motivo (ej: compra de suministros)"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
                />
                <input
                  type="password" inputMode="numeric" maxLength={6}
                  value={pinEgreso}
                  onChange={(e) => setPinEgreso(e.target.value.replace(/\D/g, ''))}
                  placeholder="PIN de supervisor"
                  className="w-full rounded-xl border border-amber-200 bg-amber-50/50 px-3.5 py-2.5 text-sm outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/10"
                />
                {errorEgreso && <p className="text-rose-600 text-xs">{errorEgreso}</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setMostrarEgreso(false); setErrorEgreso(null) }}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-50 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={registrarEgreso} disabled={validandoEgreso}
                    className="flex-1 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50 transition-colors">
                    {validandoEgreso ? 'Validando…' : 'Autorizar y registrar'}
                  </button>
                </div>
              </div>
            )}

            {!mostrarCierre ? (
              <button onClick={() => setMostrarCierre(true)}
                className="w-full rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-600 hover:bg-rose-100 transition-colors">
                🔒 Cerrar turno
              </button>
            ) : (
              <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50">
                <h2 className="mb-1 text-sm font-semibold text-slate-900">Cerrar caja</h2>
                <p className="mb-4 text-xs text-slate-500">Cuenta el efectivo físico en caja e ingrésalo aquí.</p>
                <input
                  type="number" step="0.01"
                  value={montoFisico}
                  onChange={(e) => setMontoFisico(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
                />
                {mensaje && <div className="mt-3 rounded-xl px-4 py-2.5 text-sm bg-rose-50 text-rose-600">{mensaje.texto}</div>}
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setMostrarCierre(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-50 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={cerrarCaja} disabled={cerrando}
                    className="flex-1 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50 transition-colors">
                    {cerrando ? 'Cerrando…' : 'Confirmar cierre'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}