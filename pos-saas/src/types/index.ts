// ============================================================
// Tipos TypeScript — espejo exacto del esquema SQL
// ============================================================

export interface Establecimiento {
  id: number
  nombre: string
  ruc_nit: string | null
  direccion: string | null
  // ── Campos SaaS ──────────────────────────────────────────
  estado_suscripcion: boolean
  fecha_vencimiento: string   // formato ISO: "2025-12-31"
  url_pago: string | null
  creado_en: string
}

export interface Vendedor {
  id: number
  establecimiento_id: number
  nombre: string
  telefono: string | null
  porcentaje_comision: number
  creado_en: string
}

export interface Categoria {
  id: number
  establecimiento_id: number
  nombre: string
  icono: string | null
}

export interface Producto {
  id: number
  establecimiento_id: number
  vendedor_id: number
  categoria_id: number | null
  codigo_barras: string | null
  nombre: string
  precio_venta: number
  precio_costo: number | null
  stock_actual: number
  stock_minimo: number
  creado_en: string
  vendedor?: Vendedor
  categoria?: Categoria
}

export interface Usuario {
  id: string
  establecimiento_id: number
  nombre: string | null
  rol: 'admin' | 'cajero'
  creado_en: string
  establecimiento?: Establecimiento
}

export interface Venta {
  id: number
  establecimiento_id: number
  numero_comprobante: string
  total: number
  metodo_pago: MetodoPago
  cliente_id: number | null
  fecha_venta: string
}

export interface DetalleVenta {
  id: number
  venta_id: number
  producto_id: number
  vendedor_id: number
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto' | 'fiado'

export interface Cliente {
  id: number
  establecimiento_id: number
  identificacion: string
  tipo_identificacion: 'cedula' | 'ruc' | 'pasaporte' | 'consumidor_final'
  razon_social: string
  direccion: string | null
  email: string | null
  telefono: string | null
  limite_credito: number
  saldo_pendiente: number
}

export interface AbonoCliente {
  id: number
  establecimiento_id: number
  cliente_id: number
  monto: number
  metodo_pago: string | null
  nota: string | null
  usuario_id: string | null
  fecha: string
}

export interface ItemCarrito {
  producto: Producto
  cantidad: number
  subtotal: number
}

export interface GrupoVendedor {
  vendedor: Vendedor
  items: ItemCarrito[]
  subtotal: number
}

// ── Estado de suscripción (calculado en el cliente) ──────────
export type EstadoSuscripcion = 'activa' | 'vencida' | 'suspendida'

export function calcularEstadoSuscripcion(est: Establecimiento): EstadoSuscripcion {
  if (!est.estado_suscripcion) return 'suspendida'
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const vencimiento = new Date(est.fecha_vencimiento + 'T00:00:00')
  if (hoy > vencimiento) return 'vencida'
  return 'activa'
}

// Días restantes de suscripción (negativo = vencida)
export function diasRestantes(fechaVencimiento: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const venc = new Date(fechaVencimiento + 'T00:00:00')
  return Math.round((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}