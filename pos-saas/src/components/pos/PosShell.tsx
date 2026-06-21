'use client'

import { useEstablecimiento } from '@/core/context/EstablecimientoContext'
import { getModulo } from '@/modules/_registry'
import { useCarrito } from '@/core/context/CarritoContext'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CheckoutModal from './CheckoutModal'
import type { SlotProps } from '@/core/types/modulos.types'

// ─── Slot genérico: Barra superior ────────────────────────────
function TopBarDefault({ establecimiento }: SlotProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 border-b border-slate-700">
      <input
        type="text"
        placeholder="Buscar producto o escanear código..."
        className="flex-1 bg-slate-700 text-slate-100 placeholder-slate-400 text-sm rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
      />
      <span className="text-xs text-slate-400 font-medium tracking-wide uppercase">
        {establecimiento.nombre}
      </span>
    </div>
  )
}

// ─── Slot genérico: Catálogo de productos ─────────────────────
function CatalogoDefault({ establecimiento, sucursalId }: SlotProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-indigo-500 cursor-pointer transition-all duration-200"
          >
            <div className="w-full aspect-square bg-slate-700 rounded-lg mb-3 flex items-center justify-center text-3xl">
              📦
            </div>
            <div className="h-3 bg-slate-700 rounded w-3/4 mb-2" />
            <div className="h-3 bg-slate-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Slot genérico: Panel de carrito ──────────────────────────
function CarritoDefault(_props: SlotProps) {
  const { items, total, cambiarCantidad, quitarItem } = useCarrito()
  const [mostrarCheckout, setMostrarCheckout] = useState(false)
  const router = useRouter()

  if (items.length === 0) {
    return (
      <div className="w-80 flex flex-col bg-slate-800 border-l border-slate-700 h-full">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-2">
          <h2 className="text-slate-100 font-semibold text-sm tracking-wide">Venta actual</h2>
          <div className="flex items-center gap-2">
            {_props.usuario.rol === 'admin' && (
              <button onClick={() => router.push('/admin')} className="text-slate-400 hover:text-indigo-400 text-xs transition-colors">
                ⚙️ Admin
              </button>
            )}
            {(_props.usuario as any).es_superadmin && (
              <button onClick={() => router.push('/superadmin')} className="text-slate-400 hover:text-amber-400 text-xs transition-colors">
                ⚡ Super
              </button>
            )}
            <button onClick={() => router.push('/caja')} className="text-slate-400 hover:text-indigo-400 text-xs transition-colors">
              💰 Caja
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 bg-slate-700 rounded-full mx-auto mb-3 flex items-center justify-center">
              <span className="text-2xl">🛒</span>
            </div>
            <p className="text-slate-400 text-sm">Carrito vacío</p>
            <p className="text-slate-500 text-xs mt-1">Selecciona un producto para comenzar</p>
          </div>
        </div>
        <div className="p-4 border-t border-slate-700 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Total</span>
            <span className="text-slate-100 font-bold text-xl">$0.00</span>
          </div>
          <button disabled className="w-full bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl transition-all duration-200 text-sm tracking-wide">
            Cobrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-80 flex flex-col bg-slate-800 border-l border-slate-700 h-full">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-2">
        <h2 className="text-slate-100 font-semibold text-sm tracking-wide">Venta actual</h2>
        <div className="flex items-center gap-2">
          {_props.usuario.rol === 'admin' && (
            <button onClick={() => router.push('/admin')} className="text-slate-400 hover:text-indigo-400 text-xs transition-colors">
              ⚙️ Admin
            </button>
          )}
          {(_props.usuario as any).es_superadmin && (
            <button onClick={() => router.push('/superadmin')} className="text-slate-400 hover:text-amber-400 text-xs transition-colors">
              ⚡ Super
            </button>
          )}
          <button onClick={() => router.push('/caja')} className="text-slate-400 hover:text-indigo-400 text-xs transition-colors">
            💰 Caja
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {items.map((item) => (
          <div key={item.productoId} className="bg-slate-700/50 rounded-lg p-3">
            <div className="flex justify-between items-start gap-2">
              <p className="text-slate-100 text-sm font-medium flex-1 flex items-center gap-1.5">
                {item.nombre}
                {item.esReserva && (
                  <span className="bg-amber-500/15 text-amber-400 text-[10px] font-semibold px-1.5 py-0.5 rounded">Reserva</span>
                )}
              </p>
              <button
                onClick={() => quitarItem(item.productoId)}
                className="text-slate-500 hover:text-red-400 text-xs transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex justify-between items-center mt-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => cambiarCantidad(item.productoId, item.cantidad - 1)}
                  className="w-6 h-6 rounded bg-slate-600 hover:bg-slate-500 text-slate-100 text-sm transition-colors"
                >
                  −
                </button>
                <span className="text-slate-100 text-sm w-6 text-center">{item.cantidad}</span>
                <button
                  onClick={() => cambiarCantidad(item.productoId, item.cantidad + 1, _props.establecimiento.permite_venta_sin_stock)}
                  disabled={item.cantidad >= item.stockDisponible && !_props.establecimiento.permite_venta_sin_stock}
                  className="w-6 h-6 rounded bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-slate-100 text-sm transition-colors"
                >
                  +
                </button>
              </div>
              <span className="text-indigo-400 font-semibold text-sm">
                ${(item.precioUnitario * item.cantidad).toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-slate-700 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-sm">Total</span>
          <span className="text-slate-100 font-bold text-xl">${total.toFixed(2)}</span>
        </div>
        <button
          onClick={() => setMostrarCheckout(true)}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-all duration-200 text-sm tracking-wide"
        >
          Cobrar
        </button>
        {mostrarCheckout && (
          <CheckoutModal
            establecimientoId={_props.establecimiento.id}
            onClose={() => setMostrarCheckout(false)}
          />
        )}
      </div>
    </div>
  )
}

// ─── Skeleton Loader ───────────────────────────────────────────
function PosSkeletonLoader() {
  return (
    <div className="flex flex-col h-screen bg-slate-900 animate-pulse">
      <div className="h-12 bg-slate-800 border-b border-slate-700" />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 p-4 grid grid-cols-3 lg:grid-cols-4 gap-3 content-start">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-slate-800 rounded-xl aspect-square" />
          ))}
        </div>
        <div className="w-80 bg-slate-800 border-l border-slate-700" />
      </div>
    </div>
  )
}

// ─── PosShell: Orquestador principal ──────────────────────────
export function PosShell() {
  const { establecimiento, usuario, sucursalId, isLoading, error } = useEstablecimiento()

  if (isLoading) return <PosSkeletonLoader />

  if (error || !establecimiento || !usuario) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="text-center space-y-3">
          <p className="text-slate-400 text-sm">
            {error ?? 'No se pudo cargar la sesión'}
          </p>
          <a href="/login" className="inline-block text-indigo-400 hover:text-indigo-300 text-sm underline transition-colors">
            Volver al inicio
          </a>
        </div>
      </div>
    )
  }

  const modulo = getModulo(establecimiento.business_type)
  const slotProps: SlotProps = { establecimiento, usuario, sucursalId }

  const TopBar   = modulo.topBarSlot   ?? TopBarDefault
  const Catalogo = modulo.catalogoSlot ?? CatalogoDefault
  const Carrito  = modulo.carritoSlot  ?? CarritoDefault

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {modulo.alertaSlot && <modulo.alertaSlot {...slotProps} />}

      <TopBar {...slotProps} />

      <div className="flex flex-1 overflow-hidden">
        <Catalogo {...slotProps} />
        <Carrito {...slotProps} />
      </div>
    </div>
  )
}