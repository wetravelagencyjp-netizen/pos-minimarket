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
export type UserRole = 'super_admin' | 'owner' | 'admin_sucursal' | 'vendedor'

// ─── Estado de suscripción del tenant ────────────────────────
export type EstadoSuscripcion = 'activo' | 'suspendido_por_falta_de_pago' | 'demo'

// ─── Estrategia de precio del tenant ─────────────────────────
export type EstrategiasPrecio =
  | 'porcentaje_sobre_costo'
  | 'monto_fijo_dolares'
  | 'margen_comercial_real'

// ─── Datos del tenant que vienen de Supabase ─────────────────
export interface Tenant {
  id: string
  nombre_comercio: string
  business_type: BusinessType
  estado_suscripcion: EstadoSuscripcion
  estrategia_precio_defecto: EstrategiasPrecio
  creado_en: string
}

// ─── Perfil del usuario autenticado ──────────────────────────
export interface PerfilUsuario {
  id: string
  tenant_id: string
  sucursal_id: string | null
  nombre: string
  rol: UserRole
}

// ─── Props que recibe cualquier componente de slot ────────────
export interface SlotProps {
  tenant: Tenant
  perfil: PerfilUsuario
  sucursalId: string | null
}

// ─── Firma de componente válido para un slot ──────────────────
export type SlotComponent = ComponentType<SlotProps>

// ─── Configuración completa de un módulo de giro ─────────────
export interface ModuloConfig {
  displayName: string
  topBarSlot:       SlotComponent | null
  catalogoSlot:     SlotComponent | null
  carritoSlot:      SlotComponent | null
  alertaSlot:       SlotComponent | null
  clienteExtraSlot: SlotComponent | null
}