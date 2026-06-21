'use client'

import { useState, useEffect } from 'react'
import { useCarrito } from '@/core/context/CarritoContext'
import { useRegistrarVenta, type MetodoPago } from '@/core/hooks/useRegistrarVenta'
import SelectorCliente, { type ClienteConCredito } from './SelectorCliente'
import ModalEmitirFactura from './ModalEmitirFactura'
import { supabase } from '@/lib/supabase'

interface CheckoutModalProps {
  establecimientoId: number
  onClose: () => void
}

interface LineaPago {
  metodo: MetodoPago
  monto: string
  bancoId: number | null
}

const METODOS: { id: MetodoPago; label: string; icono: string }[] = [
  { id: 'efectivo', label: 'Efectivo', icono: '💵' },
  { id: 'tarjeta', label: 'Tarjeta', icono: '💳' },
  { id: 'transferencia', label: 'Transferencia', icono: '🏦' },
  { id: 'credito', label: 'Crédito / Fiado', icono: '📝' },
]

export default function CheckoutModal({ establecimientoId, onClose }: CheckoutModalProps) {
  const { items, total, vaciarCarrito } = useCarrito()
  const { registrarVenta, isProcesando } = useRegistrarVenta()
  const [resultado, setResultado] = useState<{ numeroComprobante: string; ventaId?: number } | null>(null)
  const [cliente, setCliente] = useState<ClienteConCredito | null>(null)
  const [errorCredito, setErrorCredito] = useState<string | null>(null)
  const [excedeLimite, setExcedeLimite] = useState(false)
  const [autorizado, setAutorizado] = useState(false)
  const [mostrarPin, setMostrarPin] = useState(false)
  const [pinIngresado, setPinIngresado] = useState('')
  const [validandoPin, setValidandoPin] = useState(false)
  const [errorPin, setErrorPin] = useState<string | null>(null)
  const [bancos, setBancos] = useState<{ id: number; nombre: string }[]>([])
  const [cajaId, setCajaId] = useState<number | null>(null)
  const [mostrarFactura, setMostrarFactura] = useState(false)
  const [facturaEmitida, setFacturaEmitida] = useState(false)

  const [pagos, setPagos] = useState<LineaPago[]>([{ metodo: 'efectivo', monto: total.toFixed(2), bancoId: null }])

  const usaCredito = pagos.some((p) => p.metodo === 'credito' && parseFloat(p.monto || '0') > 0)
  const montoCredito = pagos
    .filter((p) => p.metodo === 'credito')
    .reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)

  const sumaPagos = pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
  const faltante = +(total - sumaPagos).toFixed(2)

  useEffect(() => {
    if (!pagos.some((p) => p.metodo === 'transferencia')) return
    supabase.from('bancos').select('id, nombre')
      .eq('establecimiento_id', establecimientoId).eq('activo', true).order('nombre')
      .then(({ data }) => setBancos(data ?? []))
  }, [pagos, establecimientoId])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('cajas').select('id')
        .eq('usuario_id', user.id)
        .eq('establecimiento_id', establecimientoId)
        .is('fecha_cierre', null)
        .order('fecha_apertura', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => setCajaId(data?.id ?? null))
    })
  }, [establecimientoId])

  function agregarLinea() {
    if (faltante <= 0) return
    setPagos((prev) => [...prev, { metodo: 'efectivo', monto: faltante.toFixed(2), bancoId: null }])
  }

  function quitarLinea(idx: number) {
    setPagos((prev) => prev.filter((_, i) => i !== idx))
  }

  function actualizarLinea(idx: number, cambios: Partial<LineaPago>) {
    setPagos((prev) => prev.map((p, i) => (i === idx ? { ...p, ...cambios } : p)))
    resetearAutorizacion()
  }

  function resetearAutorizacion() {
    setAutorizado(false)
    setExcedeLimite(false)
    setMostrarPin(false)
    setPinIngresado('')
    setErrorPin(null)
    setErrorCredito(null)
  }

  async function handleConfirmar() {
    setErrorCredito(null)

    if (faltante !== 0) {
      setErrorCredito(faltante > 0
        ? `Falta cubrir $${faltante.toFixed(2)} del total.`
        : `Los pagos suman $${Math.abs(faltante).toFixed(2)} más que el total.`)
      return
    }

    const transferenciaSinBanco = pagos.some((p) => p.metodo === 'transferencia' && !p.bancoId)
    if (transferenciaSinBanco) {
      setErrorCredito('Selecciona el banco para la transferencia.')
      return
    }

    if (usaCredito) {
      if (!cliente) {
        setErrorCredito('Selecciona un cliente para la porción a crédito.')
        return
      }
      const saldoResultante = cliente.saldo_pendiente + montoCredito
      if (saldoResultante > cliente.limite_credito && !autorizado) {
        setExcedeLimite(true)
        setErrorCredito(
          `La porción a crédito ($${montoCredito.toFixed(2)}) supera el límite disponible del cliente: $${(cliente.limite_credito - cliente.saldo_pendiente).toFixed(2)}`
        )
        return
      }
    }

    const metodoPrincipal: MetodoPago = pagos[0].metodo
    const bancoPrincipal = pagos.find((p) => p.metodo === 'transferencia')?.bancoId ?? null

    const res = await registrarVenta({
      establecimientoId,
      vendedorId: null,
      clienteId: usaCredito ? cliente!.id : null,
      cajaId,
      bancoId: bancoPrincipal,
      items,
      total,
      metodoPago: pagos.length > 1 ? 'mixto' as MetodoPago : metodoPrincipal,
      pagos: pagos.map((p) => ({
        metodo: p.metodo,
        monto: parseFloat(p.monto) || 0,
        bancoId: p.metodo === 'transferencia' ? p.bancoId : null,
      })),
    })

    if (res.success && res.numeroComprobante) {
      setResultado({ numeroComprobante: res.numeroComprobante, ventaId: res.ventaId })
    } else if (res.error) {
      setErrorCredito(res.error)
    }
  }

  async function handleValidarPin() {
    setErrorPin(null)
    if (!/^[0-9]{4,6}$/.test(pinIngresado)) {
      setErrorPin('Ingresa un PIN válido')
      return
    }
    setValidandoPin(true)
    const { data, error } = await supabase.rpc('validar_pin_supervisor', {
      p_establecimiento_id: establecimientoId,
      p_pin: pinIngresado,
    })
    setValidandoPin(false)

    if (error || !data?.autorizado) {
      if (data?.bloqueado_hasta) {
        const minutos = Math.ceil((new Date(data.bloqueado_hasta).getTime() - Date.now()) / 60000)
        setErrorPin(`Demasiados intentos fallidos. Intenta de nuevo en ${minutos > 0 ? minutos : 1} minuto(s).`)
      } else {
        setErrorPin('PIN incorrecto')
      }
      return
    }

    setAutorizado(true)
    setMostrarPin(false)
    setPinIngresado('')
    setErrorCredito(null)
  }

  if (resultado) {
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-900/10 p-7 max-w-sm w-full text-center space-y-5">
          <div className="w-14 h-14 bg-emerald-50 rounded-full mx-auto flex items-center justify-center text-2xl">
            ✅
          </div>
          <div>
            <h3 className="text-slate-900 font-semibold text-lg">Venta registrada</h3>
            <p className="text-slate-500 text-sm mt-1">Comprobante {resultado.numeroComprobante}</p>
          </div>

          {pagos.length > 1 && (
            <div className="bg-slate-50 rounded-xl p-4 text-left space-y-1.5">
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-2">Pago dividido</p>
              {pagos.map((p, i) => (
                <div key={i} className="flex justify-between text-sm text-slate-700">
                  <span>{METODOS.find((m) => m.id === p.metodo)?.label}</span>
                  <span className="font-medium">${(parseFloat(p.monto) || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {!facturaEmitida ? (
            <button onClick={() => setMostrarFactura(true)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-xl transition-colors text-sm">
              🧾 Emitir Factura SRI
            </button>
          ) : (
            <div className="bg-emerald-50 text-emerald-700 text-sm rounded-xl px-4 py-3 text-center font-medium">
              ✅ Factura emitida — pendiente de autorización SRI
            </div>
          )}
          {mostrarFactura && resultado.ventaId && (
            <ModalEmitirFactura
              ventaId={resultado.ventaId}
              numeroComprobanteVenta={resultado.numeroComprobante}
              establecimientoId={establecimientoId}
              total={total}
              onCerrar={() => setMostrarFactura(false)}
              onEmitido={() => { setMostrarFactura(false); setFacturaEmitida(true) }}
            />
          )}

          <button
            onClick={() => { vaciarCarrito(); onClose() }}
            className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-3 rounded-xl transition-colors text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-900/10 p-7 max-w-sm w-full space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-slate-900 font-semibold text-lg">Confirmar cobro</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="bg-slate-50 rounded-xl p-5 flex justify-between items-baseline">
          <span className="text-slate-500 text-sm">Total a cobrar</span>
          <span className="text-slate-900 font-bold text-3xl tracking-tight">${total.toFixed(2)}</span>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Métodos de pago</p>
            {faltante > 0 && (
              <button onClick={agregarLinea} className="text-slate-900 hover:text-slate-600 text-xs font-medium transition-colors">
                + Dividir pago
              </button>
            )}
          </div>

          {pagos.map((linea, idx) => (
            <div key={idx} className="bg-slate-50 rounded-xl p-3 space-y-2">
              <div className="flex gap-2 items-center">
                <select
                  value={linea.metodo}
                  onChange={(e) => actualizarLinea(idx, { metodo: e.target.value as MetodoPago, bancoId: null })}
                  className="flex-1 bg-white border border-slate-200 text-slate-900 text-sm rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                >
                  {METODOS.map((m) => (
                    <option key={m.id} value={m.id}>{m.icono} {m.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={linea.monto}
                  onChange={(e) => actualizarLinea(idx, { monto: e.target.value })}
                  className="w-24 bg-white border border-slate-200 text-slate-900 text-sm rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 text-right font-medium"
                />
                {pagos.length > 1 && (
                  <button onClick={() => quitarLinea(idx)} className="text-slate-300 hover:text-rose-500 text-sm px-1 transition-colors">✕</button>
                )}
              </div>
              {linea.metodo === 'transferencia' && (
                <select
                  value={linea.bancoId ?? ''}
                  onChange={(e) => actualizarLinea(idx, { bancoId: e.target.value ? Number(e.target.value) : null })}
                  className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                >
                  <option value="">— Seleccionar banco —</option>
                  {bancos.map((b) => (
                    <option key={b.id} value={b.id}>{b.nombre}</option>
                  ))}
                </select>
              )}
            </div>
          ))}

          <div className={`flex justify-between text-xs font-medium px-1 ${faltante === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
            <span>{faltante === 0 ? 'Cubierto completamente' : faltante > 0 ? 'Falta cubrir' : 'Excede el total'}</span>
            <span>${Math.abs(faltante).toFixed(2)}</span>
          </div>
        </div>

        {usaCredito && (
          <div className="space-y-2">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Cliente (porción a crédito)</p>
            <SelectorCliente
              establecimientoId={establecimientoId}
              clienteSeleccionado={cliente}
              onSeleccionar={(c) => { setCliente(c); resetearAutorizacion() }}
            />
          </div>
        )}

        {errorCredito && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-xl px-3.5 py-2.5">
            {errorCredito}
          </div>
        )}

        {excedeLimite && !autorizado && !mostrarPin && (
          <button
            onClick={() => setMostrarPin(true)}
            className="w-full bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-700 font-medium py-2.5 rounded-xl transition-colors text-sm"
          >
            🔒 Solicitar autorización de supervisor
          </button>
        )}

        {mostrarPin && !autorizado && (
          <div className="bg-slate-50 rounded-xl p-3.5 space-y-2.5">
            <p className="text-amber-700 text-xs font-medium">PIN de supervisor</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinIngresado}
              onChange={(e) => setPinIngresado(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-300 text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all"
            />
            {errorPin && <p className="text-rose-600 text-xs">{errorPin}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleValidarPin}
                disabled={validandoPin}
                className="flex-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors text-sm"
              >
                {validandoPin ? 'Validando…' : 'Autorizar'}
              </button>
              <button
                onClick={() => { setMostrarPin(false); setPinIngresado(''); setErrorPin(null) }}
                className="px-4 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {autorizado && (
          <div className="bg-emerald-50 text-emerald-700 text-xs rounded-xl px-3.5 py-2.5 flex items-center gap-1.5">
            ✅ Venta autorizada por supervisor
          </div>
        )}

        <button
          onClick={handleConfirmar}
          disabled={isProcesando || (excedeLimite && !autorizado)}
          className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
        >
          {isProcesando ? 'Procesando…' : 'Confirmar venta'}
        </button>
      </div>
    </div>
  )
}