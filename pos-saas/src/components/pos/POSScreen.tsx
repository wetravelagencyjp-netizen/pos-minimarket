'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useInventario, useCarrito } from '@/hooks'
import { supabase } from '@/lib/supabase'
import { ProductCard } from './ProductCard'
import { CartPanel } from './CartPanel'
import { diasRestantes } from '@/types'
import type { Producto, GrupoVendedor, MetodoPago, Cliente } from '@/types'

type ToastTipo = 'ok' | 'error' | 'factura'
type Toast = { mensaje: string; tipo: ToastTipo; claveAcceso?: string; whatsapp?: { telefono: string; mensaje: string } }
type TipoDocumento = 'ticket' | 'factura'

function construirMensajeWhatsApp(data: {
  clienteNombre: string
  nombreNegocio: string
  comprobante: string
  fecha: string
  grupos: GrupoVendedor[]
  total: number
  metodoPago: MetodoPago
  efectivoRecibido?: number
  vuelto?: number
  claveAcceso?: string
}) {
  const fmt = (n: number) => `$${n.toFixed(2)}`
  const metodoLabel: Record<MetodoPago, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', mixto: 'Mixto', fiado: 'Crédito' }
  const lineasProductos = data.grupos.flatMap(g =>
    g.items.map(i => `• ${i.producto.nombre} x${i.cantidad} - ${fmt(i.subtotal)}`)
  ).join('\n')

  let mensaje = `¡Hola ${data.clienteNombre || ''}! 👋\n\n`
  mensaje += `Gracias por tu compra en *${data.nombreNegocio}*\n\n`
  mensaje += `🧾 Comprobante: ${data.comprobante}\n`
  mensaje += `📅 Fecha: ${data.fecha}\n\n`
  mensaje += `*Detalle de tu compra:*\n${lineasProductos}\n\n`
  mensaje += `*TOTAL: ${fmt(data.total)}*\n`
  mensaje += `Pago: ${metodoLabel[data.metodoPago]}\n`
  if (data.metodoPago === 'efectivo' && data.efectivoRecibido != null && data.vuelto != null) {
    mensaje += `Recibido: ${fmt(data.efectivoRecibido)}\n`
    mensaje += `Vuelto: ${fmt(data.vuelto)}\n`
  }
  if (data.claveAcceso) {
    mensaje += `\nPuedes consultar tu factura legal con la clave de acceso:\n${data.claveAcceso}\n\n`
  }
  mensaje += `¡Vuelve pronto! 😊`
  return mensaje
}

function abrirWhatsApp(telefono: string, mensaje: string) {
  const tel = telefono.replace(/[^\d+]/g, '')
  const url = `https://web.whatsapp.com/send?phone=${encodeURIComponent(tel)}&text=${encodeURIComponent(mensaje)}`
  window.open(url, '_blank')
}

function imprimirCotizacion(grupos: GrupoVendedor[], subtotal: number, descuentoTotal: number, total: number, numero: string, establecimiento: string, logoUrl?: string | null) {
  const fecha = new Date().toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })
  const fmt = (n: number) => `$${n.toFixed(2)}`
  const validoHasta = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('es-EC')

  const lineasGrupos = grupos.map(({ vendedor, items }: any) => `
    <div class="seccion">
      <div class="vendedor">— ${vendedor.nombre} —</div>
      ${items.map(({ producto, cantidad, subtotal: sub, descuento }: any) => `
        <div class="item">
          <div class="item-nombre">${producto.nombre}</div>
          <div class="item-detalle">
            <span>${cantidad} x ${fmt(producto.precio_venta)}</span>
            <span>${fmt(sub)}</span>
          </div>
          ${descuento > 0 ? `<div class="item-descuento">Descuento aplicado: −${fmt(descuento)}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `).join('<div class="separador"></div>')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cotización ${numero}</title>
  <style>
    * { margin:0;padding:0;box-sizing:border-box }
    body { font-family:'Courier New',monospace;font-size:11px;width:80mm;max-width:80mm;padding:4mm;color:#000 }
    .cabecera{text-align:center;margin-bottom:6px} .cabecera h1{font-size:13px;font-weight:bold} .cabecera p{font-size:10px;font-weight:bold}
    .linea{border-top:1px dashed #000;margin:6px 0} .info{display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px}
    .vendedor{text-align:center;font-weight:bold;font-size:10px;margin:6px 0 4px} .item{margin-bottom:4px} .item-nombre{font-size:11px}
    .item-detalle{display:flex;justify-content:space-between;font-size:10px;color:#333}
    .item-descuento{font-size:9px;color:#b45309;font-style:italic}
    .separador{border-top:1px dotted #999;margin:6px 0} .total{display:flex;justify-content:space-between;font-size:14px;font-weight:bold;margin-top:6px}
    .pie{text-align:center;font-size:9px;margin-top:8px;color:#555} .seccion{margin:4px 0}
    .aviso{text-align:center;font-size:9px;margin-top:8px;border-top:1px dashed #000;padding-top:6px;font-weight:bold}
    @media print{body{width:80mm}@page{size:80mm auto;margin:0}}
  </style></head><body>
  <div class="cabecera">
    ${logoUrl ? `<img src="${logoUrl}" alt="${establecimiento}" style="max-height:50px;max-width:60mm;margin:0 auto 4px;display:block" />` : `<h1>${establecimiento}</h1>`}
    <p>COTIZACIÓN / PROFORMA</p>
  </div>
  <div class="linea"></div>
  <div class="info"><span>Fecha:</span><span>${fecha}</span></div>
  <div class="info"><span>N°:</span><span>${numero}</span></div>
  <div class="linea"></div>
  ${lineasGrupos}
  <div class="linea"></div>
  <div class="info"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
  ${descuentoTotal > 0 ? `<div class="info"><span>Descuento aplicado</span><span>−${fmt(descuentoTotal)}</span></div>` : ''}
  <div class="total"><span>TOTAL</span><span>${fmt(total)}</span></div>
  <div class="aviso">Este documento no tiene validez tributaria.<br>Válido por 15 días (hasta ${validoHasta}).</div>
  <div class="pie">¡Gracias por su interés!</div>
  </body></html>`

  const ventana = window.open('', '_blank', 'width=320,height=600')
  if (!ventana) return
  ventana.document.write(html)
  ventana.document.close()
  ventana.focus()
  setTimeout(() => { ventana.print(); ventana.close() }, 300)
}

interface ClienteFactura {
  identificacion: string
  tipo_identificacion: 'cedula' | 'ruc' | 'pasaporte' | 'consumidor_final'
  razon_social: string
  direccion: string
  email: string
  telefono: string
  enviarWhatsApp: boolean
}
function ToastSRI({ toast, onClose }: { toast: Toast; onClose: () => void }) {

  useEffect(() => {
    const t = setTimeout(onClose, toast.tipo === 'factura' || toast.whatsapp ? 6000 : 2800)
    return () => clearTimeout(t)
  }, [toast, onClose])

  if (toast.tipo === 'factura' && toast.claveAcceso) {
    return (
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[420px] max-w-[95vw] md:bottom-6">
        <div className="rounded-2xl bg-slate-900 px-5 py-4 shadow-2xl ring-1 ring-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Factura generada con éxito</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Comprobante electrónico SRI</p>
              </div>
            </div>
            <button onClick={onClose} className="mt-0.5 text-slate-500 hover:text-slate-300 transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div className="mt-3 rounded-lg bg-white/5 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500 mb-1">Clave de acceso</p>
            <p className="font-mono text-[11px] text-emerald-400 break-all leading-relaxed">{toast.claveAcceso}</p>
          </div>
          {toast.whatsapp && (
            <button
              onClick={() => abrirWhatsApp(toast.whatsapp!.telefono, toast.whatsapp!.mensaje)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 active:scale-[0.98] transition-all">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 1.67c4.55 0 8.25 3.7 8.25 8.24 0 4.55-3.7 8.25-8.25 8.25-1.5 0-2.97-.4-4.25-1.16l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.25-4.38c0-4.55 3.7-8.24 8.24-8.24z"/></svg>
              Enviar Recibo por WhatsApp
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg md:bottom-5
      ${toast.tipo === 'ok' ? 'bg-slate-900 text-white' : 'bg-rose-600 text-white'}`}>
      <p>{toast.mensaje}</p>
      {toast.whatsapp && (
        <button
          onClick={() => abrirWhatsApp(toast.whatsapp!.telefono, toast.whatsapp!.mensaje)}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600 transition-colors">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 1.67c4.55 0 8.25 3.7 8.25 8.24 0 4.55-3.7 8.25-8.25 8.25-1.5 0-2.97-.4-4.25-1.16l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.25-4.38c0-4.55 3.7-8.24 8.24-8.24z"/></svg>
          Enviar Recibo por WhatsApp
        </button>
      )}
    </div>
  )
}

function ModalCliente({ onConfirmar, onCancelar, total, establecimientoId }: {
  onConfirmar: (cliente: ClienteFactura) => void
  onCancelar: () => void
  total: number
  establecimientoId: number
}) {
  const [form, setForm] = useState<ClienteFactura>({
    identificacion: '', tipo_identificacion: 'cedula',
    razon_social: '', direccion: 'Ecuador', email: '', telefono: '+593 ', enviarWhatsApp: false,
  })
  const [errores, setErrores] = useState<Partial<Record<keyof ClienteFactura, string>>>({})
  const [clienteEncontrado, setClienteEncontrado] = useState<boolean | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const len = form.tipo_identificacion === 'cedula' ? 10 : form.tipo_identificacion === 'ruc' ? 13 : null
    if (!len || form.identificacion.length !== len) { setClienteEncontrado(null); return }
    let activo = true
    supabase.from('clientes').select('*')
      .eq('establecimiento_id', establecimientoId)
      .eq('identificacion', form.identificacion)
      .maybeSingle()
      .then(({ data }) => {
        if (!activo) return
        if (data) {
          setForm(prev => ({
            ...prev,
            razon_social: data.razon_social ?? prev.razon_social,
            direccion: data.direccion || prev.direccion,
            email: data.email ?? prev.email,
            telefono: data.telefono || prev.telefono,
          }))
          setClienteEncontrado(true)
        } else {
          setClienteEncontrado(false)
        }
      })
    return () => { activo = false }
  }, [form.identificacion, form.tipo_identificacion, establecimientoId])

  const validar = () => {
    const e: typeof errores = {}
    if (!form.identificacion.trim()) e.identificacion = 'Requerido'
    else if (form.tipo_identificacion === 'cedula' && form.identificacion.length !== 10)
      e.identificacion = 'La cédula debe tener 10 dígitos'
    else if (form.tipo_identificacion === 'ruc' && form.identificacion.length !== 13)
      e.identificacion = 'El RUC debe tener 13 dígitos'
    if (!form.razon_social.trim()) e.razon_social = 'Requerido'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const set = (k: keyof ClienteFactura, v: string) => {
    setForm(prev => ({ ...prev, [k]: v }))
    if (errores[k]) setErrores(prev => ({ ...prev, [k]: undefined }))
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl mx-4">
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Datos del cliente</h2>
              <p className="text-xs text-slate-400 mt-0.5">Factura electrónica — Total: <span className="font-medium text-slate-600">${total.toFixed(2)}</span></p>
            </div>
            <button onClick={onCancelar} className="text-slate-400 hover:text-slate-600">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Tipo de identificación</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['cedula', 'ruc', 'pasaporte'] as const).map(tipo => (
                <button key={tipo} onClick={() => set('tipo_identificacion', tipo)}
                  className={`rounded-xl py-2 text-xs font-medium transition-all
                    ${form.tipo_identificacion === tipo ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {tipo === 'cedula' ? 'Cédula' : tipo === 'ruc' ? 'RUC' : 'Pasaporte'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Número</label>
            <input ref={inputRef} type="text" value={form.identificacion}
              onChange={e => set('identificacion', e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && validar() && onConfirmar(form)}
              placeholder={form.tipo_identificacion === 'cedula' ? '1234567890' : form.tipo_identificacion === 'ruc' ? '1234567890001' : 'Pasaporte'}
              className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition-all
                ${errores.identificacion ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50/50 focus:border-indigo-500 focus:bg-white'}`} />
            {errores.identificacion && <p className="text-[11px] text-rose-500 mt-1">{errores.identificacion}</p>}
            {clienteEncontrado === true && <p className="text-[11px] text-emerald-600 mt-1">✓ Cliente encontrado — datos autocompletados</p>}
            {clienteEncontrado === false && <p className="text-[11px] text-slate-400 mt-1">Cliente nuevo</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Nombre / Razón social</label>
            <input type="text" value={form.razon_social}
              onChange={e => set('razon_social', e.target.value.toUpperCase())}
              placeholder="JUAN PÉREZ GÓMEZ"
              className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition-all
                ${errores.razon_social ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50/50 focus:border-indigo-500 focus:bg-white'}`} />
            {errores.razon_social && <p className="text-[11px] text-rose-500 mt-1">{errores.razon_social}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Dirección <span className="text-slate-400 font-normal">(opcional)</span></label>
            <input type="text" value={form.direccion} onChange={e => set('direccion', e.target.value)}
              placeholder="Quito, Ecuador"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:bg-white" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Email <span className="text-slate-400 font-normal">(opcional)</span></label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="correo@ejemplo.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:bg-white" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Teléfono / WhatsApp <span className="text-slate-400 font-normal">(opcional)</span></label>
              <input type="tel" value={form.telefono} onChange={e => set('telefono', e.target.value)}
                placeholder="+593 99 999 9999"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:bg-white" />
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
            <input type="checkbox" id="wa-factura" checked={form.enviarWhatsApp}
              onChange={e => setForm(prev => ({ ...prev, enviarWhatsApp: e.target.checked }))}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <label htmlFor="wa-factura" className="text-xs text-emerald-700 flex-1">📱 El cliente desea recibir su factura por WhatsApp</label>
          </div>
        </div>
        <div className="border-t border-slate-100 px-6 py-4 flex gap-2">
          <button onClick={onCancelar} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button onClick={() => { if (validar()) onConfirmar(form) }}
            className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
            Generar factura
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalSeleccionarCliente({ onSeleccionar, onCancelar, establecimientoId }: {
  onSeleccionar: (cliente: Cliente) => void
  onCancelar: () => void
  establecimientoId: number
}) {
  const [busqueda, setBusqueda] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [buscando, setBuscando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (busqueda.trim().length < 2) { setClientes([]); return }
    let activo = true
    setBuscando(true)
    supabase.from('clientes')
      .select('*')
      .eq('establecimiento_id', establecimientoId)
      .or(`razon_social.ilike.%${busqueda}%,identificacion.ilike.%${busqueda}%`)
      .order('razon_social')
      .limit(10)
      .then(({ data }) => {
        if (!activo) return
        setClientes((data as Cliente[]) ?? [])
        setBuscando(false)
      })
    return () => { activo = false }
  }, [busqueda, establecimientoId])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl mx-4">
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">Seleccionar cliente para crédito</h2>
            <button onClick={onCancelar} className="text-slate-400 hover:text-slate-600">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div className="px-6 py-4">
          <input ref={inputRef} type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o cédula/RUC…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:bg-white" />
          <div className="mt-3 max-h-72 overflow-y-auto space-y-1.5">
            {buscando && <p className="text-center text-xs text-slate-400 py-4">Buscando…</p>}
            {!buscando && busqueda.trim().length >= 2 && clientes.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-4">No se encontraron clientes registrados con ese nombre o identificación. Pide al Admin que lo registre en Estado de Cuenta.</p>
            )}
            {busqueda.trim().length < 2 && (
              <p className="text-center text-xs text-slate-400 py-4">Escribe al menos 2 letras para buscar.</p>
            )}
            {clientes.map(c => (
              <button key={c.id} onClick={() => onSeleccionar(c)}
                className="w-full rounded-xl border border-slate-100 px-3 py-2.5 text-left hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                <p className="text-sm font-medium text-slate-800">{c.razon_social}</p>
                <p className="text-[11px] text-slate-400">{c.identificacion}</p>
                <p className="text-[11px] mt-0.5">
                  <span className="text-slate-500">Debe: </span>
                  <span className={c.saldo_pendiente > 0 ? 'font-medium text-rose-600' : 'text-emerald-600'}>${c.saldo_pendiente.toFixed(2)}</span>
                  <span className="text-slate-400"> / límite ${c.limite_credito.toFixed(2)}</span>
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function POSScreen({ establecimientoId }: { establecimientoId: number }) {
  const [catActiva, setCatActiva]       = useState<number | null>(null)
  const [vendedorActivo, setVendedorActivo] = useState<number | null>(null)
  const [searchQ, setSearchQ]           = useState('')
  const [toast, setToast]               = useState<Toast | null>(null)
  const [procesando, setProcesando]     if (res.ok) {
      let whatsapp: Toast['whatsapp']
      if (pagoInfo.whatsappTelefono?.trim()) {
  const [avisoLote, setAvisoLote]       = useState<{ nombre: string; precioAnterior: number; precioNuevo: number }[] | null>(null)
  const [tipoDoc, setTipoDoc]           = useState<TipoDocumento>('ticket')
  const [modalCliente, setModalCliente] = useState(false)
  const [carritoMovilAbierto, setCarritoMovilAbierto] = useState(false)
  const [clienteFiado, setClienteFiado] = useState<Cliente | null>(null)
  const [modalClienteFiado, setModalClienteFiado] = useState(false)
  const [pagoInfo, setPagoInfo]         = useState<{ efectivoRecibido?: number; vuelto?: number; whatsappTelefono?: string }>({})
  const searchRef                       = useRef<HTMLInputElement>(null)
  const { usuario, logout }             = useAuth()
  const router                          = useRouter()
  const modoMultivendedor               = (usuario?.establecimiento as any)?.modo_multivendedor ?? true

  const { productos, categorias, vendedores, loading, error, buscar, recargar } = useInventario(establecimientoId)
  const { grupos, total, totalItems, metodoPago, setMetodoPago, agregar, cambiarCantidad, eliminar, vaciar, procesarVenta,
    descuentosItem, setDescuentoItem, descuentoGlobal, setDescuentoGlobal, subtotalSinDescuento, descuentoTotalAplicado } = useCarrito(establecimientoId)

  const productosFiltrados = vendedorActivo ? productos.filter(p => p.vendedor_id === vendedorActivo) : productos

  const [cajaAbierta, setCajaAbierta]           = useState<boolean | null>(null)
  const [montoInicialCaja, setMontoInicialCaja] = useState('')
  const [abriendoCaja, setAbriendoCaja]         = useState(false)

  const verificarCaja = useCallback(async () => {
    const { data } = await supabase
      .from('cajas')
      .select('id')
      .eq('establecimiento_id', establecimientoId)
      .eq('estado', 'abierta')
      .limit(1)
      .maybeSingle()
    setCajaAbierta(!!data)
  }, [establecimientoId])

  useEffect(() => { verificarCaja() }, [verificarCaja])

  const abrirCajaDesdePOS = async () => {
    if (!montoInicialCaja) return
    setAbriendoCaja(true)
    await supabase.from('cajas').insert({
      establecimiento_id: establecimientoId,
      usuario_id: usuario?.id,
      monto_inicial: parseFloat(montoInicialCaja),
      estado: 'abierta',
    })
    setMontoInicialCaja('')
    setAbriendoCaja(false)
    verificarCaja()
  }

  const mostrarToast = useCallback((t: Toast) => setToast(t), [])
  const focusSearch  = useCallback(() => setTimeout(() => searchRef.current?.focus(), 100), [])

  const handleAgregar = useCallback((p: Producto) => {
    agregar(p)
    mostrarToast({ mensaje: `${p.categoria?.icono ?? '📦'} ${p.nombre} agregado`, tipo: 'ok' })
  }, [agregar, mostrarToast])

  const handleSearch    = useCallback((q: string) => { setSearchQ(q); buscar(q, catActiva) }, [buscar, catActiva])
  const handleCategoria = useCallback((id: number | null) => { setCatActiva(id); buscar(searchQ, id) }, [buscar, searchQ])

  const handleCamara = useCallback(() => {
    mostrarToast({ mensaje: '📷 Próximamente: lector de código de barras con la cámara', tipo: 'ok' })
  }, [mostrarToast])

  const cobrarConTicket = useCallback(async () => {
    setProcesando(true)
    const gruposSnapshot = [...grupos]
    const totalSnapshot = total
    const metodoSnapshot = metodoPago
    const res = await procesarVenta(metodoPago === 'fiado' ? clienteFiado?.id : undefined)
    setProcesando(false)
    if (res.ok) {
      if (res.cambiosPrecio && res.cambiosPrecio.length > 0) {
        setAvisoLote(res.cambiosPrecio.map(c => ({
          nombre: productos.find(p => p.id === c.producto_id)?.nombre ?? `Producto #${c.producto_id}`,
          precioAnterior: c.precio_inicial,
          precioNuevo: c.precio_final,
        })))
      }
      let whatsapp: Toast['whatsapp']
      if (pagoInfo.whatsappTelefono?.trim()) {
        const mensajeWA = construirMensajeWhatsApp({
          clienteNombre: '',
          nombreNegocio: usuario?.establecimiento?.nombre ?? 'Nuestra tienda',
          comprobante: res.comprobante ?? '',
          fecha: new Date().toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }),
          grupos: gruposSnapshot,
          total: totalSnapshot,
          metodoPago: metodoSnapshot,
          efectivoRecibido: pagoInfo.efectivoRecibido,
          vuelto: pagoInfo.vuelto,
        })
        whatsapp = { telefono: pagoInfo.whatsappTelefono, mensaje: mensajeWA }
      }
      mostrarToast({ mensaje: `✓ ${res.comprobante} procesado`, tipo: 'ok', whatsapp })
      setCarritoMovilAbierto(false)
      setClienteFiado(null)
      await recargar(); focusSearch()
    } else {
      mostrarToast({ mensaje: `Error: ${res.error}`, tipo: 'error' })
    }
  }, [procesarVenta, recargar, mostrarToast, focusSearch, grupos, total, metodoPago, usuario, pagoInfo, clienteFiado])

  const cobrarConFactura = useCallback(async (cliente: ClienteFactura) => {
    setModalCliente(false)
    setProcesando(true)
    try {
      const resVenta = await procesarVenta(metodoPago === 'fiado' ? clienteFiado?.id : undefined)
      if (!resVenta.ok) throw new Error(resVenta.error ?? 'Error al procesar venta')

      const detallesXML = grupos.flatMap((g: any) =>
        g.items.map((item: any) => ({
          nombre: item.producto.nombre,
          cantidad: item.cantidad,
          precio_unitario: item.producto.precio_venta,
          descuento: item.descuento ?? 0,
          tiene_iva: (item.producto as any).tiene_iva ?? true,
          codigo_barras: item.producto.codigo_barras ?? undefined,
        }))
      )

      const sriRes = await fetch('/api/usuarios/sri/generar-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venta_id: (resVenta as any).venta_id ?? null,
          establecimiento_id: establecimientoId,
          cliente,
          detalles: detallesXML,
        }),
      })

      const sriData = await sriRes.json()
      if (!sriRes.ok || !sriData.ok) throw new Error(sriData.error ?? 'Error generando factura')

      await recargar(); focusSearch()
      setCarritoMovilAbierto(false)
      setClienteFiado(null)

      supabase.from('clientes').upsert({
        establecimiento_id: establecimientoId,
        identificacion: cliente.identificacion,
        tipo_identificacion: cliente.tipo_identificacion,
        razon_social: cliente.razon_social,
        direccion: cliente.direccion,
        email: cliente.email,
        telefono: cliente.telefono,
      }, { onConflict: 'establecimiento_id,identificacion' }).then(({ error }) => {
        if (error) console.error('Error guardando cliente:', error)
      })

      const mensajeWA = construirMensajeWhatsApp({
        clienteNombre: cliente.razon_social,
        nombreNegocio: usuario?.establecimiento?.nombre ?? 'Nuestra tienda',
        comprobante: (resVenta as any).comprobante ?? '',
        fecha: new Date().toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }),
        grupos,
        total,
        metodoPago,
        efectivoRecibido: pagoInfo.efectivoRecibido,
        vuelto: pagoInfo.vuelto,
        claveAcceso: sriData.claveAcceso,
      })

      mostrarToast({
        tipo: 'factura',
        mensaje: 'Factura generada',
        claveAcceso: sriData.claveAcceso,
        whatsapp: cliente.enviarWhatsApp && cliente.telefono?.trim() ? { telefono: cliente.telefono, mensaje: mensajeWA } : undefined,
      })
    } catch (e) {
      mostrarToast({ tipo: 'error', mensaje: `Error: ${e instanceof Error ? e.message : 'Error desconocido'}` })
    } finally {
      setProcesando(false)
    }
  }, [procesarVenta, grupos, establecimientoId, recargar, mostrarToast, focusSearch, usuario, total, metodoPago, pagoInfo, clienteFiado])

  const generarCotizacion = useCallback(async () => {
    if (grupos.length === 0) return
    setProcesando(true)
    try {
      const { data: last } = await supabase.from('cotizaciones')
        .select('numero').eq('establecimiento_id', establecimientoId)
        .order('id', { ascending: false }).limit(1).maybeSingle()
      const siguiente = last ? parseInt((last as any).numero?.split('-')[2] ?? '0') + 1 : 1
      const numero = `COT-001-${String(siguiente).padStart(7, '0')}`

      const detalles = grupos.flatMap((g: any) => g.items.map((i: any) => ({
        producto_id: i.producto.id,
        nombre: i.producto.nombre,
        cantidad: i.cantidad,
        precio_unitario: i.producto.precio_venta,
        descuento: i.descuento,
        subtotal: i.subtotal,
      })))

      const { error } = await supabase.from('cotizaciones').insert({
        establecimiento_id: establecimientoId,
        numero,
        subtotal: subtotalSinDescuento,
        descuento_total: descuentoTotalAplicado,
        total,
        detalles,
      })
      if (error) throw new Error(error.message)

      imprimirCotizacion(grupos, subtotalSinDescuento, descuentoTotalAplicado, total, numero,
        usuario?.establecimiento?.nombre ?? 'POS Sistema', usuario?.establecimiento?.logo_url ?? null)

      mostrarToast({ mensaje: `📝 Cotización ${numero} generada`, tipo: 'ok' })
    } catch (e) {
      mostrarToast({ tipo: 'error', mensaje: `Error: ${e instanceof Error ? e.message : 'Error desconocido'}` })
    } finally {
      setProcesando(false)
    }
  }, [grupos, total, subtotalSinDescuento, descuentoTotalAplicado, establecimientoId, usuario, mostrarToast])

  const handleCobrar = useCallback(async (efectivoRecibido?: number, vuelto?: number, whatsappTelefono?: string) => {
    if (metodoPago === 'fiado') {
      if (!clienteFiado) {
        mostrarToast({ mensaje: 'Selecciona un cliente para la venta a crédito', tipo: 'error' })
        return
      }
      if (clienteFiado.saldo_pendiente + total > clienteFiado.limite_credito) {
        const continuar = window.confirm(
          `${clienteFiado.razon_social} ya debe $${clienteFiado.saldo_pendiente.toFixed(2)} y su límite es $${clienteFiado.limite_credito.toFixed(2)}. ` +
          `Con esta venta de $${total.toFixed(2)} quedaría debiendo $${(clienteFiado.saldo_pendiente + total).toFixed(2)}, por encima de su límite. ¿Deseas continuar igual?`
        )
        if (!continuar) return
      }
    }
    setPagoInfo({ efectivoRecibido, vuelto, whatsappTelefono })
    if (tipoDoc === 'factura') setModalCliente(true)
    else await cobrarConTicket()
  }, [tipoDoc, cobrarConTicket, metodoPago, clienteFiado, total, mostrarToast])

  const diasSub = usuario?.establecimiento?.fecha_vencimiento
    ? diasRestantes(usuario.establecimiento.fecha_vencimiento as unknown as string) : null

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      {diasSub !== null && diasSub <= 7 && diasSub >= 0 && (
        <div className="flex items-center justify-between bg-amber-50 border-b border-amber-100 px-5 py-2">
          <span className="text-xs text-amber-700">⚠ Tu suscripción vence en <strong>{diasSub}</strong> {diasSub === 1 ? 'día' : 'días'}.</span>
          {usuario?.establecimiento?.url_pago && (
            <a href={usuario.establecimiento.url_pago as unknown as string} target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium text-amber-700 underline hover:text-amber-900">Renovar ahora →</a>
          )}
        </div>
      )}
      <header className="flex flex-col gap-2 border-b border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          {usuario?.establecimiento?.logo_url ? (
            <img
              src={usuario.establecimiento.logo_url}
              alt="Logo del negocio"
              className="h-8 max-w-[160px] object-contain"
            />
          ) : (
            <h1 className="text-sm font-semibold text-slate-800">Punto de venta</h1>
          )}
          <p className="hidden text-xs text-slate-400 sm:block">{vendedores.length} vendedores</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cajaAbierta === null ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">Verificando…</span>
          ) : cajaAbierta ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">Abierta</span>
          ) : (
            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700">Cerrada</span>
          )}
          {usuario?.rol !== 'cajero' && <button onClick={() => router.push('/dashboard')} className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50">📊 <span className="hidden sm:inline">Dashboard</span></button>}
          <button onClick={() => router.push('/caja')} className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50">🏦 <span className="hidden sm:inline">Caja</span></button>
          {usuario?.rol !== 'cajero' && <button onClick={() => router.push('/admin')} className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50">⚙️ <span className="hidden sm:inline">Admin</span></button>}
          {(usuario as any)?.es_superadmin && <button onClick={() => router.push('/superadmin')} className="rounded-xl border border-yellow-300 bg-yellow-50 px-2.5 py-1.5 text-xs text-yellow-700 hover:bg-yellow-100">⚡ <span className="hidden sm:inline">Super</span></button>}
          <span className="hidden text-xs text-slate-500 sm:inline">{usuario?.nombre ?? 'Cajero'}</span>
          <button onClick={logout} className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700">Salir</button>
        </div>
      </header>
      {cajaAbierta === false && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl mx-4">
            <div className="text-center mb-5">
              <div className="text-4xl mb-2">🔒</div>
              <h2 className="text-base font-semibold text-slate-800">Caja cerrada</h2>
              <p className="text-xs text-slate-400 mt-1">Ingresa el fondo de caja inicial para empezar a cobrar</p>
            </div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Fondo de caja inicial</label>
            <input type="number" placeholder="0.00" value={montoInicialCaja}
              onChange={e => setMontoInicialCaja(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-3 text-lg text-center outline-none focus:border-indigo-500 focus:bg-white transition-all mb-3" />
            <button onClick={abrirCajaDesdePOS} disabled={abriendoCaja || !montoInicialCaja}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              {abriendoCaja ? 'Abriendo…' : '✓ Abrir caja y empezar a vender'}
            </button>
          </div>
        </div>
      )}
      <div className="grid flex-1 gap-0 overflow-hidden bg-slate-50 p-0 grid-cols-1 md:grid-rows-[1fr] md:gap-3 md:p-3 md:grid-cols-[1fr_380px]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-none border-0 shadow-none bg-white md:rounded-2xl md:border md:border-slate-100 md:shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input ref={searchRef} type="text" value={searchQ} onChange={e => handleSearch(e.target.value)}
                  placeholder="Buscar por nombre o código de barras…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-indigo-500 focus:bg-white" />
              </div>
              <button type="button" onClick={handleCamara}
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-600">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/>
                  <circle cx="12" cy="13.5" r="3.5"/>
                </svg>
              </button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-4 py-2">
            <button onClick={() => handleCategoria(null)} className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${catActiva === null ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Todos</button>
            {categorias.map(cat => (
              <button key={cat.id} onClick={() => handleCategoria(cat.id)}
                className={`flex items-center gap-1 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${catActiva === cat.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {cat.icono} {cat.nombre}
              </button>
            ))}
          </div>
          {modoMultivendedor && vendedores.length > 0 && (
            <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-4 py-2">
              <button onClick={() => setVendedorActivo(null)} className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${vendedorActivo === null ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Todas las vendedoras</button>
              {vendedores.map(v => (
                <button key={v.id} onClick={() => setVendedorActivo(v.id)}
                  className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${vendedorActivo === v.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {v.nombre}
                </button>
              ))}
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4">
            {loading && <div className="flex h-full items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></div>}
            {error && <div className="flex h-full flex-col items-center justify-center gap-2"><p className="text-sm text-rose-500">{error}</p><button onClick={recargar} className="text-xs text-indigo-600 underline">Reintentar</button></div>}
            {!loading && !error && productosFiltrados.length === 0 && <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400"><span className="text-3xl">📭</span><p className="text-sm">Sin productos</p></div>}
            {!loading && !error && productosFiltrados.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {productosFiltrados.map(p => <ProductCard key={p.id} producto={p} onAgregar={handleAgregar} modoMultivendedor={modoMultivendedor} />)}
              </div>
            )}
          </div>
        </section>
        <div className={`fixed inset-0 z-40 flex-col bg-slate-50 md:static md:z-auto md:h-full md:min-h-0 md:bg-transparent ${carritoMovilAbierto ? 'flex' : 'hidden'} md:flex`}>
          <CartPanel grupos={grupos} total={total} totalItems={totalItems} metodoPago={metodoPago}
            procesando={procesando} tipoDoc={tipoDoc} onTipoDoc={setTipoDoc}
            onCambiarCantidad={cambiarCantidad} onEliminar={eliminar}
            onVaciar={() => { vaciar(); setClienteFiado(null) }} onMetodoPago={setMetodoPago} onCobrar={handleCobrar}
            descuentosItem={descuentosItem} onDescuentoItem={setDescuentoItem}
            descuentoGlobal={descuentoGlobal} onDescuentoGlobal={setDescuentoGlobal}
            subtotalSinDescuento={subtotalSinDescuento} descuentoTotalAplicado={descuentoTotalAplicado}
            onCotizar={generarCotizacion} modoMultivendedor={modoMultivendedor}
            onCerrarMobil={() => setCarritoMovilAbierto(false)}
            clienteFiado={clienteFiado} onAbrirSelectorCliente={() => setModalClienteFiado(true)} />
        </div>
      </div>
      {totalItems > 0 && !carritoMovilAbierto && (
        <button onClick={() => setCarritoMovilAbierto(true)}
          className="fixed bottom-4 left-4 right-4 z-30 flex items-center justify-between rounded-2xl bg-emerald-500 px-5 py-4 text-white shadow-lg transition-transform active:scale-[0.98] md:hidden">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>
              <path d="M2.5 3h2.2l2.4 12.2a2 2 0 002 1.6h8.3a2 2 0 002-1.6L21 8H6.5"/>
            </svg>
            Ver Carrito ({totalItems} {totalItems === 1 ? 'ítem' : 'ítems'})
          </span>
          <span className="text-sm font-bold">${total.toFixed(2)}</span>
        </button>
      )}
      {modalCliente && <ModalCliente total={total} onConfirmar={cobrarConFactura} onCancelar={() => setModalCliente(false)} establecimientoId={establecimientoId} />}
      {modalClienteFiado && (
        <ModalSeleccionarCliente
          establecimientoId={establecimientoId}
          onSeleccionar={c => { setClienteFiado(c); setModalClienteFiado(false) }}
          onCancelar={() => setModalClienteFiado(false)}
        />
      )}
      {toast && <ToastSRI toast={toast} onClose={() => setToast(null)} />}

      {avisoLote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl border border-amber-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Cambio de lote detectado</h3>
                <p className="mt-0.5 text-xs text-slate-500">Estos productos cambiaron de precio al agotarse el lote anterior.</p>
              </div>
            </div>
            <div className="space-y-2 mb-5">
              {avisoLote.map((a, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2.5">
                  <span className="text-xs font-medium text-slate-800 truncate max-w-[160px]">{a.nombre}</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 line-through">${a.precioAnterior.toFixed(2)}</span>
                    <span className="font-semibold text-amber-700">${a.precioNuevo.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setAvisoLote(null)}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}