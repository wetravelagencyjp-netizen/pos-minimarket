'use client'

import { useState } from 'react'
import { useCarrito } from '@/core/context/CarritoContext'
import { useRegistrarVenta, type MetodoPago } from '@/core/hooks/useRegistrarVenta'
import SelectorCliente, { type ClienteConCredito } from './SelectorCliente'
import { supabase } from '@/lib/supabase'
import { useEffect } from 'react'

interface CheckoutModalProps {
  establecimientoId: number
  onClose: () => void
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
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
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
  const [bancoId, setBancoId] = useState<number | null>(null)

  useEffect(() => {
    if (metodo !== 'transferencia') return
    supabase.from('bancos').select('id, nombre')
      .eq('establecimiento_id', establecimientoId).eq('activo', true).order('nombre')
      .then(({ data }) => setBancos(data ?? []))
  }, [metodo, establecimientoId])

  async function handleConfirmar() {
    setErrorCredito(null)

    if (metodo === 'credito') {
      if (!cliente) {
        setErrorCredito('Selecciona un cliente para registrar la venta a crédito.')
        return
      }
      const saldoResultante = cliente.saldo_pendiente + total
      if (saldoResultante > cliente.limite_credito && !autorizado) {
        setExcedeLimite(true)
        setErrorCredito(
          `Esta venta supera el límite de crédito del cliente. Disponible: $${(cliente.limite_credito - cliente.saldo_pendiente).toFixed(2)}`
        )
        return
      }
    }

    const res = await registrarVenta({
      establecimientoId,
      vendedorId: null,
      clienteId: metodo === 'credito' ? cliente!.id : null,
      cajaId: null,
      bancoId: metodo === 'transferencia' ? bancoId : null,
      items,
      total,
      metodoPago: metodo,
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

  function resetearAutorizacion() {
    setAutorizado(false)
    setExcedeLimite(false)
    setMostrarPin(false)
    setPinIngresado('')
    setErrorPin(null)
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
      <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-5">
        <div className="flex justify-between items-center">
          <h3 className="text-slate-100 font-semibold text-lg">Confirmar cobro</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">✕</button>
        </div>

        <div className="bg-slate-700/50 rounded-xl p-4 flex justify-between items-center">
          <span className="text-slate-400 text-sm">Total a cobrar</span>
          <span className="text-slate-100 font-bold text-2xl">${total.toFixed(2)}</span>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs uppercase tracking-wide">Método de pago</p>
          <div className="grid grid-cols-2 gap-2">
            {METODOS.map((m) => (
              <button
                key={m.id}
                onClick={() => { setMetodo(m.id); setErrorCredito(null); resetearAutorizacion() }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  metodo === m.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <span>{m.icono}</span>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {metodo === 'transferencia' && (
          <div className="space-y-2">
            <p className="text-slate-400 text-xs uppercase tracking-wide">Banco</p>
            <select
              value={bancoId ?? ''}
              onChange={(e) => setBancoId(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            >
              <option value="">— Seleccionar banco —</option>
              {bancos.map((b) => (
                <option key={b.id} value={b.id}>{b.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {metodo === 'credito' && (
          <div className="space-y-2">
            <p className="text-slate-400 text-xs uppercase tracking-wide">Cliente</p>
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