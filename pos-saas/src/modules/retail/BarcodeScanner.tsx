'use client'

import { useState, useRef } from 'react'
import { useProductos } from '@/core/hooks/useProductos'
import { useCarrito } from '@/core/context/CarritoContext'
import type { SlotProps } from '@/core/types/modulos.types'

export default function BarcodeScanner({ establecimiento, sucursalId }: SlotProps) {
  const [codigo, setCodigo] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { buscarPorCodigoBarras, productos } = useProductos(establecimiento.id, sucursalId)
  const { agregarItem } = useCarrito()
  const [sugerencias, setSugerencias] = useState<typeof productos>([])
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)

  function handleChange(valor: string) {
    setCodigo(valor)
    if (valor.length >= 2) {
      const filtro = productos.filter(p =>
        p.nombre.toLowerCase().includes(valor.toLowerCase()) ||
        (p.codigo_barras ?? '').includes(valor)
      ).slice(0, 6)
      setSugerencias(filtro)
      setMostrarSugerencias(true)
    } else {
      setSugerencias([])
      setMostrarSugerencias(false)
    }
  }

  function seleccionar(producto: typeof productos[0]) {
    agregarItem(producto, establecimiento.permite_venta_sin_stock)
    setCodigo('')
    setSugerencias([])
    setMostrarSugerencias(false)
    inputRef.current?.focus()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!codigo.trim()) return
    const porCodigo = buscarPorCodigoBarras(codigo.trim())
    if (porCodigo) {
      seleccionar(porCodigo)
      return
    }
    if (sugerencias.length === 1) {
      seleccionar(sugerencias[0])
    }
    setCodigo('')
    setSugerencias([])
    setMostrarSugerencias(false)
    inputRef.current?.focus()
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 border-b border-slate-700">
      <form onSubmit={handleSubmit} className="flex-1 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">📷</span>
        <input
          ref={inputRef}
          type="text"
          value={codigo}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
          onFocus={() => codigo.length >= 2 && setMostrarSugerencias(true)}
          placeholder="Escanea o escribe el código o nombre..."
          autoFocus
          className="w-full bg-slate-700 text-slate-100 placeholder-slate-400 text-sm rounded-lg pl-9 pr-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
        />
        {mostrarSugerencias && sugerencias.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 rounded-xl border border-slate-600 bg-slate-800 shadow-xl z-[999] max-h-48 overflow-y-auto">
            {sugerencias.map(p => (
              <button
                key={p.id}
                type="button"
                onPointerDown={e => { e.preventDefault(); seleccionar(p) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-700 text-slate-200 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-700 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {p.imagen_url
                    ? <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
                    : <span className="text-base">📦</span>
                  }
                </div>
                <span className="flex-1 truncate text-left">{p.nombre}</span>
                <span className="flex-shrink-0 text-indigo-400 font-semibold">
                  ${(p.lote_activo?.precio_venta_sugerido ?? p.precio_venta).toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        )}
      </form>
      <span className="text-xs text-slate-400 font-medium tracking-wide uppercase hidden sm:block">
        {establecimiento.nombre}
      </span>
    </div>
  )
}