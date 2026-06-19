'use client'

import { useEstablecimiento } from '@/core/context/EstablecimientoContext'
import { getModulo } from '@/modules/_registry'
import type { SlotProps } from '@/core/types/modulos.types'

// ─── Slot genérico: Barra superior ────────────────────────────
function TopBarDefault({ tenant }: SlotProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 border-b border-slate-700">
      <input
        type="text"
        placeholder="Buscar producto o escanear código..."
        className="flex-1 bg-slate-700 text-slate-100 placeholder-slate-400 text-sm
                   rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500
                   transition-all"
      />
      <span className="text-xs text-slate-400 font-medium tracking-wide uppercase">
        {tenant.nombre_comercio}
      </span>
    </div>
  )
}

// ─── Slot genérico: Catálogo de productos ─────────────────────
function CatalogoDefault(_props: SlotProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-slate-800 rounded-xl p-4 border border-slate-700
                       hover:border-indigo-500 cursor-pointer
                       transition-all duration-200 group"
          >
            <div className="w-full aspect-square bg-slate-700 rounded-lg mb-3
                            group-hover:bg-slate-600 transition-colors" />
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
  return (
    <div className="w-80 flex flex-col bg-slate-800 border-l border-slate-700 h-full">

      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700">
        <h2 className="text-slate-100 font-semibold text-sm tracking-wide">
          Venta actual
        </h2>
      </div>

      {/* Carrito vacío */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-slate-700 rounded-full mx-auto mb-3
                          flex items-center justify-center">
            <span className="text-2xl">🛒</span>
          </div>
          <p className="text-slate-400 text-sm">Carrito vacío</p>
          <p className="text-slate-500 text-xs mt-1">
            Selecciona un producto para comenzar
          </p>
        </div>
      </div>

      {/* Footer con total y botón cobrar */}
      <div className="p-4 border-t border-slate-700 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-sm">Total</span>
          <span className="text-slate-100 font-bold text-xl">$0.00</span>
        </div>
        <button
          disabled
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700
                     disabled:text-slate-500 text-white font-semibold py-3 rounded-xl
                     transition-all duration-200 text-sm tracking-wide"
        >
          Cobrar
        </button>
      </div>
    </div>
  )
}

// ─── Skeleton Loader (mientras carga el contexto) ─────────────
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
  const { tenant, perfil, sucursalId, isLoading, error } = useEstablecimiento()

  // Muestra skeleton mientras carga
  if (isLoading) return <PosSkeletonLoader />

  // Error de sesión
  if (error || !tenant || !perfil) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="text-center space-y-3">
          <p className="text-slate-400 text-sm">
            {error ?? 'No se pudo cargar la sesión'}
          </p>
      
href="/login"
            className="inline-block text-indigo-400 hover:text-indigo-300 text-sm underline transition-colors"
          >
            Volver al inicio
          </a>
          
        </div>
      </div>
    )
  }

  // Obtiene el módulo según el giro del negocio
  const modulo = getModulo(tenant.business_type)

  // Props compartidas para todos los slots
  const slotProps: SlotProps = { tenant, perfil, sucursalId }

  // Resuelve cada slot: módulo real o genérico del Core
  const TopBar   = modulo.topBarSlot   ?? TopBarDefault
  const Catalogo = modulo.catalogoSlot ?? CatalogoDefault
  const Carrito  = modulo.carritoSlot  ?? CarritoDefault

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 overflow-hidden">

      {/* Alerta flotante: solo si el módulo tiene alertaSlot activo */}
      {modulo.alertaSlot && <modulo.alertaSlot {...slotProps} />}

      {/* Barra superior */}
      <TopBar {...slotProps} />

      {/* Cuerpo principal */}
      <div className="flex flex-1 overflow-hidden">
        <Catalogo {...slotProps} />
        <Carrito  {...slotProps} />
      </div>

    </div>
  )
}