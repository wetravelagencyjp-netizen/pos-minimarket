'use client'

import { useProductos } from '@/core/hooks/useProductos'
import type { SlotProps } from '@/core/types/modulos.types'

function diasRestantes(fechaCaducidad: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fecha = new Date(fechaCaducidad)
  fecha.setHours(0, 0, 0, 0)
  const diffMs = fecha.getTime() - hoy.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

export default function AlertaCaducidad({ establecimiento, sucursalId }: SlotProps) {
  const { productos, isLoading } = useProductos(establecimiento.id, sucursalId)

  if (isLoading) return null

  const diasAlerta = establecimiento.alerta_caducidad_dias
  const esLlamativo = establecimiento.alerta_caducidad_estilo === 'llamativo'

  const productosPorVencer = productos
    .filter((p) => p.lote_activo?.fecha_caducidad)
    .map((p) => ({
      nombre: p.nombre,
      dias: diasRestantes(p.lote_activo!.fecha_caducidad as string),
    }))
    .filter((p) => p.dias <= diasAlerta)
    .sort((a, b) => a.dias - b.dias)

  if (productosPorVencer.length === 0) return null

  const estiloContenedor = esLlamativo
    ? 'bg-amber-500 text-amber-950 px-4 py-2 border-b border-amber-600'
    : 'bg-slate-100 text-slate-600 px-4 py-1 border-b border-slate-200'

  return (
    <div className={`flex items-center gap-2 overflow-x-auto whitespace-nowrap ${estiloContenedor}`}>
      <span className={esLlamativo ? 'text-base shrink-0' : 'text-xs shrink-0'}>⚠️</span>
      <span className={esLlamativo ? 'font-bold text-sm shrink-0' : 'font-medium text-xs shrink-0'}>
        Por vencer:
      </span>
      <div className={`flex items-center gap-3 ${esLlamativo ? 'text-sm font-medium' : 'text-xs'}`}>
        {productosPorVencer.map((p, i) => (
          <span key={i} className="shrink-0">
            {p.nombre} —{' '}
            {p.dias < 0
              ? <strong className="text-red-700">vencido</strong>
              : p.dias === 0
              ? <strong className="text-red-700">vence hoy</strong>
              : <strong>{p.dias} día{p.dias === 1 ? '' : 's'}</strong>}
          </span>
        ))}
      </div>
    </div>
  )
}