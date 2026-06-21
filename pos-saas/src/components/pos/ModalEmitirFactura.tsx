'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface ModalEmitirFacturaProps {
  ventaId: number
  numeroComprobanteVenta: string
  establecimientoId: number
  total: number
  onCerrar: () => void
  onEmitido: () => void
}

interface ClienteCandidato {
  identificacion: string
  razon_social: string
  direccion: string | null
  email: string | null
  tipo_identificacion: string | null
}

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
  const [candidatos, setCandidatos] = useState<ClienteCandidato[]>([])
  const [mostrarLista, setMostrarLista] = useState(false)
  const [clienteElegido, setClienteElegido] = useState(false)

  useEffect(() => {
    if (clienteElegido || identificacion.length < 3) {
      setCandidatos([])
      return
    }
    setBuscando(true)
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('clientes')
        .select('identificacion, razon_social, direccion, email, tipo_identificacion')
        .eq('establecimiento_id', establecimientoId)
        .or(`identificacion.ilike.%${identificacion}%,razon_social.ilike.%${identificacion}%`)
        .limit(6)
      setCandidatos((data as ClienteCandidato[]) ?? [])
      setBuscando(false)
    }, 400)
    return () => clearTimeout(timeout)
  }, [identificacion, establecimientoId, clienteElegido])

  function elegirCandidato(c: ClienteCandidato) {
    setIdentificacion(c.identificacion)
    setRazonSocial(c.razon_social ?? '')
    setDireccion(c.direccion ?? '')
    setEmail(c.email ?? '')
    setTipoIdentificacion(c.tipo_identificacion ?? 'cedula')
    setClienteElegido(true)
    setMostrarLista(false)
    setCandidatos([])
  }

  async function emitir() {
    setError(null)
    if (!identificacion.trim() || !razonSocial.trim()) {
      setError('Identificación y razón social son obligatorios')
      return
    }
    setEmitiendo(true)

    // Traer detalle real de la venta con nombre/código de barras del producto
    // (el motor de generar-xml necesita estos campos para el XML del SRI).
    const { data: detalle } = await supabase
      .from('detalle_ventas')
      .select('producto_id, cantidad, precio_unitario, producto:productos(nombre, codigo_barras, lleva_iva)')
      .eq('venta_id', ventaId)

    const detallesPayload = (detalle ?? []).map((d: any) => ({
      codigo_barras: d.producto?.codigo_barras ?? null,
      nombre: d.producto?.nombre ?? 'Producto',
      cantidad: d.cantidad,
      precio_unitario: d.precio_unitario,
      descuento: 0,
      tiene_iva: d.producto?.lleva_iva !== false,
    }))

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/usuarios/sri/generar-xml', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        venta_id: ventaId,
        cliente: {
          identificacion: identificacion.trim(),
          tipo_identificacion: tipoIdentificacion,
          razon_social: razonSocial.trim(),
          direccion: direccion.trim() || null,
          email: email.trim() || null,
        },
        detalles: detallesPayload,
      }),
    })
    const data = await res.json()

    if (!res.ok || !data.ok) {
      setError(data.error ?? 'No se pudo generar el comprobante')
      setEmitiendo(false)
      return
    }

    const { data: vinculo, error: errorVinculo } = await supabase.rpc('vincular_sri_comprobante', {
      p_venta_id: ventaId,
      p_sri_comprobante_id: data.comprobante_id,
    })

    setEmitiendo(false)
    if (errorVinculo || !vinculo?.ok) {
      setError(errorVinculo?.message ?? 'Comprobante creado pero no se pudo vincular a la venta')
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
          <div className="relative">
            <input
              value={identificacion}
              onChange={(e) => { setIdentificacion(e.target.value); setClienteElegido(false); setMostrarLista(true) }}
              onFocus={() => setMostrarLista(true)}
              placeholder="Cédula, RUC o nombre"
              className="w-full bg-slate-700 text-slate-100 placeholder-slate-400 text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {mostrarLista && identificacion.length >= 3 && !clienteElegido && (
              <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg max-h-44 overflow-y-auto shadow-lg">
                {buscando ? (
                  <p className="text-slate-400 text-xs p-2.5">Buscando…</p>
                ) : candidatos.length === 0 ? (
                  <p className="text-slate-400 text-xs p-2.5">Sin coincidencias — se usará como nuevo</p>
                ) : (
                  candidatos.map((c) => (
                    <button
                      key={c.identificacion}
                      onClick={() => elegirCandidato(c)}
                      className="w-full text-left px-2.5 py-2 hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-0"
                    >
                      <p className="text-slate-100 text-xs">{c.razon_social}</p>
                      <p className="text-slate-400 text-[11px]">{c.identificacion}</p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

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
          {emitiendo ? 'Generando XML...' : 'Crear comprobante (PENDIENTE)'}
        </button>
      </div>
    </div>
  )
}