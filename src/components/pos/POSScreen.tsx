'use client'

import { useState, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useInventario, useCarrito } from '@/hooks'
import { ProductCard } from './ProductCard'
import { CartPanel } from './CartPanel'
import { diasRestantes } from '@/types'
import type { Producto } from '@/types'

type Toast = { mensaje: string; tipo: 'ok' | 'error' }

export function POSScreen({ establecimientoId }: { establecimientoId: number }) {
  const [catActiva, setCatActiva] = useState<number | null>(null)
  const [searchQ, setSearchQ]     = useState('')
  const [toast, setToast]         = useState<Toast | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [avisoLote, setAvisoLote] = useState<{ nombre: string; precioAnterior: number; precioNuevo: number }[] | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { usuario, logout } = useAuth()

  const { productos, categorias, vendedores, loading, error, buscar, recargar } = useInventario(establecimientoId)
  const { grupos, total, totalItems, metodoPago, setMetodoPago, agregar, cambiarCantidad, eliminar, vaciar, procesarVenta } = useCarrito(establecimientoId)

  const mostrarToast = useCallback((mensaje: string, tipo: Toast['tipo'] = 'ok') => {
    setToast({ mensaje, tipo })
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setToast(null), 2500)
  }, [])

  const handleAgregar = useCallback((p: Producto) => {
    agregar(p); mostrarToast(`${p.categoria?.icono ?? '📦'} ${p.nombre} agregado`)
  }, [agregar, mostrarToast])

  const handleSearch = useCallback((q: string) => {
    setSearchQ(q); buscar(q, catActiva)
  }, [buscar, catActiva])

  const handleCategoria = useCallback((id: number | null) => {
    setCatActiva(id); buscar(searchQ, id)
  }, [buscar, searchQ])

  const handleCobrar = useCallback(async () => {
    setProcesando(true)
    const res = await procesarVenta()
    setProcesando(false)
    if (res.ok) {
      mostrarToast(`✓ ${res.comprobante} procesado`, 'ok')
      await recargar()
      if (res.cambiosPrecio && res.cambiosPrecio.length > 0) {
        const avisos = res.cambiosPrecio.map(c => {
          const nombreProducto = productos.find(p => p.id === c.producto_id)?.nombre ?? `Producto #${c.producto_id}`
          return { nombre: nombreProducto, precioAnterior: c.precio_inicial, precioNuevo: c.precio_final }
        })
        setAvisoLote(avisos)
      }
    } else {
      mostrarToast(`Error: ${res.error}`, 'error')
    }
  }, [procesarVenta, recargar, mostrarToast, productos])

  // Alerta de suscripción próxima a vencer (menos de 7 días)
  const diasSub = usuario?.establecimiento?.fecha_vencimiento
    ? diasRestantes(usuario.establecimiento.fecha_vencimiento as unknown as string)
    : null

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      {/* Alerta de suscripción próxima a vencer */}
      {diasSub !== null && diasSub <= 7 && diasSub >= 0 && (
        <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200 px-5 py-2">
          <span className="text-xs text-amber-700">
            ⚠ Tu suscripción vence en <strong>{diasSub}</strong> {diasSub === 1 ? 'día' : 'días'}. Renueva para no perder el acceso.
          </span>
          {usuario?.establecimiento?.url_pago && (
            <a href={usuario.establecimiento.url_pago as unknown as string} target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium text-amber-700 underline hover:text-amber-900">
              Renovar ahora →
            </a>
          )}
        </div>
      )}

      {/* Topbar */}
      <header className="flex items-center justify-between border-b border-gray-100 bg-white px-5 py-3">
        <div>
          <h1 className="text-sm font-semibold text-gray-900">Punto de venta</h1>
          <p className="text-xs text-gray-400">
            {vendedores.length} vendedores · {new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-medium text-green-700">Abierta</span>
          <span className="text-xs text-gray-500">{usuario?.nombre ?? 'Cajero'}</span>
          <button onClick={logout} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors">
            Salir
          </button>
        </div>
      </header>

      <div className="grid flex-1 overflow-hidden" style={{ gridTemplateColumns: '1fr 360px' }}>
        {/* Panel catálogo */}
        <section className="flex flex-col overflow-hidden">
          <div className="border-b border-gray-100 bg-white px-4 py-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input type="text" value={searchQ} onChange={e => handleSearch(e.target.value)}
                placeholder="Buscar por nombre o código de barras…"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:bg-white" />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto border-b border-gray-100 bg-white px-4 py-2">
            <button onClick={() => handleCategoria(null)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${catActiva === null ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Todos
            </button>
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
          procesando={procesando} onCambiarCantidad={cambiarCantidad} onEliminar={eliminar}
          onVaciar={vaciar} onMetodoPago={setMetodoPago} onCobrar={handleCobrar} />
      </div>

      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg transition-all
          ${toast.tipo === 'ok' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'}`}>
          {toast.mensaje}
        </div>
      )}

      {avisoLote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl border border-amber-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Cambio de lote detectado</h3>
                <p className="mt-0.5 text-xs text-slate-500">Los siguientes productos cambiaron de precio porque se agotó el lote anterior.</p>
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
