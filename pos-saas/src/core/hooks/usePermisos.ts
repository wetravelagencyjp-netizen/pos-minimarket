import { useEstablecimiento } from '@/core/context/EstablecimientoContext'
import type { UserRole } from '@/core/types/modulos.types'

// ─── Jerarquía de roles (mayor número = más acceso) ───────────
const JERARQUIA: Record<UserRole, number> = {
  super_admin:    5,
  owner:          4,
  admin:          3,
  admin_sucursal: 2,
  vendedor:       1,
}

export function usePermisos() {
  const { usuario } = useEstablecimiento()
  const rol = usuario?.rol ?? 'vendedor'

  const tieneRol = (rolMinimo: UserRole): boolean =>
    JERARQUIA[rol] >= JERARQUIA[rolMinimo]

  return {
    puedeVerGlobal:         tieneRol('owner'),
    puedeEditarProductos:   tieneRol('admin'),
    puedeGestionarUsuarios: tieneRol('owner'),
    puedeVerReportes:       tieneRol('admin'),
    puedeAplicarDescuentos: tieneRol('admin'),
    puedeAccederAdmin:      tieneRol('admin'),
    rol,
  }
}