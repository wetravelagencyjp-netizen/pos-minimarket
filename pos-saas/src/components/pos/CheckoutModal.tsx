'use client'

import { useState } from 'react'
import { useCarrito } from '@/core/context/CarritoContext'
import { useRegistrarVenta, type MetodoPago } from '@/core/hooks/useRegistrarVenta'
import SelectorCliente, { type ClienteConCredito } from './SelectorCliente'

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

  async function handleConfirmar() {
    setErrorCredito(null)

    if (metodo === 'credito') {
      if (!cliente) {
        setErrorCredito('Selecciona un cliente para registrar la venta a crédito.')
        return
      }
      const saldoResultante = cliente.saldo_pendiente + total
      if (saldoResultante > cliente.limite_credito) {
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
      items,
      total,
      metodoPago: metodo,
    })

    if (res.success && res.numeroComprobante) {
      setResultado({ numeroComprobante: res.numeroComprobante })
      vaciarCarrito()
    } else if (res.error) {
      setErrorCredito(res.error)
    }
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
            onClick={onClose}
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
                onClick={() => { setMetodo(m.id); setErrorCredito(null) }}
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

        {metodo === 'credito' && (
          <div className="space-y-2">
            <p className="text-slate-400 text-xs uppercase tracking-wide">Cliente</p>
            <SelectorCliente
              establecimientoId={establecimientoId}
              clienteSeleccionado={cliente}
              onSeleccionar={setCliente}
            />
          </div>
        )}

        {errorCredito && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2.5">
            {errorCredito}
          </div>
        )}

        <button
          onClick={handleConfirmar}
          disabled={isProcesando}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {isProcesando ? 'Procesando...' : 'Confirmar venta'}
        </button>
      </div>
    </div>
  )
}