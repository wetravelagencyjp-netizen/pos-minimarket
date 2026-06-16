'use client'
import type { Producto } from '@/types'

const VC: Record<number, { dot: string; label: string }> = {
  1: { dot: 'bg-indigo-500',  label: 'text-indigo-700'  },
  2: { dot: 'bg-emerald-500', label: 'text-emerald-700' },
  3: { dot: 'bg-amber-500',   label: 'text-amber-700'   },
}

export function ProductCard({ producto, onAgregar, modoMultivendedor = true }: { producto: Producto; onAgregar: (p: Producto) => void; modoMultivendedor?: boolean }) {
  const vc = VC[producto.vendedor_id] ?? { dot: 'bg-slate-400', label: 'text-slate-500' }
  const sinStock = producto.stock_actual === 0
  const stockBajo = producto.stock_actual <= producto.stock_minimo && !sinStock
  const imagenUrl = (producto as any).imagen_url as string | null | undefined

  return (
    <button
      onClick={() => !sinStock && onAgregar(producto)}
      disabled={sinStock}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border text-left transition-all duration-150 select-none
        ${sinStock ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-50'
          : 'cursor-pointer border-slate-100 bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]'}`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
        {imagenUrl ? (
          <img src={imagenUrl} alt={producto.nombre} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-4xl">
            {producto.categoria?.icono ?? '📦'}
          </div>
        )}
        {sinStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-medium text-white">Agotado</span>
          </div>
        )}
        {producto.codigo_barras && (
          <span className="absolute right-1.5 top-1.5 rounded bg-slate-900/50 px-1 py-0.5 font-mono text-[8px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
            {producto.codigo_barras}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <span className="line-clamp-2 text-xs font-medium leading-tight text-slate-800">{producto.nombre}</span>
        {modoMultivendedor && (
          <span className={`flex items-center gap-1 text-[10px] ${vc.label}`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${vc.dot}`} />
            {producto.vendedor?.nombre ?? `Vendedor #${producto.vendedor_id}`}
          </span>
        )}
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="text-sm font-semibold text-slate-800">${producto.precio_venta.toFixed(2)}</span>
          <span className={`text-[10px] ${stockBajo ? 'font-medium text-amber-600' : 'text-slate-400'}`}>
            {stockBajo ? `⚠ ${producto.stock_actual}` : `${producto.stock_actual} uds`}
          </span>
        </div>
      </div>
    </button>
  )
}