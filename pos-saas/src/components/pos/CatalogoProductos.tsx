'use client'

import { useProductos } from '@/core/hooks/useProductos'
import { useCarrito } from '@/core/context/CarritoContext'
import type { SlotProps } from '@/core/types/modulos.types'

export default function CatalogoProductos({ establecimiento, sucursalId }: SlotProps) {
  const { productos, isLoading, error } = useProductos(establecimiento.id, sucursalId)
  const { agregarItem, ultimoEscaneadoId } = useCarrito()

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-slate-800 rounded-xl aspect-square animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Error al cargar productos: {error}</p>
      </div>
    )
  }

  if (productos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-400 text-sm">No hay productos visibles en el catálogo</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {productos.map((producto) => {
          const precio = producto.lote_activo?.precio_venta_sugerido ?? producto.precio_venta
          const stock = producto.lote_activo?.stock_lote ?? producto.stock_actual
          const resaltado = ultimoEscaneadoId === producto.id

          return (
            <button
              key={producto.id}
              onClick={() => agregarItem(producto)}
              className={`text-left bg-slate-800 rounded-xl p-4 border transition-all duration-200 ${
                resaltado
                  ? 'border-indigo-500 ring-2 ring-indigo-500/50 scale-[1.02]'
                  : 'border-slate-700 hover:border-indigo-500'
              }`}
            >
              <div className="w-full aspect-square bg-slate-700 rounded-lg mb-3 flex items-center justify-center text-3xl overflow-hidden">
                {producto.imagen_url ? (
                  <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-cover" />
                ) : (
                  '📦'
                )}
              </div>
              <p className="text-slate-100 text-sm font-medium truncate">{producto.nombre}</p>
              <div className="flex justify-between items-center mt-1">
                <span className="text-indigo-400 font-semibold text-sm">${precio.toFixed(2)}</span>
                <span className="text-slate-500 text-xs">{stock} uds</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}