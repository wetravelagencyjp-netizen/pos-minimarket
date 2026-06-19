'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface ClienteConCredito {
  id: number
  razon_social: string
  identificacion: string
  limite_credito: number
  saldo_pendiente: number
}

interface SelectorClienteProps {
  establecimientoId: number
  clienteSeleccionado: ClienteConCredito | null
  onSeleccionar: (cliente: ClienteConCredito | null) => void
}

export default function SelectorCliente({
  establecimientoId,
  clienteSeleccionado,
  onSeleccionar,
}: SelectorClienteProps) {
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<ClienteConCredito[]>([])
  const [buscando, setBuscando] = useState(false)
  const [mostrarLista, setMostrarLista] = useState(false)

  const buscar = useCallback(async (texto: string) => {
    setBusqueda(texto)
    if (texto.trim().length < 2) {
      setResultados([])
      return
    }
    setBuscando(true)
    const { data } = await supabase
      .from('clientes')
      .select('id, razon_social, identificacion, limite_credito, saldo_pendiente')
      .eq('establecimiento_id', establecimientoId)
      .or(`razon_social.ilike.%${texto}%,identificacion.ilike.%${texto}%`)
      .limit(8)

    setResultados((data as ClienteConCredito[]) ?? [])
    setBuscando(false)
  }, [establecimientoId])

  if (clienteSeleccionado) {
    const disponible = clienteSeleccionado.limite_credito - clienteSeleccionado.saldo_pendiente
    return (
      <div className="bg-slate-700/50 rounded-xl p-3 space-y-2">
        <div className="flex justify-between items-start gap-2">
          <div>
            <p className="text-slate-100 text-sm font-medium">{clienteSeleccionado.razon_social}</p>
            <p className="text-slate-400 text-xs">{clienteSeleccionado.identificacion}</p>
          </div>
          <button
            onClick={() => onSeleccionar(null)}
            className="text-slate-400 hover:text-red-400 text-xs transition-colors"
          >
            Cambiar
          </button>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Saldo actual: ${clienteSeleccionado.saldo_pendiente.toFixed(2)}</span>
          <span className={disponible >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            Disponible: ${disponible.toFixed(2)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={busqueda}
        onChange={(e) => { buscar(e.target.value); setMostrarLista(true) }}
        onFocus={() => setMostrarLista(true)}
        placeholder="Buscar cliente por nombre o cédula/RUC..."
        className="w-full bg-slate-700 text-slate-100 placeholder-slate-400 text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
      />

      {mostrarLista && busqueda.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg max-h-48 overflow-y-auto shadow-lg">
          {buscando ? (
            <p className="text-slate-400 text-xs p-3">Buscando...</p>
          ) : resultados.length === 0 ? (
            <p className="text-slate-400 text-xs p-3">Sin resultados</p>
          ) : (
            resultados.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onSeleccionar(c)
                  setBusqueda('')
                  setResultados([])
                  setMostrarLista(false)
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-0"
              >
                <p className="text-slate-100 text-sm">{c.razon_social}</p>
                <p className="text-slate-400 text-xs">{c.identificacion}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}