'use client'

import { useState, useEffect } from 'react'
import { useCarrito } from '@/core/context/CarritoContext'
import { useRegistrarVenta, type MetodoPago } from '@/core/hooks/useRegistrarVenta'
import SelectorCliente, { type ClienteConCredito } from './SelectorCliente'
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
  const [resultado, setResultado] = useState<{ numeroComprobante: string } | null>(null)
  const [cliente, setCliente] = useState<ClienteConCredito | null>(null)
  const [errorCredito, setErrorCredito] = useState<string | null>(null)
  const [excedeLimite, setExcedeLimite] = useState(false)
  const [autorizado, setAutorizado] = useState(false)
  const [mostrarPin, setMostrarPin] = useState(false)
  const [pinIngresado, setPinIngresado] = useState('')
  const [validandoPin, setValidandoPin] = useState(false)
  const [errorPin, setErrorPin] = useState<string | null>(null)
  const [bancos, setBancos] = useState<{ id: number; nombre: string }[]>([])

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

    const metodoPrincipal: MetodoPago = pagos.length > 1 ? pagos[0].metodo : pagos[0].metodo
    const bancoPrincipal = pagos.find((p) => p.metodo === 'transferencia')?.bancoId ?? null

    const res = await registrarVenta({
      establecimientoId,
      vendedorId: null,
      clienteId: usaCredito ? cliente!.id : null,
      cajaId: null,
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
      setResultado({ numeroComprobante: res.numeroComprobante })
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
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 bg-emerald-500/20 rounded-full mx-auto flex items-center justify-center text-2xl">
            ✅
          </div>
          <h3 className="text-slate-100 font-semibold text-lg">Venta registrada</h3>
          <p className="text-slate-400 text-sm">Comprobante: {resultado.numeroComprobante}</p>
          {pagos.length > 1 && (
            <div className="bg-slate-700/50 rounded-xl p-3 text-left space-y-1">
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Pago dividido</p>
              {pagos.map((p, i) => (
                <div key={i} className="flex justify-between text-xs text-slate-300">
                  <span>{METODOS.find((m) => m.id === p.metodo)?.label}</span>
                  <span>${(parseFloat(p.monto) || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => { vaciarCarrito(); onClose() }}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-slate-100 font-semibold text-lg">Confirmar cobro</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">✕</button>
        </div>

        <div className="bg-slate-700/50 rounded-xl p-4 flex justify-between items-center">
          <span className="text-slate-400 text-sm">Total a cobrar</span>
          <span className="text-slate-100 font-bold text-2xl">${total.toFixed(2)}</span>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-slate-400 text-xs uppercase tracking-wide">Métodos de pago</p>
            {faltante > 0 && (
              <button onClick={agregarLinea} className="text-indigo-400 hover:text-indigo-300 text-xs font-medium">
                + Dividir pago
              </button>
            )}
          </div>

          {pagos.map((linea, idx) => (
            <div key={idx} className="bg-slate-700/50 rounded-xl p-3 space-y-2">
              <div className="flex gap-2 items-center">
                <select
                  value={linea.metodo}
                  onChange={(e) => actualizarLinea(idx, { metodo: e.target.value as MetodoPago, bancoId: null })}
                  className="flex-1 bg-slate-800 text-slate-100 text-sm rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="w-24 bg-slate-800 text-slate-100 text-sm rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                />
                {pagos.length > 1 && (
                  <button onClick={() => quitarLinea(idx)} className="text-slate-500 hover:text-red-400 text-sm px-1">✕</button>
                )}
              </div>
              {linea.metodo === 'transferencia' && (
                <select
                  value={linea.bancoId ?? ''}
                  onChange={(e) => actualizarLinea(idx, { bancoId: e.target.value ? Number(e.target.value) : null })}
                  className="w-full bg-slate-800 text-slate-100 text-xs rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Seleccionar banco —</option>
                  {bancos.map((b) => (
                    <option key={b.id} value={b.id}>{b.nombre}</option>
                  ))}
                </select>
              )}
            </div>
          ))}

          <div className={`flex justify-between text-xs font-medium px-1 ${faltante === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            <span>{faltante === 0 ? 'Cubierto completamente' : faltante > 0 ? 'Falta cubrir' : 'Excede el total'}</span>
            <span>${Math.abs(faltante).toFixed(2)}</span>
          </div>
        </div>

        {usaCredito && (
          <div className="space-y-2">
            <p className="text-slate-400 text-xs uppercase tracking-wide">Cliente (porción a crédito)</p>
            <SelectorCliente
              establecimientoId={establecimientoId}
              clienteSeleccionado={cliente}
              onSeleccionar={(c) => { setCliente(c); resetearAutorizacion() }}
            />
          </div>
        )}

        {errorCredito && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2.5">
            {errorCredito}
          </div>
        )}

        {excedeLimite && !autorizado && !mostrarPin && (
          <button
            onClick={() => setMostrarPin(true)}
            className="w-full bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 font-medium py-2.5 rounded-xl transition-colors text-sm"
          >
            🔒 Solicitar Autorización de Supervisor
          </button>
        )}

        {mostrarPin && !autorizado && (
          <div className="bg-slate-700/50 rounded-xl p-3 space-y-2">
            <p className="text-amber-400 text-xs font-medium">PIN de supervisor</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinIngresado}
              onChange={(e) => setPinIngresado(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-amber-500 transition-all"
            />
            {errorPin && <p className="text-red-400 text-xs">{errorPin}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleValidarPin}
                disabled={validandoPin}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-900 font-semibold py-2 rounded-lg transition-colors text-sm"
              >
                {validandoPin ? 'Validando...' : 'Autorizar'}
              </button>
              <button
                onClick={() => { setMostrarPin(false); setPinIngresado(''); setErrorPin(null) }}
                className="px-4 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-lg transition-colors text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {autorizado && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-lg px-3 py-2.5 flex items-center gap-1.5">
            ✅ Venta autorizada por supervisor — puedes confirmar
          </div>
        )}

        <button
          onClick={handleConfirmar}
          disabled={isProcesando || (excedeLimite && !autorizado)}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {isProcesando ? 'Procesando...' : 'Confirmar venta'}
        </button>
      </div>
    </div>
  )
}