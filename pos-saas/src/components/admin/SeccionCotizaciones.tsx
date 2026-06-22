'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useEstablecimiento } from '@/core/context/EstablecimientoContext'
import { generarCotizacionPDF } from '@/lib/generarCotizacionPDF'
import { Plus, Printer, Trash2, FileText, ChevronDown, ChevronUp } from 'lucide-react'

interface ItemCot {
  nombre: string
  cantidad: number
  precioUnitario: number
  descuento: number
}

interface Cotizacion {
  id: number
  numero: string
  cliente_nombre: string
  cliente_identificacion: string | null
  cliente_email: string | null
  cliente_telefono: string | null
  cliente_direccion: string | null
  detalles: ItemCot[]
  subtotal: number
  descuento_total: number
  descuento_porcentaje: number
  total: number
  estado: string
  valido_hasta: string
  notas: string | null
  created_at: string
}

const ESTADOS_COLOR: Record<string, string> = {
  borrador: 'bg-slate-100 text-slate-600',
  enviada: 'bg-blue-50 text-blue-700',
  aceptada: 'bg-emerald-50 text-emerald-700',
  rechazada: 'bg-rose-50 text-rose-600',
  vencida: 'bg-amber-50 text-amber-700',
}

export default function SeccionCotizaciones({ establecimientoId }: { establecimientoId: number }) {
  const { establecimiento, tema } = useEstablecimiento()
  const esOscuro = tema === 'oscuro'
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  // Productos para autocomplete
  const [productos, setProductos] = useState<{ id: number; nombre: string; precio_venta: number }[]>([])
  const [sugerencias, setSugerencias] = useState<{ id: number; nombre: string; precio_venta: number }[]>([])
  const [itemConFoco, setItemConFoco] = useState<number | null>(null)
  const seleccionandoSugerencia = useState(false)

  // Form
  const [cliente, setCliente] = useState({ nombre: '', identificacion: '', email: '', telefono: '', direccion: '' })
  const [items, setItems] = useState<ItemCot[]>([{ nombre: '', cantidad: 1, precioUnitario: 0, descuento: 0 }])
  const [descuentoGlobal, setDescuentoGlobal] = useState(0)
  const [activarDescuento, setActivarDescuento] = useState(false)
  const [validoHasta, setValidoHasta] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 15); return d.toISOString().slice(0, 10)
  })
  const [notas, setNotas] = useState('')

  const t = {
    bg: esOscuro ? 'bg-zinc-950' : 'bg-slate-50',
    card: esOscuro ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200',
    title: esOscuro ? 'text-zinc-100' : 'text-slate-900',
    sub: esOscuro ? 'text-zinc-500' : 'text-slate-500',
    input: esOscuro
      ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500'
      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500',
    btnPrimary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    btnSecondary: esOscuro ? 'border-zinc-700 text-zinc-400 hover:bg-zinc-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
    divider: esOscuro ? 'border-zinc-800' : 'border-slate-100',
  }

  const inputCls = `w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 transition-colors ${t.input}`

  const cargar = useCallback(async () => {
    setCargando(true)
    const { data } = await supabase
      .from('cotizaciones').select('*')
      .eq('establecimiento_id', establecimientoId)
      .order('created_at', { ascending: false })
    setCotizaciones((data ?? []) as Cotizacion[])
    setCargando(false)
  }, [establecimientoId])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    supabase.from('productos').select('id, nombre, precio_venta')
      .eq('establecimiento_id', establecimientoId).order('nombre')
      .then(({ data }) => setProductos(data ?? []))
  }, [establecimientoId])

  useEffect(() => {
    const cerrar = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.autocomplete-wrap')) {
        setSugerencias([])
        setItemConFoco(null)
      }
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [])

  const calcTotales = () => {
    const subtotal = items.reduce((s, it) => s + (it.precioUnitario - it.descuento) * it.cantidad, 0)
    const montoDescGlobal = activarDescuento ? subtotal * (descuentoGlobal / 100) : 0
    const total = subtotal - montoDescGlobal
    return { subtotal, montoDescGlobal, total }
  }

  const { subtotal, montoDescGlobal, total } = calcTotales()

  const agregarItem = () => setItems(prev => [...prev, { nombre: '', cantidad: 1, precioUnitario: 0, descuento: 0 }])
  const quitarItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const actualizarItem = (i: number, campo: keyof ItemCot, valor: string | number) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it))
    if (campo === 'nombre' && typeof valor === 'string' && valor.length >= 1) {
      const filtro = productos.filter(p => p.nombre.toLowerCase().includes(valor.toLowerCase())).slice(0, 6)
      setSugerencias(filtro)
      setItemConFoco(i)
    } else if (campo === 'nombre') {
      setSugerencias([])
      setItemConFoco(null)
    }
  }

  const seleccionarProducto = (i: number, p: { nombre: string; precio_venta: number }) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, nombre: p.nombre, precioUnitario: p.precio_venta } : it))
    setSugerencias([])
    setItemConFoco(null)
  }

  const generarNumero = () => `COT-${Date.now().toString().slice(-8)}`

  const guardarCotizacion = async () => {
    if (!cliente.nombre || items.some(it => !it.nombre)) {
      setMensaje('❌ Completa el nombre del cliente y todos los productos.')
      return
    }
    setGuardando(true)
    setMensaje(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('cotizaciones').insert({
      establecimiento_id: establecimientoId,
      numero: generarNumero(),
      cliente_nombre: cliente.nombre,
      cliente_identificacion: cliente.identificacion || null,
      cliente_email: cliente.email || null,
      cliente_telefono: cliente.telefono || null,
      cliente_direccion: cliente.direccion || null,
      detalles: items,
      subtotal,
      descuento_total: montoDescGlobal,
      descuento_porcentaje: activarDescuento ? descuentoGlobal : 0,
      total,
      estado: 'borrador',
      valido_hasta: new Date(validoHasta).toISOString(),
      notas: notas || null,
      creado_por: user?.id,
    })
    setGuardando(false)
    if (!error) {
      setMensaje('✅ Cotización guardada')
      setMostrarForm(false)
      setCliente({ nombre: '', identificacion: '', email: '', telefono: '', direccion: '' })
      setItems([{ nombre: '', cantidad: 1, precioUnitario: 0, descuento: 0 }])
      setDescuentoGlobal(0)
      setActivarDescuento(false)
      setNotas('')
      cargar()
    } else {
      setMensaje(`❌ ${error.message}`)
    }
  }

  const imprimirCotizacion = (c: Cotizacion) => {
    generarCotizacionPDF({
      numeroCotizacion: c.numero,
      fechaEmision: new Date(c.created_at).toLocaleDateString('es-EC'),
      validoHasta: new Date(c.valido_hasta).toLocaleDateString('es-EC'),
      negocio: {
        nombre: establecimiento?.nombre ?? 'Mi Negocio',
        ruc: establecimiento?.ruc_nit,
        direccion: establecimiento?.direccion,
        whatsapp: establecimiento?.whatsapp,
        email: establecimiento?.email_negocio,
        logoUrl: establecimiento?.logo_url,
      },
      cliente: {
        nombre: c.cliente_nombre,
        identificacion: c.cliente_identificacion,
        email: c.cliente_email,
        telefono: c.cliente_telefono,
        direccion: c.cliente_direccion,
      },
      items: c.detalles,
      descuentoGlobal: c.descuento_porcentaje,
      notas: c.notas,
    })
  }

  const eliminarCotizacion = async (id: number) => {
    if (!confirm('¿Eliminar esta cotización?')) return
    await supabase.from('cotizaciones').delete().eq('id', id)
    cargar()
  }

  const cambiarEstado = async (id: number, estado: string) => {
    await supabase.from('cotizaciones').update({ estado }).eq('id', id)
    cargar()
  }

  const fmt = (n: number) => `$${Number(n).toFixed(2)}`

  return (
    <div className="space-y-5">
      {/* Header acciones */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-sm font-semibold ${t.title}`}>Cotizaciones</h2>
          <p className={`text-xs ${t.sub} mt-0.5`}>{cotizaciones.length} cotizaciones registradas</p>
        </div>
        <button
          onClick={() => setMostrarForm(!mostrarForm)}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${t.btnPrimary}`}
        >
          {mostrarForm ? <ChevronUp size={14} /> : <Plus size={14} />}
          {mostrarForm ? 'Cancelar' : 'Nueva cotización'}
        </button>
      </div>

      {mensaje && (
        <div className={`rounded-xl px-4 py-3 text-sm ${mensaje.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
          {mensaje}
        </div>
      )}

      {/* Formulario nueva cotización */}
      {mostrarForm && (
        <div className={`rounded-2xl border ${t.card} p-6 space-y-5`}>
          <h3 className={`text-sm font-semibold ${t.title}`}>📋 Nueva cotización</h3>

          {/* Datos del cliente */}
          <div className="space-y-2">
            <p className={`text-xs font-semibold uppercase tracking-wide ${t.sub}`}>Datos del cliente</p>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Nombre / Razón social *" value={cliente.nombre} onChange={e => setCliente(f => ({ ...f, nombre: e.target.value }))} className={inputCls} />
              <input placeholder="CI / RUC" value={cliente.identificacion} onChange={e => setCliente(f => ({ ...f, identificacion: e.target.value }))} className={inputCls} />
              <input placeholder="Email" type="email" value={cliente.email} onChange={e => setCliente(f => ({ ...f, email: e.target.value }))} className={inputCls} />
              <input placeholder="Teléfono" value={cliente.telefono} onChange={e => setCliente(f => ({ ...f, telefono: e.target.value }))} className={inputCls} />
              <input placeholder="Dirección" value={cliente.direccion} onChange={e => setCliente(f => ({ ...f, direccion: e.target.value }))} className={`${inputCls} col-span-2`} />
            </div>
          </div>

          {/* Productos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className={`text-xs font-semibold uppercase tracking-wide ${t.sub}`}>Productos / Servicios</p>
              <button onClick={agregarItem} className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                <Plus size={12} /> Agregar línea
              </button>
            </div>
            <div className={`rounded-xl border ${esOscuro ? 'border-zinc-700' : 'border-slate-200'} overflow-hidden`}>
              <table className="w-full text-sm">
                <thead className={`text-xs ${esOscuro ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-50 text-slate-500'}`}>
                  <tr>
                    <th className="px-3 py-2 text-left">Descripción</th>
                    <th className="px-3 py-2 text-center w-20">Cant.</th>
                    <th className="px-3 py-2 text-right w-28">Precio</th>
                    <th className="px-3 py-2 text-right w-28">Desc. unit.</th>
                    <th className="px-3 py-2 text-right w-24">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className={`border-t ${esOscuro ? 'border-zinc-700' : 'border-slate-100'}`}>
                      <td className="px-2 py-1.5 relative autocomplete-wrap">
                        <input
                          placeholder="Nombre del producto/servicio"
                          value={it.nombre}
                          onChange={e => actualizarItem(i, 'nombre', e.target.value)}
                          onFocus={() => {
                            if (it.nombre.length >= 1) {
                              const filtro = productos.filter(p => p.nombre.toLowerCase().includes(it.nombre.toLowerCase())).slice(0, 6)
                              setSugerencias(filtro)
                              setItemConFoco(i)
                            }
                          }}
                          className={inputCls}
                          autoComplete="off"
                        />
                        {itemConFoco === i && sugerencias.length > 0 && (
                          <div className={`absolute left-2 right-2 top-full mt-1 rounded-xl border shadow-lg z-50 overflow-hidden ${esOscuro ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-slate-200'}`}>
                            {sugerencias.map(p => (
                              <button
                                key={p.id}
                                onPointerDown={e => { e.preventDefault(); seleccionarProducto(i, p) }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${esOscuro ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-slate-50 text-slate-700'}`}
                              >
                                <span className="truncate">{p.nombre}</span>
                                <span className={`ml-2 font-semibold text-indigo-500 flex-shrink-0`}>${p.precio_venta.toFixed(2)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="1" value={it.cantidad} onChange={e => actualizarItem(i, 'cantidad', parseFloat(e.target.value) || 1)} className={`${inputCls} text-center`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" step="0.01" value={it.precioUnitario} onChange={e => actualizarItem(i, 'precioUnitario', parseFloat(e.target.value) || 0)} className={`${inputCls} text-right`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" step="0.01" value={it.descuento} onChange={e => actualizarItem(i, 'descuento', parseFloat(e.target.value) || 0)} className={`${inputCls} text-right`} />
                      </td>
                      <td className={`px-3 text-right font-medium text-sm ${t.title}`}>
                        {fmt((it.precioUnitario - it.descuento) * it.cantidad)}
                      </td>
                      <td className="px-2">
                        {items.length > 1 && (
                          <button onClick={() => quitarItem(i)} className="text-zinc-400 hover:text-rose-400">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Descuento global */}
          <div className={`rounded-xl border p-4 space-y-3 ${esOscuro ? 'border-zinc-700 bg-zinc-800/40' : 'border-slate-200 bg-slate-50'}`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={activarDescuento} onChange={e => setActivarDescuento(e.target.checked)} className="rounded" />
              <span className={`text-sm font-medium ${t.title}`}>Aplicar descuento global (%)</span>
            </label>
            {activarDescuento && (
              <div className="flex items-center gap-3">
                <input type="number" min="0" max="100" step="0.5" value={descuentoGlobal}
                  onChange={e => setDescuentoGlobal(parseFloat(e.target.value) || 0)}
                  className={`w-28 ${inputCls}`} placeholder="0" />
                <span className={`text-sm ${t.sub}`}>% de descuento sobre subtotal</span>
              </div>
            )}
          </div>

          {/* Resumen totales */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5">
              <div className={`flex justify-between text-sm ${t.sub}`}>
                <span>Subtotal</span><span className={t.title}>{fmt(subtotal)}</span>
              </div>
              {activarDescuento && descuentoGlobal > 0 && (
                <div className="flex justify-between text-sm text-rose-500">
                  <span>Descuento ({descuentoGlobal}%)</span><span>-{fmt(montoDescGlobal)}</span>
                </div>
              )}
              <div className={`flex justify-between text-base font-bold pt-2 border-t ${t.divider} ${t.title}`}>
                <span>Total</span><span className="text-indigo-600">{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* Validez y notas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`text-xs font-medium ${t.sub} mb-1 block`}>Válida hasta</label>
              <input type="date" value={validoHasta} onChange={e => setValidoHasta(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={`text-xs font-medium ${t.sub} mb-1 block`}>Notas / Condiciones</label>
              <input placeholder="Ej: Precios sujetos a disponibilidad" value={notas} onChange={e => setNotas(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={() => setMostrarForm(false)} className={`rounded-xl border px-4 py-2.5 text-sm transition-colors ${t.btnSecondary}`}>
              Cancelar
            </button>
            <button onClick={guardarCotizacion} disabled={guardando} className={`flex-1 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors ${t.btnPrimary} disabled:opacity-50`}>
              {guardando ? 'Guardando…' : '💾 Guardar cotización'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de cotizaciones */}
      {cargando ? (
        <div className={`text-center py-10 text-sm ${t.sub}`}>Cargando…</div>
      ) : cotizaciones.length === 0 ? (
        <div className={`rounded-2xl border ${t.card} p-12 text-center space-y-3`}>
          <FileText size={32} className={`mx-auto ${t.sub}`} />
          <p className={`text-sm ${t.sub}`}>No hay cotizaciones aún</p>
        </div>
      ) : (
        <div className={`rounded-2xl border ${t.card} overflow-hidden`}>
          <table className="w-full text-sm">
            <thead className={`border-b ${t.divider} text-xs uppercase tracking-wide ${t.sub}`}>
              <tr>
                <th className="px-5 py-3 text-left">Número</th>
                <th className="px-5 py-3 text-left">Cliente</th>
                <th className="px-5 py-3 text-left">Fecha</th>
                <th className="px-5 py-3 text-left">Válida hasta</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-left">Estado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cotizaciones.map(c => (
                <tr key={c.id} className={`border-b ${t.divider} hover:${esOscuro ? 'bg-zinc-800/30' : 'bg-slate-50/80'} transition-colors`}>
                  <td className={`px-5 py-3 font-mono text-xs ${t.sub}`}>{c.numero}</td>
                  <td className={`px-5 py-3 font-medium ${t.title}`}>{c.cliente_nombre}</td>
                  <td className={`px-5 py-3 text-xs ${t.sub}`}>{new Date(c.created_at).toLocaleDateString('es-EC')}</td>
                  <td className={`px-5 py-3 text-xs ${t.sub}`}>{new Date(c.valido_hasta).toLocaleDateString('es-EC')}</td>
                  <td className={`px-5 py-3 text-right font-semibold text-indigo-500`}>{fmt(Number(c.total))}</td>
                  <td className="px-5 py-3">
                    <select value={c.estado} onChange={e => cambiarEstado(c.id, e.target.value)}
                      className={`text-xs rounded-lg px-2 py-1 border outline-none ${ESTADOS_COLOR[c.estado] ?? 'bg-slate-100 text-slate-600'} ${esOscuro ? 'border-zinc-700' : 'border-slate-200'}`}>
                      <option value="borrador">Borrador</option>
                      <option value="enviada">Enviada</option>
                      <option value="aceptada">Aceptada</option>
                      <option value="rechazada">Rechazada</option>
                      <option value="vencida">Vencida</option>
                    </select>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => imprimirCotizacion(c)} className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
                        <Printer size={13} /> Imprimir
                      </button>
                      <button onClick={() => eliminarCotizacion(c.id)} className="text-zinc-400 hover:text-rose-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}