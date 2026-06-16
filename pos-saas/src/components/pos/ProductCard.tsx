'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useInventario, useCarrito } from '@/hooks'
import { supabase } from '@/lib/supabase'
import { ProductCard } from './ProductCard'
import { CartPanel } from './CartPanel'
import { diasRestantes } from '@/types'
import type { Producto, GrupoVendedor, MetodoPago } from '@/types'

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
  const metodoLabel: Record<MetodoPago, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', mixto: 'Mixto' }
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
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[420px] max-w-[95vw]">
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
    <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg
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

export function POSScreen({ establecimientoId }: { establecimientoId: number }) {
  const [catActiva, setCatActiva]       = useState<number | null>(null)
  const [vendedorActivo, setVendedorActivo] = useState<number | null>(null)
  const [searchQ, setSearchQ]           = useState('')
  const [toast, setToast]               = useState<Toast | null>(null)
  const [procesando, setProcesando]     = useState(false)
  const [tipoDoc, setTipoDoc]           = useState<TipoDocumento>('ticket')
  const [modalCliente, setModalCliente] = useState(false)
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

  const cobrarConTicket = useCallback(async () => {
    setProcesando(true)
    const gruposSnapshot = [...grupos]
    const totalSnapshot = total
    const metodoSnapshot = metodoPago
    const res = await procesarVenta()
    setProcesando(false)
    if (res.ok) {
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
      await recargar(); focusSearch()
    } else {
      mostrarToast({ mensaje: `Error: ${res.error}`, tipo: 'error' })
    }
  }, [procesarVenta, recargar, mostrarToast, focusSearch, grupos, total, metodoPago, usuario, pagoInfo])

  const cobrarConFactura = useCallback(async (cliente: ClienteFactura) => {
    setModalCliente(false)
    setProcesando(true)
    try {
      const resVenta = await procesarVenta()
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
  }, [procesarVenta, grupos, establecimientoId, recargar, mostrarToast, focusSearch, usuario, total, metodoPago, pagoInfo])

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
    setPagoInfo({ efectivoRecibido, vuelto, whatsappTelefono })
    if (tipoDoc === 'factura') setModalCliente(true)
    else await cobrarConTicket()
  }, [tipoDoc, cobrarConTicket])

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
      <header className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3">
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
          <p className="text-xs text-slate-400">{vendedores.length} vendedores</p>
        </div>
        <div className="flex items-center gap-2">
          {cajaAbierta === null ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">Verificando…</span>
          ) : cajaAbierta ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">Abierta</span>
          ) : (
            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700">Cerrada</span>
          )}
          {usuario?.rol !== 'cajero' && <button onClick={() => router.push('/dashboard')} className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50">📊 Dashboard</button>}
          <button onClick={() => router.push('/caja')} className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50">🏦 Caja</button>
          {usuario?.rol !== 'cajero' && <button onClick={() => router.push('/admin')} className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50">⚙️ Admin</button>}
          {(usuario as any)?.es_superadmin && <button onClick={() => router.push('/superadmin')} className="rounded-xl border border-yellow-300 bg-yellow-50 px-2.5 py-1.5 text-xs text-yellow-700 hover:bg-yellow-100">⚡ Super</button>}
          <span className="text-xs text-slate-500">{usuario?.nombre ?? 'Cajero'}</span>
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
      <div className="grid flex-1 gap-3 overflow-hidden bg-slate-50 p-3" style={{ gridTemplateColumns: '1fr 380px' }}>
        <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input ref={searchRef} type="text" value={searchQ} onChange={e => handleSearch(e.target.value)}
                placeholder="Buscar por nombre o código de barras…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-indigo-500 focus:bg-white" />
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
          <div className="flex-1 overflow-y-auto p-4">
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
        <CartPanel grupos={grupos} total={total} totalItems={totalItems} metodoPago={metodoPago}
          procesando={procesando} tipoDoc={tipoDoc} onTipoDoc={setTipoDoc
            }

onCambiarCantidad={cambiarCantidad} onEliminar={eliminar}

onVaciar={vaciar} onMetodoPago={setMetodoPago} onCobrar={handleCobrar}

descuentosItem={descuentosItem} onDescuentoItem={setDescuentoItem}

descuentoGlobal={descuentoGlobal} onDescuentoGlobal={setDescuentoGlobal}

subtotalSinDescuento={subtotalSinDescuento} descuentoTotalAplicado={descuentoTotalAplicado}

onCotizar={generarCotizacion} modoMultivendedor={modoMultivendedor} />

</div>

{modalCliente && <ModalCliente total={total} onConfirmar={cobrarConFactura} onCancelar={() => setModalCliente(false)} establecimientoId={establecimientoId} />}

{toast && <ToastSRI toast={toast} onClose={() => setToast(null)} />}

</div>

)

}
**3. `pos-saas/src/components/pos/CartPanel.tsx`** — reemplaza todo:

```typescriptreact
'use client'
import { useCallback, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import type { GrupoVendedor, MetodoPago } from '@/types'
import type { Descuento, TipoDescuento } from '@/hooks'

const METODOS: { value: MetodoPago; label: string; icon: string }[] = [
  { value: 'efectivo',      label: 'Efectivo',      icon: '💵' },
  { value: 'tarjeta',       label: 'Tarjeta',       icon: '💳' },
  { value: 'transferencia', label: 'Transferencia', icon: '🏦' },
  { value: 'mixto',         label: 'Mixto',         icon: '🔀' },
]
const DOT: Record<number, string> = { 1: 'bg-indigo-500', 2: 'bg-emerald-500', 3: 'bg-amber-500' }
const fmt = (n: number) => `$${n.toFixed(2)}`
const BILLETES = [1, 5, 10, 20]

type TipoDocumento = 'ticket' | 'factura'

interface Props {
  grupos: GrupoVendedor[]
  total: number
  totalItems: number
  metodoPago: MetodoPago
  procesando: boolean
  tipoDoc: TipoDocumento
  onTipoDoc: (v: TipoDocumento) => void
  onCambiarCantidad: (id: number, delta: number) => void
  onEliminar: (id: number) => void
  onVaciar: () => void
  onMetodoPago: (m: MetodoPago) => void
  onCobrar: (efectivoRecibido?: number, vuelto?: number, whatsappTelefono?: string) => void
  descuentosItem: Record<number, Descuento>
  onDescuentoItem: (id: number, descuento: Descuento | null) => void
  descuentoGlobal: Descuento
  onDescuentoGlobal: (descuento: Descuento) => void
  subtotalSinDescuento: number
  descuentoTotalAplicado: number
  onCotizar: () => void
  modoMultivendedor?: boolean
}

function imprimirTicket(grupos: GrupoVendedor[], total: number, metodoPago: MetodoPago, comprobante: string, establecimiento: string, logoUrl?: string | null, efectivoRecibido?: number, vuelto?: number, modoMultivendedor: boolean = true) {
  const fecha = new Date().toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })
  const metodoLabel: Record<MetodoPago, string> = {
    efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', mixto: 'Mixto'
  }
  const lineasGrupos = modoMultivendedor ? grupos.map(({ vendedor, items, subtotal }) => `
    <div class="seccion">
      <div class="vendedor">— ${vendedor.nombre} —</div>
      ${items.map(({ producto, cantidad, subtotal: sub }) => `
        <div class="item">
          <div class="item-nombre">${producto.nombre}</div>
          <div class="item-detalle">
            <span>${cantidad} x ${fmt(producto.precio_venta)}</span>
            <span>${fmt(sub)}</span>
          </div>
        </div>
      `).join('')}
      <div class="subtotal"><span>Subtotal ${vendedor.nombre}</span><span>${fmt(subtotal)}</span></div>
    </div>
  `).join('<div class="separador"></div>') : grupos.flatMap(g => g.items).map(({ producto, cantidad, subtotal: sub }) => `
    <div class="item">
      <div class="item-nombre">${producto.nombre}</div>
      <div class="item-detalle">
        <span>${cantidad} x ${fmt(producto.precio_venta)}</span>
        <span>${fmt(sub)}</span>
      </div>
    </div>
  `).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ticket ${comprobante}</title>
  <style>
    * { margin:0;padding:0;box-sizing:border-box }
    body { font-family:'Courier New',monospace;font-size:11px;width:80mm;max-width:80mm;padding:4mm;color:#000 }
    .cabecera{text-align:center;margin-bottom:6px} .cabecera h1{font-size:14px;font-weight:bold} .cabecera p{font-size:10px}
    .linea{border-top:1px dashed #000;margin:6px 0} .info{display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px}
    .vendedor{text-align:center;font-weight:bold;font-size:10px;margin:6px 0 4px} .item{margin-bottom:4px} .item-nombre{font-size:11px}
    .item-detalle{display:flex;justify-content:space-between;font-size:10px;color:#333}
    .subtotal{display:flex;justify-content:space-between;font-size:10px;font-style:italic;margin-top:4px}
    .separador{border-top:1px dotted #999;margin:6px 0} .total{display:flex;justify-content:space-between;font-size:14px;font-weight:bold;margin-top:6px}
    .metodo{text-align:center;font-size:10px;margin-top:4px} .pie{text-align:center;font-size:9px;margin-top:8px;color:#555} .seccion{margin:4px 0}
    @media print{body{width:80mm}@page{size:80mm auto;margin:0}}
  </style></head><body>
  <div class="cabecera">
    ${logoUrl ? `<img src="${logoUrl}" alt="${establecimiento}" style="max-height:50px;max-width:60mm;margin:0 auto 4px;display:block" />` : `<h1>🛒 ${establecimiento}</h1>`}
    <p>Sistema Multivendedor</p>
  </div>
  <div class="linea"></div>
  <div class="info"><span>Fecha:</span><span>${fecha}</span></div>
  <div class="info"><span>Comprobante:</span><span>${comprobante}</span></div>
  <div class="linea"></div>
  ${lineasGrupos}
  <div class="linea"></div>
  <div class="total"><span>TOTAL</span><span>${fmt(total)}</span></div>
  ${metodoPago === 'efectivo' && efectivoRecibido != null && vuelto != null ? `
  <div class="info"><span>Efectivo Recibido:</span><span>${fmt(efectivoRecibido)}</span></div>
  <div class="info"><span>Vuelto / Cambio:</span><span>${fmt(vuelto)}</span></div>
  ` : ''}
  <div class="metodo">Pago: ${metodoLabel[metodoPago]}</div>
  <div class="linea"></div>
  <div class="pie">¡Gracias por su compra!<br>Vuelva pronto 😊</div>
  </body></html>`

  const ventana = window.open('', '_blank', 'width=320,height=600')
  if (!ventana) return
  ventana.document.write(html)
  ventana.document.close()
  ventana.focus()
  setTimeout(() => { ventana.print(); ventana.close() }, 300)
}

export function CartPanel({
  grupos, total, totalItems, metodoPago, procesando,
  tipoDoc, onTipoDoc,
  onCambiarCantidad, onEliminar, onVaciar, onMetodoPago, onCobrar,
  descuentosItem, onDescuentoItem, descuentoGlobal, onDescuentoGlobal,
  subtotalSinDescuento, descuentoTotalAplicado, onCotizar,
  modoMultivendedor = true,
}: Props) {
  const empty = grupos.length === 0
  const { usuario } = useAuth()
  const [descuentosAbiertos, setDescuentosAbiertos] = useState<Set<number>>(new Set())
  const toggleDescuento = (id: number) => setDescuentosAbiertos(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const [efectivoRecibido, setEfectivoRecibido] = useState('')
  const montoRecibido = parseFloat(efectivoRecibido) || 0
  const vuelto = +(montoRecibido - total).toFixed(2)
  const faltaEfectivo = metodoPago === 'efectivo' && montoRecibido < total
  const [enviarWhatsApp, setEnviarWhatsApp] = useState(false)
  const [telefonoWhatsApp, setTelefonoWhatsApp] = useState('+593 ')

  const agregarBillete = (valor: number) => {
    const actual = parseFloat(efectivoRecibido) || 0
    setEfectivoRecibido((actual + valor).toFixed(2))
  }

  const handleCobrar = useCallback(async () => {
    const gruposSnapshot = [...grupos]
    const totalSnapshot = total
    const metodoSnapshot = metodoPago
    const nombreEstab = usuario?.establecimiento?.nombre ?? 'POS Sistema'
    const logoUrl = usuario?.establecimiento?.logo_url ?? null
    const efectivoSnapshot = montoRecibido
    const vueltoSnapshot = vuelto
    const whatsappSnapshot = tipoDoc === 'ticket' && enviarWhatsApp ? telefonoWhatsApp : undefined
    await onCobrar(efectivoSnapshot, vueltoSnapshot, whatsappSnapshot)
    if (tipoDoc === 'ticket') {
      setTimeout(() => {
        const comprobante = `001-001-${String(Date.now()).slice(-7)}`
        imprimirTicket(gruposSnapshot, totalSnapshot, metodoSnapshot, comprobante, nombreEstab, logoUrl, efectivoSnapshot, vueltoSnapshot, modoMultivendedor)
      }, 500)
    }
    setEfectivoRecibido('')
    setEnviarWhatsApp(false)
  }, [grupos, total, metodoPago, onCobrar, usuario, tipoDoc, montoRecibido, vuelto, enviarWhatsApp, telefonoWhatsApp])

  return (
    <aside className="flex h-full flex-col overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-slate-800">Carrito</h2>
          {totalItems > 0 && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-medium text-white">{totalItems}</span>}
        </div>
        {!empty && <button onClick={onVaciar} className="text-xs text-slate-400 hover:text-rose-500 transition-colors">Vaciar</button>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
            <span className="text-3xl">🛒</span><p className="text-sm">El carrito está vacío</p>
          </div>
        ) : (
          <div className="py-2">
            {grupos.map(({ vendedor, items, subtotal }) => (
              <div key={vendedor.id}>
                {modoMultivendedor && (
                  <div className="flex items-center gap-2 px-4 py-1.5">
                    <div className="h-px flex-1 bg-slate-100" />
                    <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      <span className={`h-1.5 w-1.5 rounded-full ${DOT[vendedor.id] ?? 'bg-slate-400'}`} />
                      {vendedor.nombre}
                    </span>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>
                )}
                {items.map((it: any) => {
                  const { producto, cantidad, subtotal: sub, descuento } = it
                  const dcto = descuentosItem[producto.id]
                  const abierto = descuentosAbiertos.has(producto.id)
                  return (
                    <div key={producto.id} className="group px-4 py-2 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{producto.categoria?.icono ?? '📦'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-800">{producto.nombre}</p>
                          <p className="text-[11px] text-slate-400">{fmt(producto.precio_venta)} c/u</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => onCambiarCantidad(producto.id, -1)} className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-xs hover:bg-slate-100">−</button>
                          <span className="min-w-[18px] text-center text-xs font-medium text-slate-800">{cantidad}</span>
                          <button onClick={() => onCambiarCantidad(producto.id, 1)} className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-xs hover:bg-slate-100">+</button>
                        </div>
                        <button onClick={() => toggleDescuento(producto.id)}
                          className={`rounded-full px-1.5 py-0.5 text-[10px] ${dcto ? 'bg-amber-50 text-amber-700' : 'text-slate-300 hover:text-slate-500'}`}>
                          🏷️
                        </button>
                        <span className="min-w-[52px] text-right text-xs font-medium text-slate-800">{fmt(sub)}</span>
                        <button onClick={() => onEliminar(producto.id)} className="ml-1 text-slate-200 opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-all">✕</button>
                      </div>
                      {descuento > 0 && (
                        <p className="pr-7 text-right text-[10px] text-amber-600">− {fmt(descuento)} descuento</p>
                      )}
                      {abierto && (
                        <div className="mt-1.5 flex items-center gap-1.5 pl-7">
                          <select value={dcto?.tipo ?? 'porcentaje'}
                            onChange={e => onDescuentoItem(producto.id, { tipo: e.target.value as TipoDescuento, valor: dcto?.valor ?? 0 })}
                            className="rounded border border-slate-200 px-1 py-1 text-[11px]">
                            <option value="porcentaje">%</option>
                            <option value="fijo">$</option>
                          </select>
                          <input type="number" min="0" step="0.01" value={dcto?.valor ?? ''}
                            onChange={e => onDescuentoItem(producto.id, { tipo: dcto?.tipo ?? 'porcentaje', valor: parseFloat(e.target.value) || 0 })}
                            placeholder="0"
                            className="w-20 rounded border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-amber-400" />
                        </div>
                      )}
                    </div>
                  )
                })}
                {modoMultivendedor && (
                  <div className="flex justify-between px-4 pb-1 pt-0.5">
                    <span className="text-[11px] text-slate-400">Subtotal {vendedor.nombre}</span>
                    <span className="text-[11px] font-medium text-slate-600">{fmt(subtotal)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-4 pt-3 pb-4 space-y-3">
        {!empty && (
          <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Subtotal</span>
              <span>{fmt(subtotalSinDescuento)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex-1 text-xs text-slate-500">Descuento global</span>
              <select value={descuentoGlobal.tipo}
                onChange={e => onDescuentoGlobal({ tipo: e.target.value as TipoDescuento, valor: descuentoGlobal.valor })}
                className="rounded border border-slate-200 px-1 py-1 text-xs">
                <option value="porcentaje">%</option>
                <option value="fijo">$</option>
              </select>
              <input type="number" min="0" step="0.01" value={descuentoGlobal.valor || ''}
                onChange={e => onDescuentoGlobal({ tipo: descuentoGlobal.tipo, valor: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="w-20 rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-amber-400" />
            </div>
            {descuentoTotalAplicado > 0 && (
              <div className="flex items-center justify-between text-xs font-medium text-amber-600">
                <span>Descuento total</span>
                <span>− {fmt(descuentoTotalAplicado)}</span>
              </div>
            )}
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-slate-700">Total a pagar</span>
          <span className="text-2xl font-semibold text-slate-800">{fmt(total)}</span>
        </div>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-0.5">
          {(['ticket', 'factura'] as const).map(tipo => (
            <button key={tipo} onClick={() => onTipoDoc(tipo)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all
                ${tipoDoc === tipo ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {tipo === 'ticket' ? '🧾 Ticket' : '📄 Factura e.'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {METODOS.map(({ value, label, icon }) => (
            <button key={value} onClick={() => onMetodoPago(value)}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition-all
                ${metodoPago === value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {icon} {label}
            </button>
          ))}
        </div>
        {metodoPago === 'efectivo' && !empty && (
          <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">Paga con:</label>
              {efectivoRecibido && (
                <button onClick={() => setEfectivoRecibido('')} className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors">Limpiar</button>
              )}
            </div>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={efectivoRecibido}
              onChange={e => setEfectivoRecibido(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-all"
            />
            <div className="flex gap-1.5">
              {BILLETES.map(billete => (
                <button key={billete} type="button" onClick={() => agregarBillete(billete)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-1.5 text-xs font-medium text-slate-600 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95">
                  +${billete}
                </button>
              ))}
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xs font-medium text-slate-500">{vuelto < 0 ? 'Falta' : 'Vuelto'}</span>
              <span className={`text-2xl font-bold ${vuelto < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {fmt(Math.abs(vuelto))}
              </span>
            </div>
          </div>
        )}
        {tipoDoc === 'ticket' && !empty && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
              <input type="checkbox" id="wa-ticket" checked={enviarWhatsApp}
                onChange={e => setEnviarWhatsApp(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <label htmlFor="wa-ticket" className="text-xs text-emerald-700 flex-1">📱 El cliente desea recibir su recibo por WhatsApp</label>
            </div>
            {enviarWhatsApp && (
              <input type="tel" value={telefonoWhatsApp} onChange={e => setTelefonoWhatsApp(e.target.value)}
                placeholder="+593 99 999 9999"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-all" />
            )}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onCotizar} disabled={empty || procesando}
            className={`flex-1 rounded-xl py-3 text-sm font-medium transition-all
              ${empty || procesando ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]'}`}>
            📝 Cotización
          </button>
          <button onClick={handleCobrar} disabled={empty || procesando || faltaEfectivo}
            className={`flex-[2] flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all
              ${empty || procesando || faltaEfectivo ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-slate-950 text-white hover:bg-slate-900 active:scale-[0.98]'}`}>
            {procesando
              ? <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Procesando…</>
              : tipoDoc === 'factura' ? <>📄 Facturar {!empty && fmt(total)}</> : <>🧾 Cobrar {!empty && fmt(total)}</>}
          </button>
        </div>
        {tipoDoc === 'factura' && !empty && (
          <p className="text-center text-[11px] text-emerald-600">Se pedirán los datos del cliente para la factura electrónica</p>
        )}
      </div>
    </aside>
  )
}
```
