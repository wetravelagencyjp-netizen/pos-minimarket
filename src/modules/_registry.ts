import type { ModuloConfig, BusinessType } from '@/core/types/modulos.types'

// ─── Cascarón vacío reutilizable ──────────────────────────────
// Todos los slots en null = el POS usa los componentes Core por defecto.
const moduloVacio = (displayName: string): ModuloConfig => ({
  displayName,
  topBarSlot:       null,
  catalogoSlot:     null,
  carritoSlot:      null,
  alertaSlot:       null,
  clienteExtraSlot: null,
})

// ─── Mapa central: business_type → módulo ────────────────────
export const MODULE_REGISTRY: Record<BusinessType, ModuloConfig> = {
  retail:         moduloVacio('Retail / Minimarket'),
  restaurant:     moduloVacio('Restaurante / Cafetería'),
  medical_clinic: moduloVacio('Clínica Médica'),
  veterinary:     moduloVacio('Veterinaria'),
  services:       moduloVacio('Servicios / Comisiones'),
  boutique:       moduloVacio('Boutique / Moda'),
  wholesale:      moduloVacio('Mayorista'),
  isp:            moduloVacio('ISP / WISP'),
}

// ─── Función de acceso seguro ─────────────────────────────────
export function getModulo(businessType: BusinessType): ModuloConfig {
  return MODULE_REGISTRY[businessType] ?? moduloVacio('Módulo desconocido')
}