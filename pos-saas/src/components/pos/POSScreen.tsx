'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useInventario, useCarrito } from '@/hooks'
import { ProductCard } from './ProductCard'
import { CartPanel } from './CartPanel'
import { diasRestantes } from '@/types'
import type { Producto } from '@/types'

type ToastTipo = 'ok' | 'error' | 'factura'
type Toast = { mensaje: string; tipo: ToastTipo; claveAcceso?: string }
type TipoDocumento = 'ticket' | 'factura'

interface ClienteFactura {
  identificacion: string
  tipo_identificacion: 'cedula' | 'ruc' | 'pasaporte' | 'consumidor_final'
  razon_social: string
  direccion: string
  email: string
  telefono: string
}

function ToastSRI({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, toast.tipo === 'factura' ? 6000 : 2800)
    return () => clearTimeout(t)
  }, [toast, onClose])

  if (toast.tipo === 'factura' && toast.claveAcceso) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[420px] max-w-[95vw]">
        <div className="rounded-2xl bg-gray-900 px-5 py-4 shadow-2xl ring-1 ring-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Factura generada con éxito</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Comprobante electrónico SRI</p>
              </div>
            </div>
            <button onClick={onClose} className="mt-0.5 text-gray-500 hover:text-gray-300 transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div className="mt-3 rounded-lg bg-white/5 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-widest text-gray-500 mb-1">Clave de acceso</p>
            <p className="font-mono text-[11px] text-emerald-400 break-all leading-relaxed">{toast.claveAcceso}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg
      ${toast.tipo === 'ok' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'}`}>
      {toast.mensaje}
    </div>
  )
}

function ModalCliente({ onConfirmar, onCancelar, total }: {
  onConfirmar: (cliente: ClienteFactura) => void
  onCancelar: () => void
  total: number
}) {
  const [form, setForm] = useState<ClienteFactura>({
    identificacion: '', tipo_identificacion: 'cedula',
    razon_social: '', direccion: 'Ecuador', email: '', telefono: '',
  })
  const [errores, setErrores] = useState<Partial<Record<keyof ClienteFactura, string>>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

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
        <div className="border-b border-gray-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Datos del cliente</h2>
              <p className="text-xs text-gray-400 mt-0.5">Factura electrónica — Total: <span className="font-medium text-gray-600">${total.toFixed(2)}</span></p>
            </div>
            <button onClick={onCancelar} className="text-gray-400 hover:text-gray-600">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Tipo de identificación</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['cedula', 'ruc', 'pasaporte'] as const).map(tipo => (
                <button key={tipo} onClick={() => set('tipo_identificacion', tipo)}
                  className={`rounded-lg border py-2 text-xs font-medium transition-all
                    ${form.tipo_identificacion === tipo ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-white'}`}>
                  {tipo === 'cedula' ? 'Cédula' : tipo === 'ruc' ? 'RUC' : 'Pasaporte'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Número</label>
            <input ref={inputRef} type="text" value={form.identificacion}
              onChange={e => set('identificacion', e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && validar() && onConfirmar(form)}
              placeholder={form.tipo_identificacion === 'cedula' ? '1234567890' : form.tipo_identificacion === 'ruc' ? '1234567890001' : 'Pasaporte'}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors
                ${errores.identificacion ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-blue-400 bg-gray-50'}`} />
            {errores.identificacion && <p className="text-[11px] text-red-500 mt-1">{errores.identificacion}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Nombre / Razón social</label>
            <input type="text" value={form.razon_social}
              onChange={e => set('razon_social', e.target.value.toUpperCase())}
              placeholder="JUAN PÉREZ GÓMEZ"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors
                ${errores.razon_social ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-blue-400 bg-gray-50'}`} />
            {errores.razon_social && <p className="text-[11px] text-red-500 mt-1">{errores.razon_social}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Dirección <span className="text-gray-400 font-normal">(opcional)</span></label>
            <input type="text" value={form.direccion} onChange={e => set('direccion', e.target.value)}
              placeholder="Quito, Ecuador"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Email <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="correo@ejemplo.com"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Teléfono <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input type="tel" value={form.telefono} onChange={e => set('telefono', e.target.value)}
                placeholder="0999999999"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </div>
          </div>
        </div>
        <div className="border-t border-gray-100 px-6 py-4 flex gap-2">
          <button onClick={onCancelar} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={() => { if (validar()) onConfirmar(form) }}
            className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
            Generar factura
          </button>
        </div>
      </div>
    </div>
  )
}

export function POSScreen({ establecimientoId }: { establecimientoId: number }) {
  const [catActiva, setCatActiva]       = useState<number | null>(null)
  const [searchQ, setSearchQ]           = useState('')
  const [toast, setToast]               = useState<Toast | null>(null)
  const [procesando, setProcesando]     = useState(false)
  const [tipoDoc, setTipoDoc]           = useState<TipoDocumento>('ticket')
  const [modalCliente, setModalCliente] = useState(false)
  const searchRef                       = useRef<HTMLInputElement>(null)
  const { usuario, logout }             = useAuth()
  const router                          = useRouter()

  const { productos, categorias, vendedores, loading, error, buscar, recargar } = useInventario(establecimientoId)
  const { grupos, total, totalItems, metodoPago, setMetodoPago, agregar, cambiarCantidad, eliminar, vaciar, procesarVenta } = useCarrito(establecimientoId)

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
    const res = await procesarVenta()
    setProcesando(false)
    if (res.ok) {
      mostrarToast({ mensaje: `✓ ${res.comprobante} procesado`, tipo: 'ok' })
      await recargar(); focusSearch()
    } else {
      mostrarToast({ mensaje: `Error: ${res.error}`, tipo: 'error' })
    }
  }, [procesarVenta, recargar, mostrarToast, focusSearch])

  const cobrarConFactura = useCallback(async (cliente: ClienteFactura) => {
    setModalCliente(false)
    setProcesando(true)
    try {
      const resVenta = await procesarVenta()
      if (!resVenta.ok) throw new Error(resVenta.error ?? 'Error al procesar venta')

      const detallesXML = grupos.flatMap(g =>
        g.items.map(item => ({
          nombre: item.producto.nombre,
          cantidad: item.cantidad,
          precio_unitario: item.producto.precio_venta,
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
      mostrarToast({ tipo: 'factura', mensaje: 'Factura generada', claveAcceso: sriData.claveAcceso })
    } catch (e) {
      mostrarToast({ tipo: 'error', mensaje: `Error: ${e instanceof Error ? e.message : 'Error desconocido'}` })
    } finally {
      setProcesando(false)
    }
  }, [procesarVenta, grupos, establecimientoId, recargar, mostrarToast, focusSearch])

  const handleCobrar = useCallback(async () => {
    if (tipoDoc === 'factura') setModalCliente(true)
    else await cobrarConTicket()
  }, [tipoDoc, cobrarConTicket])

  const diasSub = usuario?.establecimiento?.fecha_vencimiento
    ? diasRestantes(usuario.establecimiento.fecha_vencimiento as unknown as string) : null

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      {diasSub !== null && diasSub <= 7 && diasSub >= 0 && (
        <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200 px-5 py-2">
          <span className="text-xs text-amber-700">⚠ Tu suscripción vence en <strong>{diasSub}</strong> {diasSub === 1 ? 'día' : 'días'}.</span>
          {usuario?.establecimiento?.url_pago && (
            <a href={usuario.establecimiento.url_pago as unknown as string} target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium text-amber-700 underline hover:text-amber-900">Renovar ahora →</a>
          )}
        </div>
      )}
      <header className="flex items-center justify-between border-b border-gray-100 bg-white px-5 py-3">
        <div>
          <h1 className="text-sm font-semibold text-gray-900">Punto de venta</h1>
          <p className="text-xs text-gray-400">{vendedores.length} vendedores</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-medium text-green-700">Abierta</span>
          {usuario?.rol !== 'cajero' && <button onClick={() => router.push('/dashboard')} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50">📊 Dashboard</button>}
          <button onClick={() => router.push('/caja')} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50">🏦 Caja</button>
          {usuario?.rol !== 'cajero' && <button onClick={() => router.push('/admin')} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50">⚙️ Admin</button>}
          {(usuario as any)?.es_superadmin && <button onClick={() => router.push('/superadmin')} className="rounded-lg border border-yellow-300 bg-yellow-50 px-2.5 py-1.5 text-xs text-yellow-700 hover:bg-yellow-100">⚡ Super</button>}
          <span className="text-xs text-gray-500">{usuario?.nombre ?? 'Cajero'}</span>
          <button onClick={logout} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700">Salir</button>
        </div>
      </header>
      <div className="grid flex-1 overflow-hidden" style={{ gridTemplateColumns: '1fr 360px' }}>
        <section className="flex flex-col overflow-hidden">
          <div className="border-b border-gray-100 bg-white px-4 py-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input ref={searchRef} type="text" value={searchQ} onChange={e => handleSearch(e.target.value)}
                placeholder="Buscar por nombre o código de barras…"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:bg-white" />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto border-b border-gray-100 bg-white px-4 py-2">
            <button onClick={() => handleCategoria(null)} className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${catActiva === null ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Todos</button>
            {categorias.map(cat => (
              <button key={cat.id} onClick={() => handleCategoria(cat.id)}
                className={`flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${catActiva === cat.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {cat.icono} {cat.nombre}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {loading && <div className="flex h-full items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>}
            {error && <div className="flex h-full flex-col items-center justify-center gap-2"><p className="text-sm text-red-500">{error}</p><button onClick={recargar} className="text-xs text-blue-600 underline">Reintentar</button></div>}
            {!loading && !error && productos.length === 0 && <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400"><span className="text-3xl">📭</span><p className="text-sm">Sin productos</p></div>}
            {!loading && !error && productos.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {productos.map(p => <ProductCard key={p.id} producto={p} onAgregar={handleAgregar} />)}
              </div>
            )}
          </div>
        </section>
        <CartPanel grupos={grupos} total={total} totalItems={totalItems} metodoPago={metodoPago}
          procesando={procesando} tipoDoc={tipoDoc} onTipoDoc={setTipoDoc}
          onCambiarCantidad={cambiarCantidad} onEliminar={eliminar}
          onVaciar={vaciar} onMetodoPago={setMetodoPago} onCobrar={handleCobrar} />
      </div>
      {modalCliente && <ModalCliente total={total} onConfirmar={cobrarConFactura} onCancelar={() => setModalCliente(false)} />}
      {toast && <ToastSRI toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}