'use client'

import { useEffect } from 'react'
import { useProductos } from '@/core/hooks/useProductos'
import { useCarrito } from '@/core/context/CarritoContext'
import { useEstablecimiento } from '@/core/context/EstablecimientoContext'
import type { SlotProps } from '@/core/types/modulos.types'

export default function CatalogoProductos({ establecimiento, sucursalId, ventaCount = 0 }: SlotProps & { ventaCount?: number }) {
  const { productos, isLoading, error, recargar } = useProductos(establecimiento.id, sucursalId)

  useEffect(() => {
    if (ventaCount > 0) recargar()
  }, [ventaCount])
  const { agregarItem, ultimoEscaneadoId } = useCarrito()
  const { tema } = useEstablecimiento()
  const esOscuro = tema === 'oscuro'

  const bgFondo = esOscuro ? 'bg-zinc-900' : 'bg-white'
  const bgCard = esOscuro ? 'bg-zinc-800/60 border-zinc-700/50' : 'bg-white border-slate-200'
  const bgImagen = esOscuro ? 'bg-zinc-800' : 'bg-slate-100'
  const textTitulo = esOscuro ? 'text-zinc-100' : 'text-slate-900'
  const textPrecio = esOscuro ? 'text-emerald-400' : 'text-indigo-600'
  const textStock = esOscuro ? 'text-zinc-500' : 'text-slate-500'
  const borderHover = esOscuro ? 'hover:border-zinc-500' : 'hover:border-indigo-400'

  if (isLoading) {
    return (
      <div className={`flex-1 overflow-y-auto p-4 ${bgFondo}`}>
        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`${bgCard} rounded-xl aspect-square animate-pulse`} />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex-1 flex items-center justify-center ${bgFondo}`}>
        <p className={`${textStock} text-sm`}>Error al cargar productos: {error}</p>
      </div>
    )
  }

  if (productos.length === 0) {
    return (
      <div className={`flex-1 flex items-center justify-center ${bgFondo}`}>
        <p className={`${textStock} text-sm`}>No hay productos visibles en el catálogo</p>
      </div>
    )
  }

  return (
    <div className={`flex-1 overflow-y-auto p-2 sm:p-4 ${bgFondo}`}>
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {productos.map((producto) => {
          const precio = producto.lote_activo?.precio_venta_sugerido ?? producto.precio_venta
          const stock = producto.lote_activo?.stock_lote ?? producto.stock_actual
          const resaltado = ultimoEscaneadoId === producto.id

          const sinStock = stock <= 0 && !establecimiento.permite_venta_sin_stock
          return (
            <button
              key={producto.id}
              onClick={() => { if (!sinStock) agregarItem(producto, establecimiento.permite_venta_sin_stock) }}
              disabled={sinStock}
              className={`text-left ${bgCard} rounded-xl p-4 border transition-all duration-200 ${
                sinStock ? 'opacity-40 cursor-not-allowed' : ''
              } ${
                resaltado
                  ? `${esOscuro ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-indigo-500 ring-2 ring-indigo-500/50'} scale-[1.02]`
                  : sinStock ? '' : borderHover
              }`}
            >
              <div className={`w-full aspect-square ${bgImagen} rounded-lg mb-3 flex items-center justify-center text-3xl overflow-hidden`}>
                {producto.imagen_url ? (
                  <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-cover" />
                ) : (
                  '📦'
                )}
              </div>
              <p className={`${textTitulo} text-sm font-medium truncate`}>{producto.nombre}</p>
              <div className="flex justify-between items-center mt-1">
                <span className={`${textPrecio} font-semibold text-sm`}>${precio.toFixed(2)}</span>
                <span className={`${textStock} text-xs`}>{stock} uds</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}