'use client'
import type { GrupoVendedor, MetodoPago } from '@/types'

const METODOS: { value: MetodoPago; label: string; icon: string }[] = [
  { value: 'efectivo',      label: 'Efectivo',      icon: '💵' },
  { value: 'tarjeta',       label: 'Tarjeta',       icon: '💳' },
  { value: 'transferencia', label: 'Transferencia', icon: '🏦' },
  { value: 'mixto',         label: 'Mixto',         icon: '🔀' },
]
const DOT: Record<number, string> = { 1: 'bg-blue-500', 2: 'bg-green-500', 3: 'bg-amber-500' }
const fmt = (n: number) => `$${n.toFixed(2)}`

interface Props {
  grupos: GrupoVendedor[]
  total: number; totalItems: number
  metodoPago: MetodoPago; procesando: boolean
  onCambiarCantidad: (id: number, delta: number) => void
  onEliminar: (id: number) => void
  onVaciar: () => void
  onMetodoPago: (m: MetodoPago) => void
  onCobrar: () => void
}

export function CartPanel({ grupos, total, totalItems, metodoPago, procesando, onCambiarCantidad, onEliminar, onVaciar, onMetodoPago, onCobrar }: Props) {
  const empty = grupos.length === 0
  return (
    <aside className="flex h-full flex-col border-l border-gray-100 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-gray-900">Carrito</h2>
          {totalItems > 0 && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-medium text-white">{totalItems}</span>}
        </div>
        {!empty && <button onClick={onVaciar} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Vaciar</button>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
            <span className="text-3xl">🛒</span><p className="text-sm">El carrito está vacío</p>
          </div>
        ) : (
          <div className="py-2">
            {grupos.map(({ vendedor, items, subtotal }) => (
              <div key={vendedor.id}>
                <div className="flex items-center gap-2 px-4 py-1.5">
                  <div className="h-px flex-1 bg-gray-100" />
                  <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${DOT[vendedor.id] ?? 'bg-gray-400'}`} />
                    {vendedor.nombre}
                  </span>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>
                {items.map(({ producto, cantidad, subtotal: sub }) => (
                  <div key={producto.id} className="group flex items-center gap-2.5 px-4 py-2 hover:bg-gray-50 transition-colors">
                    <span className="text-lg">{producto.categoria?.icono ?? '📦'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-gray-900">{producto.nombre}</p>
                      <p className="text-[11px] text-gray-400">{fmt(producto.precio_venta)} c/u</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => onCambiarCantidad(producto.id, -1)} className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 text-xs hover:bg-gray-100">−</button>
                      <span className="min-w-[18px] text-center text-xs font-medium text-gray-900">{cantidad}</span>
                      <button onClick={() => onCambiarCantidad(producto.id, 1)} className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 text-xs hover:bg-gray-100">+</button>
                    </div>
                    <span className="min-w-[52px] text-right text-xs font-medium text-gray-900">{fmt(sub)}</span>
                    <button onClick={() => onEliminar(producto.id)} className="ml-1 text-gray-200 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all">✕</button>
                  </div>
                ))}
                <div className="flex justify-between px-4 pb-1 pt-0.5">
                  <span className="text-[11px] text-gray-400">Subtotal {vendedor.nombre}</span>
                  <span className="text-[11px] font-medium text-gray-600">{fmt(subtotal)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 px-4 pt-3 pb-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-gray-700">Total a pagar</span>
          <span className="text-2xl font-semibold text-gray-900">{fmt(total)}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {METODOS.map(({ value, label, icon }) => (
            <button key={value} onClick={() => onMetodoPago(value)}
              className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-all
                ${metodoPago === value ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-white'}`}>
              {icon} {label}
            </button>
          ))}
        </div>
        <button onClick={onCobrar} disabled={empty || procesando}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all
            ${empty || procesando ? 'cursor-not-allowed bg-gray-100 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'}`}>
          {procesando
            ? <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Procesando…</>
            : <>🧾 Cobrar {!empty && fmt(total)}</>}
        </button>
      </div>
    </aside>
  )
}
