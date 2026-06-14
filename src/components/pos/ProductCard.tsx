'use client'
import type { Producto } from '@/types'

const VC: Record<number, { dot: string; label: string }> = {
  1: { dot: 'bg-blue-500',  label: 'text-blue-700'  },
  2: { dot: 'bg-green-500', label: 'text-green-700' },
  3: { dot: 'bg-amber-500', label: 'text-amber-700' },
}

export function ProductCard({ producto, onAgregar }: { producto: Producto; onAgregar: (p: Producto) => void }) {
  const vc = VC[producto.vendedor_id] ?? { dot: 'bg-gray-400', label: 'text-gray-500' }
  const sinStock = producto.stock_actual === 0
  const stockBajo = producto.stock_actual <= producto.stock_minimo && !sinStock

  return (
    <button
      onClick={() => !sinStock && onAgregar(producto)}
      disabled={sinStock}
      className={`group relative flex flex-col gap-2 rounded-xl border p-3 text-left transition-all duration-150 select-none
        ${sinStock ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-40'
          : 'cursor-pointer border-gray-200 bg-white hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-sm active:scale-[0.98]'}`}
    >
      <span className="text-2xl leading-none">{producto.categoria?.icono ?? '📦'}</span>
      <span className="line-clamp-2 text-xs font-medium leading-tight text-gray-900">{producto.nombre}</span>
      <span className={`flex items-center gap-1 text-[10px] ${vc.label}`}>
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${vc.dot}`} />
        {producto.vendedor?.nombre ?? `Vendedor #${producto.vendedor_id}`}
      </span>
      <div className="mt-auto flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">${producto.precio_venta.toFixed(2)}</span>
        <span className={`text-[10px] ${stockBajo ? 'font-medium text-orange-500' : 'text-gray-400'}`}>
          {stockBajo ? `⚠ ${producto.stock_actual}` : `${producto.stock_actual} uds`}
        </span>
      </div>
      {producto.codigo_barras && (
        <span className="absolute right-2 top-2 font-mono text-[9px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
          {producto.codigo_barras}
        </span>
      )}
    </button>
  )
}
