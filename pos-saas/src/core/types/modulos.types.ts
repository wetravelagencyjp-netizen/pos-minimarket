import type { ComponentType } from 'react'

// ─── Giros de negocio soportados ──────────────────────────────
export type BusinessType =
  | 'retail'
  | 'restaurant'
  | 'medical_clinic'
  | 'veterinary'
  | 'services'
  | 'boutique'
  | 'wholesale'
  | 'isp'

// ─── Roles del sistema ────────────────────────────────────────
export type UserRole = 'super_admin' | 'owner' | 'admin_sucursal' | 'vendedor' | 'admin'

// ─── Estado de cuenta del establecimiento ─────────────────────
export type EstadoCuenta = 'activo' | 'suspendido' | 'demo'

// ─── Datos del establecimiento (tabla real: establecimientos) ─
export interface Establecimiento {
  id: number
  nombre: string
  ruc_nit: string | null
  direccion: string | null
  estado_suscripcion: boolean
  estado_cuenta: EstadoCuenta
  fecha_vencimiento: string
  plan_actual: string | null
  limite_productos: number | null
  modo_multivendedor: boolean
  margen_costo_estimado: number | null
  business_type: BusinessType
  creado_en: string
  alerta_caducidad_dias: number
  alerta_caducidad_estilo: 'discreto' | 'llamativo'
  permite_venta_sin_stock: boolean
  pais: string
  ancho_recibo: '80mm' | '58mm' | null
  logo_url: string | null
}

// ─── Perfil del usuario autenticado (tabla real: usuarios) ────
export interface Usuario {
  id: string
  establecimiento_id: number
  sucursal_id: number | null
  nombre: string | null
  email: string | null
  rol: UserRole
  es_superadmin: boolean
}

// ─── Props que recibe cualquier componente de slot ────────────
export interface SlotProps {
  establecimiento: Establecimiento
  usuario: Usuario
  sucursalId: number | null
}

// ─── Firma de componente válido para un slot ──────────────────
export type SlotComponent = ComponentType<SlotProps>

// ─── Configuración completa de un módulo de giro ───────────────
export interface ModuloConfig {
  displayName: string
  topBarSlot:       SlotComponent | null
  catalogoSlot:     SlotComponent | null
  carritoSlot:      SlotComponent | null
  alertaSlot:       SlotComponent | null
  clienteExtraSlot: SlotComponent | null
}