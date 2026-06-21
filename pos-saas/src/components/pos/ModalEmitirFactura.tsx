'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface ItemDetalle {
  producto_id: number
  cantidad: number
  precio_unitario: number
}

interface ModalEmitirFacturaProps {
  ventaId: number
  numeroComprobanteVenta: string
  establecimientoId: number
  total: number
  onCerrar: () => void
  onEmitido: () => void
}

const TASA_IVA = 0.15

export default function ModalEmitirFactura({
  ventaId, numeroComprobanteVenta, establecimientoId, total, onCerrar, onEmitido,
}: ModalEmitirFacturaProps) {
  const [tipoIdentificacion, setTipoIdentificacion] = useState('cedula')
  const [identificacion, setIdentificacion] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [direccion, setDireccion] = useState('')
  const [email, setEmail] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [emitiendo, setEmitiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (identificacion.length < 5) return
    setBuscando(true)
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('clientes')
        .select('razon_social, direccion, email, tipo_identificacion')
        .eq('establecimiento_id', establecimientoId)
        .eq('identificacion', identificacion)
        .maybeSingle()
      if (data) {
        setRazonSocial(data.razon_social ?? '')
        setDireccion(data.direccion ?? '')
        setEmail(data.email ?? '')
        setTipoIdentificacion(data.tipo_identificacion ?? 'cedula')
      }
      setBuscando(false)
    }, 500)
    return () => clearTimeout(timeout)
  }, [identificacion, establecimientoId])

  async function emitir() {
    setError(null)
    if (!identificacion.trim() || !razonSocial.trim()) {
      setError('Identificación y razón social son obligatorios')
      return
    }
    setEmitiendo(true)

    // Desglose calculado SOLO al emitir, sobre el total de la venta.
    // Tasa fija 15% (Ecuador) — no toca registrar_venta_completa ni detalle_ventas.
    const { data: detalle } = await supabase
      .from('detalle_ventas')
      .select('producto_id, cantidad, precio_unitario')
      .eq('venta_id', ventaId)

    const { data: productosData } = await supabase
      .from('productos')
      .select('id, lleva_iva')
      .in('id', (detalle ?? []).map((d: ItemDetalle) => d.producto_id))

    const mapaIva = new Map((productosData ?? []).map((p) => [p.id, p.lleva_iva]))

    let baseConIva = 0
    let baseSinIva = 0
    for (const item of (detalle ?? []) as ItemDetalle[]) {
      const subtotalItem = item.cantidad * item.precio_unitario
      if (mapaIva.get(item.producto_id) === false) {
        baseSinIva += subtotalItem
      } else {
        baseConIva += subtotalItem
      }
    }
    const ivaCalculado = +(baseConIva * TASA_IVA).toFixed(2)
    const subtotalSinImpuesto = +(baseConIva + baseSinIva).toFixed(2)

    const { data: comprobante, error: errorComprobante } = await supabase
      .from('sri_comprobantes')
      .insert({
        establecimiento_id: establecimientoId,
        venta_id: ventaId,
        tipo_comprobante: 'factura',
        numero_comprobante: numeroComprobanteVenta,
        estado: 'PENDIENTE',
        fecha_emision: new Date().toISOString(),
        cliente_identificacion: identificacion.trim(),
        cliente_tipo_identificacion: tipoIdentificacion,
        cliente_razon_social: razonSocial.trim(),
        cliente_direccion: direccion.trim() || null,
        cliente_email: email.trim() || null,
        subtotal_sin_impuesto: subtotalSinImpuesto,
        subtotal_iva: +baseConIva.toFixed(2),
        iva: ivaCalculado,
        total,
      })
      .select('id')
      .single()

    if (errorComprobante || !comprobante) {
      setError(errorComprobante?.message ?? 'No se pudo crear el comprobante')
      setEmitiendo(false)
      return
    }

    const { data: vinculo, error: errorVenta } = await supabase.rpc('vincular_sri_comprobante', {
      p_venta_id: ventaId,
      p_sri_comprobante_id: comprobante.id,
    })

    setEmitiendo(false)
    if (errorVenta || !vinculo?.ok) {
      setError(errorVenta?.message ?? 'No se pudo vincular la factura a la venta')
      return
    }
    onEmitido()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-slate-100 font-semibold text-lg">🧾 Emitir Factura SRI</h3>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-200 transition-colors">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            value={tipoIdentificacion}
            onChange={(e) => setTipoIdentificacion(e.target.value)}
            className="bg-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="cedula">Cédula</option>
            <option value="ruc">RUC</option>
            <option value="pasaporte">Pasaporte</option>
            <option value="consumidor_final">Consumidor Final</option>
          </select>
          <input
            value={identificacion}
            onChange={(e) => setIdentificacion(e.target.value)}
            placeholder="Identificación"
            className="bg-slate-700 text-slate-100 placeholder-slate-400 text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        {buscando && <p className="text-xs text-slate-400">Buscando cliente…</p>}

        <input
          value={razonSocial}
          onChange={(e) => setRazonSocial(e.target.value)}
          placeholder="Razón social / Nombre"
          className="w-full bg-slate-700 text-slate-100 placeholder-slate-400 text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          placeholder="Dirección (opcional)"
          className="w-full bg-slate-700 text-slate-100 placeholder-slate-400 text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (opcional)"
          className="w-full bg-slate-700 text-slate-100 placeholder-slate-400 text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2.5">
            {error}
          </div>
        )}

        <button
          onClick={emitir}
          disabled={emitiendo}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {emitiendo ? 'Emitiendo...' : 'Crear comprobante (PENDIENTE)'}
        </button>
      </div>
    </div>
  )
}