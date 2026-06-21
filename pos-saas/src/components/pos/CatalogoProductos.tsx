'use client'

import { useState, useRef } from 'react'
import { useProductos } from '@/core/hooks/useProductos'
import { useCarrito } from '@/core/context/CarritoContext'
import { useEstablecimiento } from '@/core/context/EstablecimientoContext'
import type { SlotProps } from '@/core/types/modulos.types'

export default function BarcodeScanner({ establecimiento, sucursalId }: SlotProps) {
  const [codigo, setCodigo] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { tema } = useEstablecimiento()
  const esOscuro = tema === 'oscuro'

  const { buscarPorCodigoBarras } = useProductos(establecimiento.id, sucursalId)
  const { agregarItem } = useCarrito()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!codigo.trim()) return

    const producto = buscarPorCodigoBarras(codigo.trim())
    if (producto) {
      agregarItem(producto, establecimiento.permite_venta_sin_stock)
    }

    setCodigo('')
    inputRef.current?.focus()
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-2 border-b ${esOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'}`}>
      <form onSubmit={handleSubmit} className="flex-1 relative">
        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${esOscuro ? 'text-zinc-500' : 'text-slate-400'}`}>
          📷
        </span>
        <input
          ref={inputRef}
          type="text"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Escanea o escribe el código de barras..."
          autoFocus
          className={`w-full text-sm rounded-lg pl-9 pr-4 py-2 outline-none transition-all ${
            esOscuro
              ? 'bg-zinc-800 text-zinc-100 placeholder-zinc-500 focus:ring-2 focus:ring-emerald-500/30'
              : 'bg-slate-100 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500'
          }`}
        />
      </form>
      <span className={`text-xs font-medium tracking-wide uppercase ${esOscuro ? 'text-zinc-500' : 'text-slate-400'}`}>
        {establecimiento.nombre}
      </span>
    </div>
  )
}