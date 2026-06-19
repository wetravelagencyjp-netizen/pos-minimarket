import { useEstablecimiento } from '@/core/context/EstablecimientoContext'
import type { UserRole } from '@/core/types/modulos.types'

// ─── Jerarquía de roles (mayor número = más acceso) ───────────
const JERARQUIA: Record<UserRole, number> = {
  super_admin:    4,
  owner:          3,
  admin_sucursal: 2,
  vendedor:       1,
}

export function usePermisos() {
  const { perfil } = useEstablecimiento()
  const rol = perfil?.rol ?? 'vendedor'

  const tieneRol = (rolMinimo: UserRole): boolean =>
    JERARQUIA[rol] >= JERARQUIA[rolMinimo]

  return {
    puedeVerGlobal:         tieneRol('owner'),
    puedeEditarProductos:   tieneRol('admin_sucursal'),
    puedeGestionarUsuarios: tieneRol('owner'),
    puedeVerReportes:       tieneRol('admin_sucursal'),
    puedeAplicarDescuentos: tieneRol('admin_sucursal'),
    puedeAccederAdmin:      tieneRol('admin_sucursal'),
    rol,
  }
}