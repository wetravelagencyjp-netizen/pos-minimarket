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
const DOT: Record<number, string> = { 1: 'bg-blue-500', 2: 'bg-green-500', 3: 'bg-amber-500' }
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
    <aside className="flex h-full flex-col overflow-y-auto border-l border-gray-100 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-gray-900">Carrito</h2>
          {totalItems > 0 && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-medium text-white">{totalItems}</span>}
        </div>
        {!empty && <button onClick={onVaciar} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Vaciar</button>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
            <span className="text-3xl">🛒</span><p className="text-sm">El carrito está vacío</p>
          </div>
        ) : (
          <div className="py-2">
            {grupos.map(({ vendedor, items, subtotal }) => (
              <div key={vendedor.id}>
                {modoMultivendedor && (
                  <div className="flex items-center gap-2 px-4 py-1.5">
                    <div className="h-px flex-1 bg-gray-100" />
                    <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      <span className={`h-1.5 w-1.5 rounded-full ${DOT[vendedor.id] ?? 'bg-gray-400'}`} />
                      {vendedor.nombre}
                    </span>
                    <div className="h-px flex-1 bg-gray-100" />
                  </div>
                )}
                {items.map((it: any) => {
                  const { producto, cantidad, subtotal: sub, descuento } = it
                  const dcto = descuentosItem[producto.id]
                  const abierto = descuentosAbiertos.has(producto.id)
                  return (
                    <div key={producto.id} className="group px-4 py-2 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{producto.categoria?.icono ?? '📦'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-gray-900">{producto.nombre}</p>
                          <p className="text-[11px] text-gray-400">{fmt(producto.precio_venta)} c/u</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => onCambiarCantidad(producto.id, -1)} className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 text-xs hover:bg-gray-100">−</button>
                          <span className="min-w-[18px] text-center text-xs font-medium text-gray-900">{cantidad}</span>
                          <button onClick={() => onCambiarCantidad(producto.id, 1)} className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 text-xs hover:bg-gray-100">+</button>
                        </div>
                        <button onClick={() => toggleDescuento(producto.id)}
                          className={`rounded-full px-1.5 py-0.5 text-[10px] ${dcto ? 'bg-amber-100 text-amber-700' : 'text-gray-300 hover:text-gray-500'}`}>
                          🏷️
                        </button>
                        <span className="min-w-[52px] text-right text-xs font-medium text-gray-900">{fmt(sub)}</span>
                        <button onClick={() => onEliminar(producto.id)} className="ml-1 text-gray-200 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all">✕</button>
                      </div>
                      {descuento > 0 && (
                        <p className="pr-7 text-right text-[10px] text-amber-600">− {fmt(descuento)} descuento</p>
                      )}
                      {abierto && (
                        <div className="mt-1.5 flex items-center gap-1.5 pl-7">
                          <select value={dcto?.tipo ?? 'porcentaje'}
                            onChange={e => onDescuentoItem(producto.id, { tipo: e.target.value as TipoDescuento, valor: dcto?.valor ?? 0 })}
                            className="rounded border border-gray-200 px-1 py-1 text-[11px]">
                            <option value="porcentaje">%</option>
                            <option value="fijo">$</option>
                          </select>
                          <input type="number" min="0" step="0.01" value={dcto?.valor ?? ''}
                            onChange={e => onDescuentoItem(producto.id, { tipo: dcto?.tipo ?? 'porcentaje', valor: parseFloat(e.target.value) || 0 })}
                            placeholder="0"
                            className="w-20 rounded border border-gray-200 px-2 py-1 text-[11px] outline-none focus:border-amber-400" />
                        </div>
                      )}
                    </div>
                  )
                })}
                {modoMultivendedor && (
                  <div className="flex justify-between px-4 pb-1 pt-0.5">
                    <span className="text-[11px] text-gray-400">Subtotal {vendedor.nombre}</span>
                    <span className="text-[11px] font-medium text-gray-600">{fmt(subtotal)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 px-4 pt-3 pb-4 space-y-3">
        {!empty && (
          <div className="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Subtotal</span>
              <span>{fmt(subtotalSinDescuento)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex-1 text-xs text-gray-500">Descuento global</span>
              <select value={descuentoGlobal.tipo}
                onChange={e => onDescuentoGlobal({ tipo: e.target.value as TipoDescuento, valor: descuentoGlobal.valor })}
                className="rounded border border-gray-200 px-1 py-1 text-xs">
                <option value="porcentaje">%</option>
                <option value="fijo">$</option>
              </select>
              <input type="number" min="0" step="0.01" value={descuentoGlobal.valor || ''}
                onChange={e => onDescuentoGlobal({ tipo: descuentoGlobal.tipo, valor: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="w-20 rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-amber-400" />
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
          <span className="text-sm font-medium text-gray-700">Total a pagar</span>
          <span className="text-2xl font-semibold text-gray-900">{fmt(total)}</span>
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
          {(['ticket', 'factura'] as const).map(tipo => (
            <button key={tipo} onClick={() => onTipoDoc(tipo)}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all
                ${tipoDoc === tipo ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {tipo === 'ticket' ? '🧾 Ticket' : '📄 Factura e.'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {METODOS.map(({ value, label, icon }) => (
            <button key={value} onClick={() => onMetodoPago(value)}
              className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-all
                ${metodoPago === value ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-white'}`}>
              {icon} {label}
            </button>
          ))}
        </div>
        {metodoPago === 'efectivo' && !empty && (
          <div className="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">Paga con:</label>
              {efectivoRecibido && (
                <button onClick={() => setEfectivoRecibido('')} className="text-[11px] text-gray-400 hover:text-red-500 transition-colors">Limpiar</button>
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
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
            <div className="flex gap-1.5">
              {BILLETES.map(billete => (
                <button key={billete} type="button" onClick={() => agregarBillete(billete)}
                  className="flex-1 rounded-lg border border-gray-200 bg-white py-1.5 text-xs font-medium text-gray-600 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 active:scale-95">
                  +${billete}
                </button>
              ))}
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xs font-medium text-gray-500">{vuelto < 0 ? 'Falta' : 'Vuelto'}</span>
              <span className={`text-2xl font-bold ${vuelto < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                {fmt(Math.abs(vuelto))}
              </span>
            </div>
          </div>
        )}
        {tipoDoc === 'ticket' && !empty && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5">
              <input type="checkbox" id="wa-ticket" checked={enviarWhatsApp}
                onChange={e => setEnviarWhatsApp(e.target.checked)}
                className="rounded border-gray-300" />
              <label htmlFor="wa-ticket" className="text-xs text-emerald-700 flex-1">📱 El cliente desea recibir su recibo por WhatsApp</label>
            </div>
            {enviarWhatsApp && (
              <input type="tel" value={telefonoWhatsApp} onChange={e => setTelefonoWhatsApp(e.target.value)}
                placeholder="+593 99 999 9999"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400" />
            )}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onCotizar} disabled={empty || procesando}
            className="flex-1 rounded-xl border border-amber-300 bg-amber-50 py-3 text-sm font-medium text-amber-700 transition-all hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40">
            📝 Cotización
          </button>
          <button onClick={handleCobrar} disabled={empty || procesando || faltaEfectivo}
            className={`flex-[2] flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all
              ${empty || procesando || faltaEfectivo ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                : tipoDoc === 'factura' ? 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'}`}>
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