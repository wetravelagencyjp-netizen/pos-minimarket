'use client'

import { useState, useRef } from 'react'
import { useProductos } from '@/core/hooks/useProductos'
import { useCarrito } from '@/core/context/CarritoContext'
import type { SlotProps } from '@/core/types/modulos.types'

export default function BarcodeScanner({ establecimiento, sucursalId }: SlotProps) {
  const [codigo, setCodigo] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { buscarPorCodigoBarras } = useProductos(establecimiento.id, sucursalId)
  const { agregarItem } = useCarrito()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!codigo.trim()) return

    const producto = buscarPorCodigoBarras(codigo.trim())
    if (producto) {
      agregarItem(producto)
    }

    setCodigo('')
    inputRef.current?.focus()
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 border-b border-slate-700">
      <form onSubmit={handleSubmit} className="flex-1 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
          📷
        </span>
        <input
          ref={inputRef}
          type="text"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Escanea o escribe el código de barras..."
          autoFocus
          className="w-full bg-slate-700 text-slate-100 placeholder-slate-400 text-sm rounded-lg pl-9 pr-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
        />
      </form>
      <span className="text-xs text-slate-400 font-medium tracking-wide uppercase">
        {establecimiento.nombre}
      </span>
    </div>
  )
}