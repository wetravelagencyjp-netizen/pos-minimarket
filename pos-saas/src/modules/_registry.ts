import type { ModuloConfig, BusinessType } from '@/core/types/modulos.types'
import { RetailModule } from './retail'

// ─── Cascarón vacío reutilizable ──────────────────────────────
// Todos los slots en null = el POS usa los componentes Core por defecto.
// Cuando implementemos un giro real, reemplazamos los null por componentes reales.
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
  retail:         RetailModule,
  restaurant:     moduloVacio('Restaurante / Cafetería'),
  medical_clinic: moduloVacio('Clínica Médica'),
  veterinary:     moduloVacio('Veterinaria'),
  services:       moduloVacio('Servicios / Comisiones'),
  boutique:       moduloVacio('Boutique / Moda'),
  wholesale:      moduloVacio('Mayorista'),
  isp:            moduloVacio('ISP / WISP'),
}

// ─── Función de acceso seguro ─────────────────────────────────
// Usar esta función en lugar de acceder al registry directamente.
// Protege contra business_type desconocidos o futuros sin registrar.
export function getModulo(businessType: BusinessType): ModuloConfig {
  return MODULE_REGISTRY[businessType] ?? moduloVacio('Módulo desconocido')
}