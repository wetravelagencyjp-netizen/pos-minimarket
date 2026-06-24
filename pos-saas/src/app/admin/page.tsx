'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ModalEmitirFactura from '@/components/pos/ModalEmitirFactura'
import SeccionContabilidad from '@/components/admin/SeccionContabilidad'
import SeccionCotizaciones from '@/components/admin/SeccionCotizaciones'
import IngresoInventarioInteligente from '@/components/admin/IngresoInventarioInteligente'
import SeccionClientes from '@/components/admin/SeccionClientes'
import SeccionProveedores from '@/components/admin/SeccionProveedores'
import SeccionConfigSRI from '@/components/admin/SeccionConfigSRI'
import { useEstablecimiento } from '@/core/context/EstablecimientoContext'

type Seccion = 'dashboard' | 'productos' | 'vendedores' | 'categorias' | 'equipo' | 'reportes' | 'contabilidad' | 'cotizaciones' | 'cierres' | 'inventario' | 'clientes' | 'proveedores' | 'sri'

export default function AdminPage() {
  const { usuario, logout } = useAuth()
  const router = useRouter()
  const estabId = Number(usuario?.establecimiento_id ?? 1)
  const [seccion, setSeccion] = useState<Seccion>('dashboard')
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0)
  const [sidebarAbierto, setSidebarAbierto] = useState(false)
  const { establecimiento, tema, cambiarTema } = useEstablecimiento()
  const tieneContabilidad = establecimiento?.modulo_contabilidad ?? false
  const esOscuro = tema === 'oscuro'

  useEffect(() => {
    if (!estabId) return
    const cargarPendientes = async () => {
      const { count } = await supabase
        .from('solicitudes_autorizacion')
        .select('id', { count: 'exact', head: true })
        .eq('establecimiento_id', estabId)
        .eq('estado', 'pendiente')
      setSolicitudesPendientes(count ?? 0)
    }
    cargarPendientes()
    const canal = supabase
      .channel('admin-notif-badge')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'solicitudes_autorizacion',
        filter: `establecimiento_id=eq.${estabId}`,
      }, () => cargarPendientes())
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [estabId])

  const NavItem = ({ id, label, icono, onClick, badge }: {
    id?: string; label: string; icono: string; onClick: () => void; badge?: number
  }) => {
    const activo = id ? seccion === id : false
    return (
      <button
        onClick={() => { onClick(); setSidebarAbierto(false) }}
        className={`w-full flex items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-all ${
          activo
            ? esOscuro ? 'bg-white/10 text-white font-medium shadow-sm' : 'bg-indigo-50 text-indigo-700 font-medium'
            : esOscuro ? 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        <span className="flex items-center gap-2.5">
          <span className="text-base leading-none">{icono}</span>
          <span>{label}</span>
        </span>
        {badge != null && badge > 0 && (
          <span className="relative flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 items-center justify-center text-[9px] font-bold text-white">
              {badge}
            </span>
          </span>
        )}
      </button>
    )
  }

  const Divider = ({ label }: { label: string }) => (
    <div className="px-3 pt-4 pb-1">
      <p className={`text-[10px] font-semibold uppercase tracking-widest ${esOscuro ? 'text-zinc-600' : 'text-slate-400'}`}>{label}</p>
    </div>
  )

  return (
    <div className={`flex h-screen ${esOscuro ? 'bg-zinc-950' : 'bg-slate-50'}`}>

      {/* ── Sidebar overlay móvil ── */}
      {sidebarAbierto && (
        <div className="fixed inset-0 z-40 md:hidden bg-black/50" onClick={() => setSidebarAbierto(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-56 flex flex-col border-r transform transition-transform duration-200
        md:relative md:translate-x-0
        ${sidebarAbierto ? 'translate-x-0' : '-translate-x-full'}
        ${esOscuro ? 'bg-zinc-950 border-zinc-800/60' : 'bg-white border-slate-200'}
      `}>

        {/* Logo / Marca */}
        <div className={`px-4 py-5 border-b ${esOscuro ? 'border-zinc-800/60' : 'border-slate-200'}`}>
          <p className={`text-sm font-bold tracking-tight ${esOscuro ? 'text-white' : 'text-slate-900'}`}>POS de GRPM</p>
          <p className={`text-[11px] mt-0.5 ${esOscuro ? 'text-zinc-500' : 'text-slate-400'}`}>{usuario?.nombre ?? 'Admin'}</p>
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">

          <Divider label="Operación" />
          <NavItem id="dashboard" icono="⚡" label="Dashboard" onClick={() => setSeccion('dashboard')} />
          <NavItem
            icono="🔔"
            label="Notificaciones"
            onClick={() => router.push('/admin/notificaciones')}
            badge={solicitudesPendientes}
          />
          <NavItem icono="🏪" label="Punto de Venta" onClick={() => router.push('/pos')} />
          <NavItem icono="💰" label="Control de Caja" onClick={() => router.push('/caja')} />
          <NavItem id="reportes" icono="📊" label="Ventas" onClick={() => setSeccion('reportes')} />

          <Divider label="Gestión" />
          <NavItem id="clientes" icono="👤" label="Clientes" onClick={() => setSeccion('clientes')} />
          <NavItem id="proveedores" icono="🚚" label="Proveedores" onClick={() => setSeccion('proveedores')} />
          <NavItem id="inventario" icono="📥" label="Inventario" onClick={() => setSeccion('inventario')} />
          <NavItem id="productos" icono="📦" label="Productos" onClick={() => setSeccion('productos')} />
          <NavItem id="cotizaciones" icono="📋" label="Cotizaciones" onClick={() => setSeccion('cotizaciones')} />
          <NavItem id="categorias" icono="🏷️" label="Categorías" onClick={() => setSeccion('categorias')} />

          <Divider label="Personal" />
          <NavItem id="vendedores" icono="🧑‍💼" label="Vendedores" onClick={() => setSeccion('vendedores')} />
          <NavItem id="equipo" icono="👥" label="Mi equipo" onClick={() => setSeccion('equipo')} />
          <NavItem icono="💸" label="Gastos" onClick={() => router.push('/admin/gastos')} />

          {tieneContabilidad && (
            <>
              <Divider label="Contabilidad" />
              <NavItem id="contabilidad" icono="📒" label="Contabilidad" onClick={() => setSeccion('contabilidad')} />
            </>
          )}
          <NavItem id="cierres" icono="📊" label="Cierres y Reportes" onClick={() => setSeccion('cierres')} />

          <Divider label="Sistema" />
          <NavItem id="sri" icono="🧾" label="Config. SRI" onClick={() => setSeccion('sri')} />
          <NavItem icono="⚙️" label="Configuración" onClick={() => router.push('/admin/configuracion')} />
          <NavItem icono="👥" label="Usuarios" onClick={() => router.push('/admin/usuarios')} />
          <NavItem icono="📋" label="Cierres de Caja" onClick={() => router.push('/admin/cajas')} />

        </nav>

        {/* Footer */}
        <div className={`px-3 py-3 border-t ${esOscuro ? 'border-zinc-800/60' : 'border-slate-200'}`}>
          <button
            onClick={logout}
            className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all ${esOscuro ? 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
          >
            <span>🚪</span>
            <span>Salir</span>
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Topbar */}
        <header className={`flex items-center justify-between border-b px-4 py-3.5 ${esOscuro ? 'border-zinc-800/60 bg-zinc-900' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarAbierto(!sidebarAbierto)}
              className={`md:hidden p-2 rounded-lg transition-colors ${esOscuro ? 'text-zinc-400 hover:bg-zinc-800' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              ☰
            </button>
            <h1 className={`text-sm font-semibold capitalize ${esOscuro ? 'text-white' : 'text-slate-900'}`}>
              {seccion === 'dashboard' ? 'Dashboard' :
               seccion === 'productos' ? 'Productos' :
               seccion === 'vendedores' ? 'Vendedores' :
               seccion === 'categorias' ? 'Categorías' :
               seccion === 'equipo' ? 'Mi equipo' :
               seccion === 'contabilidad' ? 'Contabilidad de GRPM' :
               seccion === 'cotizaciones' ? 'Cotizaciones' :
               seccion === 'cierres' ? 'Cierres y Reportes' :
               seccion === 'inventario' ? 'Ingreso de Inventario' :
               seccion === 'clientes' ? 'Clientes' :
               seccion === 'proveedores' ? 'Proveedores' :
               seccion === 'sri' ? 'Configuración SRI' : 'Reportes'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => cambiarTema(esOscuro ? 'claro' : 'oscuro')}
              title="Cambiar tema"
              className={`text-sm px-2.5 py-1.5 rounded-xl transition-colors ${esOscuro ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
            >
              {esOscuro ? '☀️ Claro' : '🌙 Oscuro'}
            </button>
            {solicitudesPendientes > 0 && (
              <button
                onClick={() => router.push('/admin/notificaciones')}
                className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                {solicitudesPendientes} solicitud{solicitudesPendientes > 1 ? 'es' : ''} pendiente{solicitudesPendientes > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </header>

        {/* Secciones */}
        <main className={`flex-1 overflow-y-auto p-3 sm:p-6 ${esOscuro ? 'bg-zinc-950' : 'bg-slate-50'}`}>
          {seccion === 'dashboard' && <ResumenDiarioLive establecimientoId={estabId} />}
          {seccion === 'contabilidad' && <SeccionContabilidad establecimientoId={estabId} />}
          {seccion === 'cotizaciones' && <SeccionCotizaciones establecimientoId={estabId} />}
          {seccion === 'productos' && <SeccionProductos establecimientoId={estabId} />}
          {seccion === 'vendedores' && <SeccionVendedores establecimientoId={estabId} />}
          {seccion === 'categorias' && <SeccionCategorias establecimientoId={estabId} />}
          {seccion === 'equipo' && <SeccionEquipo establecimientoId={estabId} />}
          {seccion === 'reportes' && <SeccionReportes establecimientoId={estabId} />}
          {seccion === 'cierres' && <SeccionCierres establecimientoId={estabId} />}
          {seccion === 'inventario' && <IngresoInventarioInteligente establecimientoId={estabId} />}
          {seccion === 'clientes' && <SeccionClientes establecimientoId={estabId} />}
          {seccion === 'proveedores' && <SeccionProveedores establecimientoId={estabId} />}
          {seccion === 'sri' && <SeccionConfigSRI establecimientoId={estabId} />}
        </main>
      </div>
    </div>
  )
}

// ─── DASHBOARD / RESUMEN DIARIO LIVE ──────────────────────
function ResumenDiarioLive({ establecimientoId }: { establecimientoId: number }) {
  const [datos, setDatos] = useState<{
    totalVentas: number
    numTransacciones: number
    ticketPromedio: number
    comprobantesHoy: number
    porMetodo: Record<string, number>
    porBanco: Record<string, number>
    topProductos: { nombre: string; cantidad: number; total: number }[]
    ultimaActualizacion: Date
  } | null>(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const fechaInicio = hoy.toISOString()

    const [{ data: ventas }, { data: detalle }, { data: pagos }, { count: comprobantes }] = await Promise.all([
      supabase.from('ventas').select('id, total, sri_comprobante_id').eq('establecimiento_id', establecimientoId).gte('fecha_venta', fechaInicio),
      supabase.from('detalle_ventas').select('cantidad, precio_unitario, producto:productos(nombre), venta:ventas!inner(establecimiento_id, fecha_venta)').eq('venta.establecimiento_id', establecimientoId).gte('venta.fecha_venta', fechaInicio),
      supabase.from('pagos_venta').select('metodo_pago, monto, banco_id, bancos(nombre), venta:ventas!inner(establecimiento_id, fecha_venta)').eq('venta.establecimiento_id', establecimientoId).gte('venta.fecha_venta', fechaInicio),
      supabase.from('sri_comprobantes').select('id', { count: 'exact', head: true }).eq('establecimiento_id', establecimientoId).eq('estado', 'AUTORIZADO').gte('fecha_emision', fechaInicio),
    ])

    const totalVentas = (ventas ?? []).reduce((s, v) => s + v.total, 0)
    const numTransacciones = (ventas ?? []).length

    const porMetodo: Record<string, number> = {}
    const porBanco: Record<string, number> = {}
    for (const p of pagos ?? []) {
      porMetodo[p.metodo_pago] = (porMetodo[p.metodo_pago] ?? 0) + Number(p.monto)
      if (p.metodo_pago === 'transferencia') {
        const banco = (p as any).bancos?.nombre ?? 'Sin banco'
        porBanco[banco] = (porBanco[banco] ?? 0) + Number(p.monto)
      }
    }

    const porProducto: Record<string, { nombre: string; cantidad: number; total: number }> = {}
    for (const d of detalle ?? []) {
      const nombre = (d.producto as any)?.nombre ?? 'Desconocido'
      if (!porProducto[nombre]) porProducto[nombre] = { nombre, cantidad: 0, total: 0 }
      porProducto[nombre].cantidad += d.cantidad
      porProducto[nombre].total += d.precio_unitario * d.cantidad
    }
    const topProductos = Object.values(porProducto).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5)

    setDatos({
      totalVentas,
      numTransacciones,
      ticketPromedio: numTransacciones ? totalVentas / numTransacciones : 0,
      comprobantesHoy: comprobantes ?? 0,
      porMetodo,
      porBanco,
      topProductos,
      ultimaActualizacion: new Date(),
    })
    setCargando(false)
  }, [establecimientoId])

  useEffect(() => {
    cargar()
    const intervalo = setInterval(cargar, 30000)
    return () => clearInterval(intervalo)
  }, [cargar])

  const fmt = (n: number) => `$${n.toFixed(2)}`
  const maxProducto = datos?.topProductos[0]?.cantidad || 1
  const totalMetodos = Object.values(datos?.porMetodo ?? {}).reduce((s, v) => s + v, 0) || 1

  const METODO_LABEL: Record<string, string> = {
    efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', credito: 'Crédito', mixto: 'Mixto',
  }
  const METODO_COLOR: Record<string, string> = {
    efectivo: 'bg-emerald-500', tarjeta: 'bg-blue-500', transferencia: 'bg-violet-500', credito: 'bg-amber-500', mixto: 'bg-slate-400',
  }

  if (cargando) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Última actualización */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">Actualiza cada 30 segundos</p>
        <div className="flex items-center gap-3">
          <p className="text-xs text-zinc-600">Última actualización: {datos?.ultimaActualizacion.toLocaleTimeString('es-EC')}</p>
          <button
            onClick={() => exportarCierrePDF(datos!, establecimientoId)}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white transition-colors"
          >
            🖨️ Exportar cierre de hoy
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Ventas del día', valor: fmt(datos?.totalVentas ?? 0), icono: '💰', color: 'text-emerald-400' },
          { label: 'Transacciones', valor: String(datos?.numTransacciones ?? 0), icono: '🧾', color: 'text-blue-400' },
          { label: 'Ticket promedio', valor: fmt(datos?.ticketPromedio ?? 0), icono: '📊', color: 'text-violet-400' },
          { label: 'Comprobantes SRI', valor: String(datos?.comprobantesHoy ?? 0), icono: '✅', color: 'text-amber-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5">
            <p className="text-2xl mb-3">{kpi.icono}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.valor}</p>
            <p className="text-xs text-zinc-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Métodos de pago */}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">💳 Desglose por método de pago</h2>
          {Object.keys(datos?.porMetodo ?? {}).length === 0 ? (
            <p className="text-xs text-zinc-500">Sin ventas hoy</p>
          ) : (
            <>
              {Object.entries(datos?.porMetodo ?? {}).sort((a, b) => b[1] - a[1]).map(([metodo, monto]) => (
                <div key={metodo} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-300">{METODO_LABEL[metodo] ?? metodo}</span>
                    <span className="font-medium text-white">{fmt(monto)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800">
                    <div
                      className={`h-1.5 rounded-full ${METODO_COLOR[metodo] ?? 'bg-slate-500'}`}
                      style={{ width: `${(monto / totalMetodos) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-600">{((monto / totalMetodos) * 100).toFixed(1)}% del total</p>
                </div>
              ))}
              {Object.keys(datos?.porBanco ?? {}).length > 0 && (
                <div className="pt-3 border-t border-zinc-800 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Desglose por banco</p>
                  {Object.entries(datos?.porBanco ?? {}).sort((a, b) => b[1] - a[1]).map(([banco, monto]) => (
                    <div key={banco} className="flex justify-between text-xs">
                      <span className="text-zinc-400">🏦 {banco}</span>
                      <span className="font-medium text-violet-400">{fmt(monto)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Top 5 productos */}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">🏆 Top 5 productos del día</h2>
          {datos?.topProductos.length === 0 ? (
            <p className="text-xs text-zinc-500">Sin ventas hoy</p>
          ) : (
            datos?.topProductos.map((p, i) => (
              <div key={p.nombre} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0
                      ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-zinc-400' : i === 2 ? 'bg-amber-700' : 'bg-zinc-700'}`}>
                      {i + 1}
                    </span>
                    <span className="text-sm text-zinc-300 truncate max-w-[130px]">{p.nombre}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-white">{p.cantidad} uds</p>
                    <p className="text-[10px] text-zinc-500">{fmt(p.total)}</p>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800">
                  <div
                    className={`h-1.5 rounded-full ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-zinc-400' : 'bg-blue-500'}`}
                    style={{ width: `${(p.cantidad / maxProducto) * 100}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── PRODUCTOS (con importador Excel) ──────────────────────
function SeccionProductos({ establecimientoId }: { establecimientoId: number }) {
  const { usuario } = useAuth()
  const [productos, setProductos] = useState<any[]>([])
  const [vendedores, setVendedores] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nombre: '', precio_costo: '', precio_venta: '', stock_actual: '', vendedor_id: '', categoria_id: '', codigo_barras: '', imagen_url: '', visible_en_catalogo: true })
  const [editando, setEditando] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [mostrarImportador, setMostrarImportador] = useState(false)
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const [loteParaProducto, setLoteParaProducto] = useState<any | null>(null)

  const [modoPrecio, setModoPrecio] = useState<'manual' | 'margen'>('manual')
  const [margenProducto, setMargenProducto] = useState('')
  const [margenDefecto, setMargenDefecto] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    const [p, v, c] = await Promise.all([
      supabase.from('productos').select('*, vendedor:vendedores(nombre), categoria:categorias(nombre)').eq('establecimiento_id', establecimientoId).order('nombre'),
      supabase.from('vendedores').select('*').eq('establecimiento_id', establecimientoId),
      supabase.from('categorias').select('*').eq('establecimiento_id', establecimientoId),
    ])
    setProductos(p.data ?? [])
    setVendedores(v.data ?? [])
    setCategorias(c.data ?? [])
    setLoading(false)
  }, [establecimientoId])


  useEffect(() => {
    if (modoPrecio !== 'margen') return
    const costo = parseFloat(form.precio_costo)
    const margen = parseFloat(margenProducto)
    if (!costo || costo <= 0 || isNaN(margen)) return
    setForm(f => ({ ...f, precio_venta: (costo * (1 + margen / 100)).toFixed(2) }))
  }, [modoPrecio, form.precio_costo, margenProducto])

  useEffect(() => {
    supabase.from('establecimientos').select('margen_costo_estimado').eq('id', establecimientoId).single()
      .then(({ data }) => setMargenDefecto(data?.margen_costo_estimado != null ? String(data.margen_costo_estimado) : ''))
  }, [establecimientoId])

  useEffect(() => { cargar() }, [cargar])

  const limpiarForm = () => {
    setForm({ nombre: '', precio_costo: '', precio_venta: '', stock_actual: '', vendedor_id: '', categoria_id: '', codigo_barras: '', imagen_url: '', visible_en_catalogo: true })
    setModoPrecio('manual')
    setMargenProducto('')
  }

  const subirImagen = async (file: File) => {
    setSubiendoImagen(true)
    const ext = file.name.split('.').pop()
    const nombreArchivo = `${establecimientoId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('productos').upload(nombreArchivo, file)
    if (error) {
      alert('Error subiendo la foto: ' + error.message)
      setSubiendoImagen(false)
      return
    }
    const { data } = supabase.storage.from('productos').getPublicUrl(nombreArchivo)
    setForm(f => ({ ...f, imagen_url: data.publicUrl }))
    setSubiendoImagen(false)
  }

  const handleArchivoImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) subirImagen(file)
  }

  const guardar = async () => {
    if (!form.nombre || !form.precio_venta) return
    setGuardando(true)
    const datos = {
      establecimiento_id: establecimientoId,
      nombre: form.nombre,
      precio_costo: form.precio_costo ? parseFloat(form.precio_costo) : null,
      precio_venta: parseFloat(form.precio_venta),
      stock_actual: parseInt(form.stock_actual) || 0,
      vendedor_id: form.vendedor_id ? parseInt(form.vendedor_id) : null,
      categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
      codigo_barras: form.codigo_barras || null,
      imagen_url: form.imagen_url || null,
      visible_en_catalogo: form.visible_en_catalogo,
    }
    if (editando) {
      await supabase.from('productos').update(datos).eq('id', editando)
    } else {
      await supabase.from('productos').insert(datos)
    }
    setGuardando(false)
    setEditando(null)
    limpiarForm()
    cargar()
  }

  const editar = (p: any) => {
    setEditando(p.id)
    setForm({ nombre: p.nombre, precio_costo: p.precio_costo != null ? String(p.precio_costo) : '', precio_venta: String(p.precio_venta), stock_actual: String(p.stock_actual), vendedor_id: String(p.vendedor_id ?? ''), categoria_id: String(p.categoria_id ?? ''), codigo_barras: p.codigo_barras ?? '', imagen_url: p.imagen_url ?? '', visible_en_catalogo: p.visible_en_catalogo ?? true })
    setModoPrecio('manual')
  }

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar este producto?')) return
    await supabase.from('productos').delete().eq('id', id)
    cargar()
  }

  const exportarInventario = async () => {
    const XLSX = await import('xlsx')
    const filas = productos.map(p => ({
      'Código de Barra': p.codigo_barras || '',
      'Nombre del Producto': p.nombre,
      'Categoría': p.categoria?.nombre ?? '',
      'Vendedor': p.vendedor?.nombre ?? '',
      'Precio de Costo': p.precio_costo ?? '',
      'Precio de Venta': p.precio_venta,
      'Stock Actual': p.stock_actual,
    }))
    const ws = XLSX.utils.json_to_sheet(filas)
    ws['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
    const nombreTienda = (usuario?.establecimiento?.nombre ?? 'tienda').toLowerCase().replace(/[^a-z0-9]+/g, '_')
    const fecha = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `inventario_${nombreTienda}_${fecha}.xlsx`)
  }

  return (
    <div className="space-y-6">
      
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">{editando ? '✏️ Editar producto' : '➕ Nuevo producto'}</h2>
          <div className="flex items-center gap-2">
            <button onClick={exportarInventario}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50">
              📥 Exportar Inventario
            </button>
            <button onClick={() => setMostrarImportador(true)}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100">
              📊 Importar desde Excel
            </button>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {form.imagen_url ? (
                <img src={form.imagen_url} alt="Foto del producto" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl text-slate-300">📦</span>
              )}
            </div>
            <input type="file" accept="image/*" onChange={handleArchivoImagen} className="hidden" id="imagen-producto" />
            <label htmlFor="imagen-producto"
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 transition-colors hover:bg-slate-50">
              {subiendoImagen ? 'Subiendo…' : form.imagen_url ? 'Cambiar foto' : '📷 Subir foto'}
            </label>
          </div>
          <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Nombre del producto *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10" />
            <input placeholder="Código de barras" value={form.codigo_barras} onChange={e => setForm(f => ({ ...f, codigo_barras: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10" />
            <input placeholder="Precio de costo" type="number" value={form.precio_costo} onChange={e => setForm(f => ({ ...f, precio_costo: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10" />
            <div>
              <div className="mb-1.5 flex gap-1">
                <button type="button" onClick={() => setModoPrecio('manual')}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${modoPrecio === 'manual' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  💰 Precio fijo
                </button>
                <button type="button" onClick={() => { setModoPrecio('margen'); if (!margenProducto) setMargenProducto(margenDefecto) }}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${modoPrecio === 'margen' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  📊 Por margen %
                </button>
              </div>
              {modoPrecio === 'manual' ? (
                <input placeholder="Precio de venta *" type="number" value={form.precio_venta} onChange={e => setForm(f => ({ ...f, precio_venta: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10" />
              ) : (
                <div>
                  <div className="relative">
                    <input placeholder="Margen %" type="number" value={margenProducto} onChange={e => setMargenProducto(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 pr-7 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10" />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                  </div>
                  {form.precio_venta && <p className="mt-1.5 text-[11px] text-slate-500">Precio de venta: ${form.precio_venta}</p>}
                </div>
              )}
            </div>
            <input placeholder="Stock actual" type="number" value={form.stock_actual} onChange={e => setForm(f => ({ ...f, stock_actual: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10" />
            <select value={form.vendedor_id} onChange={e => setForm(f => ({ ...f, vendedor_id: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10">
              <option value="">— Seleccionar vendedor —</option>
              {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
            <select value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10">
              <option value="">— Seleccionar categoría —</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-600">
              <input type="checkbox" checked={form.visible_en_catalogo} onChange={e => setForm(f => ({ ...f, visible_en_catalogo: e.target.checked }))}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30" />
              🛍️ Mostrar en catálogo web
            </label>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={guardar} disabled={guardando}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none">
            {guardando ? 'Guardando…' : editando ? 'Actualizar' : 'Agregar producto'}
          </button>
          {editando && <button onClick={() => { setEditando(null); limpiarForm() }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-500 transition-colors hover:bg-slate-50">Cancelar</button>}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/50">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">Productos ({productos.length})</h2>
        </div>
        {loading ? <div className="p-6 text-sm text-slate-400">Cargando…</div> : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-3 text-left">Foto</th>
                <th className="px-3 py-3 text-left">Nombre</th>
                <th className="px-3 py-3 text-left hidden sm:table-cell">Vendedor</th>
                <th className="px-3 py-3 text-left hidden sm:table-cell">Categoría</th>
                <th className="px-3 py-3 text-right">Precio</th>
                <th className="px-3 py-3 text-right hidden sm:table-cell">Stock</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map(p => (
                <tr key={p.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/80">
                  <td className="px-6 py-3">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                      {p.imagen_url ? (
                        <img src={p.imagen_url} alt={p.nombre} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-base">{p.categoria?.icono ?? '📦'}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-medium text-slate-900">{p.nombre}</td>
                  <td className="px-3 py-3 text-slate-500 hidden sm:table-cell">{p.vendedor?.nombre ?? '—'}</td>
                  <td className="px-3 py-3 text-slate-500 hidden sm:table-cell">{p.categoria?.nombre ?? '—'}</td>
                  <td className="px-3 py-3 text-right text-slate-900">${p.precio_venta.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right text-slate-900 hidden sm:table-cell">{p.stock_actual}</td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => setLoteParaProducto(p)} className="mr-3 text-xs font-medium text-emerald-600 hover:text-emerald-700">📦 Stock</button>
                    <button onClick={() => editar(p)} className="mr-3 text-xs font-medium text-indigo-600 hover:text-indigo-700">Editar</button>
                    <button onClick={() => eliminar(p.id)} className="text-xs font-medium text-rose-500 hover:text-rose-600">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {mostrarImportador && (
        <ImportadorExcel
          establecimientoId={establecimientoId}
          vendedores={vendedores}
          categorias={categorias}
          onCerrar={() => setMostrarImportador(false)}
          onImportado={() => { setMostrarImportador(false); cargar() }}
        />
      )}

      {loteParaProducto && (
        <ModalNuevoLote
          producto={loteParaProducto}
          establecimientoId={establecimientoId}
          onCerrar={() => setLoteParaProducto(null)}
          onGuardado={() => { setLoteParaProducto(null); cargar() }}
        />
      )}
    </div>
  )
}// ─── IMPORTADOR EXCEL ──────────────────────────────────────
type FilaImportada = {
  nombre: string
  precio_venta: number | null
  stock_actual: number
  categoria_nombre: string
  codigo_barras: string
  vendedor_nombre: string
  error?: string
}

function ImportadorExcel({
  establecimientoId, vendedores, categorias, onCerrar, onImportado,
}: {
  establecimientoId: number
  vendedores: any[]
  categorias: any[]
  onCerrar: () => void
  onImportado: () => void
}) {
  const [filas, setFilas] = useState<FilaImportada[]>([])
  const [archivoNombre, setArchivoNombre] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: number; errores: number } | null>(null)
  const [crearCategoriasFaltantes, setCrearCategoriasFaltantes] = useState(true)

  const descargarPlantilla = () => {
    import('xlsx').then(XLSX => {
      const datos = [
        { nombre: 'Coca Cola 600ml', precio_venta: 0.75, stock_actual: 100, categoria: 'Bebidas y Licores', codigo_barras: '7891234567890', vendedor: '' },
        { nombre: 'Pan de molde', precio_venta: 1.5, stock_actual: 50, categoria: 'Panadería', codigo_barras: '', vendedor: '' },
      ]
      const ws = XLSX.utils.json_to_sheet(datos)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Productos')
      XLSX.writeFile(wb, 'plantilla_productos.xlsx')
    })
  }

  const handleArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivoNombre(file.name)
    setProcesando(true)
    setResultado(null)

    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const XLSX = await import('xlsx')
        const data = ev.target?.result
        const wb = XLSX.read(data, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

        const parsed: FilaImportada[] = rows.map(row => {
          const nombre = String(row.nombre ?? row.Nombre ?? '').trim()
          const precioRaw = row.precio_venta ?? row.precio ?? row.Precio ?? row['Precio de venta']
          const precio = precioRaw !== '' && precioRaw !== undefined ? parseFloat(String(precioRaw).replace(',', '.')) : null
          const stockRaw = row.stock_actual ?? row.stock ?? row.Stock ?? 0
          const stock = parseInt(String(stockRaw)) || 0
          const categoria_nombre = String(row.categoria ?? row.Categoria ?? row['Categoría'] ?? '').trim()
          const codigo_barras = String(row.codigo_barras ?? row['código de barras'] ?? row['Código de barras'] ?? '').trim()
          const vendedor_nombre = String(row.vendedor ?? row.Vendedor ?? '').trim()

          let error: string | undefined
          if (!nombre) error = 'Falta el nombre'
          else if (precio === null || isNaN(precio) || precio <= 0) error = 'Precio inválido'

          return { nombre, precio_venta: precio, stock_actual: stock, categoria_nombre, codigo_barras, vendedor_nombre, error }
        }).filter(f => f.nombre || f.precio_venta !== null)

        setFilas(parsed)
      } catch {
        setFilas([])
        setResultado({ ok: 0, errores: 1 })
      }
      setProcesando(false)
    }
    reader.readAsBinaryString(file)
  }

  const filasValidas = filas.filter(f => !f.error)
  const filasConError = filas.filter(f => f.error)

  const confirmarImportacion = async () => {
    setImportando(true)
    let ok = 0
    let errores = filasConError.length

    const catMap = new Map(categorias.map(c => [c.nombre.toLowerCase(), c.id]))
    const venMap = new Map(vendedores.map(v => [v.nombre.toLowerCase(), v.id]))

    if (crearCategoriasFaltantes) {
      const nombresFaltantes = Array.from(new Set(
        filasValidas
          .map(f => f.categoria_nombre)
          .filter(n => n && !catMap.has(n.toLowerCase()))
      ))
      for (const nombre of nombresFaltantes) {
        const { data } = await supabase.from('categorias')
          .insert({ nombre, establecimiento_id: establecimientoId, icono: '📦' })
          .select().single()
        if (data) catMap.set(nombre.toLowerCase(), data.id)
      }
    }

    const registros = filasValidas.map(f => ({
      establecimiento_id: establecimientoId,
      nombre: f.nombre,
      precio_venta: f.precio_venta,
      stock_actual: f.stock_actual,
      codigo_barras: f.codigo_barras || null,
      categoria_id: f.categoria_nombre ? catMap.get(f.categoria_nombre.toLowerCase()) ?? null : null,
      vendedor_id: f.vendedor_nombre ? venMap.get(f.vendedor_nombre.toLowerCase()) ?? null : null,
    }))

    if (registros.length > 0) {
      const { error } = await supabase.from('productos').insert(registros)
      if (error) { errores += registros.length } else { ok += registros.length }
    }

    setResultado({ ok, errores })
    setImportando(false)
    setTimeout(() => onImportado(), 1500)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">📊 Importar productos desde Excel</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-6 space-y-5">

          {filas.length === 0 && (
            <>
              <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                <div className="text-3xl mb-3">📁</div>
                <p className="text-sm text-gray-600 mb-1">Sube tu archivo de productos</p>
                <p className="text-xs text-gray-400 mb-4">Formatos aceptados: .xlsx, .xls, .csv</p>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleArchivo} className="hidden" id="excel-file" />
                <label htmlFor="excel-file"
                  className="cursor-pointer rounded-lg bg-white border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 shadow-sm transition-colors">
                  {procesando ? '🔄 Leyendo archivo…' : '📁 Seleccionar archivo'}
                </label>
              </div>

              <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700 space-y-1.5">
                <p className="font-medium">📋 Columnas que reconoce el sistema:</p>
                <p><strong>nombre</strong> (obligatorio) · <strong>precio_venta</strong> (obligatorio) · stock_actual · categoria · codigo_barras · vendedor</p>
                <button onClick={descargarPlantilla} className="mt-2 text-blue-600 underline hover:text-blue-800">
                  ⬇️ Descargar plantilla de ejemplo
                </button>
              </div>
            </>
          )}

          {filas.length > 0 && !resultado && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{archivoNombre}</p>
                  <p className="text-xs text-gray-400">{filas.length} filas encontradas</p>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="rounded-full bg-green-100 text-green-700 px-2.5 py-1 font-medium">✓ {filasValidas.length} listas</span>
                  {filasConError.length > 0 && (
                    <span className="rounded-full bg-red-100 text-red-700 px-2.5 py-1 font-medium">✗ {filasConError.length} con error</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
                <input type="checkbox" id="crear-cats" checked={crearCategoriasFaltantes}
                  onChange={e => setCrearCategoriasFaltantes(e.target.checked)}
                  className="rounded border-gray-300" />
                <label htmlFor="crear-cats" className="text-xs text-gray-600">
                  Crear automáticamente las categorías que no existan todavía
                </label>
              </div>

              <div className="rounded-xl border border-gray-200 overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Nombre</th>
                      <th className="px-3 py-2 text-right">Precio</th>
                      <th className="px-3 py-2 text-right">Stock</th>
                      <th className="px-3 py-2 text-left">Categoría</th>
                      <th className="px-3 py-2 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => (
                      <tr key={i} className={`border-b border-gray-50 ${f.error ? 'bg-red-50' : ''}`}>
                        <td className="px-3 py-2 font-medium text-gray-900">{f.nombre || '—'}</td>
                        <td className="px-3 py-2 text-right">{f.precio_venta !== null ? `$${f.precio_venta.toFixed(2)}` : '—'}</td>
                        <td className="px-3 py-2 text-right">{f.stock_actual}</td>
                        <td className="px-3 py-2 text-gray-500">{f.categoria_nombre || '—'}</td>
                        <td className="px-3 py-2 text-center">
                          {f.error ? (
                            <span className="text-red-600 text-[11px]">{f.error}</span>
                          ) : (
                            <span className="text-green-600 text-[11px]">✓ OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setFilas([])}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Subir otro archivo
                </button>
                <button onClick={confirmarImportacion} disabled={importando || filasValidas.length === 0}
                  className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                  {importando ? 'Importando…' : `✅ Importar ${filasValidas.length} productos`}
                </button>
              </div>
            </>
          )}

          {resultado && (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">🎉</div>
              <p className="text-sm font-medium text-gray-900">
                {resultado.ok} productos importados correctamente
              </p>
              {resultado.errores > 0 && (
                <p className="text-xs text-red-500 mt-1">{resultado.errores} filas con errores fueron omitidas</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── NUEVO LOTE (recibir mercancía) ────────────────────────
function ModalNuevoLote({
  producto, establecimientoId, onCerrar, onGuardado,
}: {
  producto: any
  establecimientoId: number
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [cantidad, setCantidad] = useState('')
  const [precioCompra, setPrecioCompra] = useState('')
  const [precioVenta, setPrecioVenta] = useState('')
  const [sinHistorial, setSinHistorial] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [tieneStockPrevio, setTieneStockPrevio] = useState(false)
  const [precioViejoLote, setPrecioViejoLote] = useState(0)
  const [decisionPrecio, setDecisionPrecio] = useState<'respetar_viejo' | 'actualizar_nuevo' | null>(null)

  useEffect(() => {
    const costo = parseFloat(precioCompra)
    if (!costo || costo <= 0) return

    const sugerir = async () => {
      const { data: ultimoLote } = await supabase
        .from('lotes_productos')
        .select('precio_compra, precio_venta_sugerido')
        .eq('producto_id', producto.id)
        .order('creado_en', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (ultimoLote && ultimoLote.precio_compra > 0) {
        const markup = (ultimoLote.precio_venta_sugerido - ultimoLote.precio_compra) / ultimoLote.precio_compra
        setPrecioVenta((costo * (1 + markup)).toFixed(2))
        setSinHistorial(false)
        if (producto.stock_actual > 0) {
          setTieneStockPrevio(true)
          setPrecioViejoLote(ultimoLote.precio_venta_sugerido)
        }
      } else {
        const { data: estab } = await supabase
          .from('establecimientos')
          .select('margen_costo_estimado')
          .eq('id', establecimientoId)
          .single()
        const margen = estab?.margen_costo_estimado ?? 0
        setPrecioVenta((costo * (1 + margen / 100)).toFixed(2))
        setSinHistorial(true)
      }
    }
    sugerir()
  }, [precioCompra, producto.id, establecimientoId])

  const guardar = async () => {
    const cant = parseInt(cantidad)
    const costo = parseFloat(precioCompra)
    const venta = parseFloat(precioVenta)
    if (!cant || cant <= 0 || !costo || !venta) return
    setGuardando(true)

    const { data: sucursal } = await supabase
      .from('sucursales')
      .select('id')
      .eq('establecimiento_id', establecimientoId)
      .limit(1)
      .maybeSingle()

    if (!sucursal) {
      alert('Falta crear una sucursal para este establecimiento')
      setGuardando(false)
      return
    }

    await supabase.from('lotes_productos').insert({
      producto_id: producto.id,
      sucursal_id: sucursal.id,
      precio_compra: costo,
      precio_venta_sugerido: venta,
      stock_lote: cant,
      margen_ganancia: +(((venta - costo) / costo) * 100).toFixed(2),
    })

    // Si hay stock previo y el admin eligió respetar precio viejo,
    // no actualizamos precio_venta del producto — el POS leerá el precio del lote más antiguo
    const nuevoPrecioVenta = decisionPrecio === 'respetar_viejo' ? precioViejoLote : venta

    await supabase.from('productos').update({
      stock_actual: producto.stock_actual + cant,
      precio_costo: costo,
      precio_venta: nuevoPrecioVenta,
    }).eq('id', producto.id)

    setGuardando(false)
    onGuardado()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">📦 Recibir stock — {producto.nombre}</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <input placeholder="Cantidad recibida *" type="number" value={cantidad} onChange={e => setCantidad(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />

        <input placeholder="Precio de costo de este lote *" type="number" value={precioCompra} onChange={e => setPrecioCompra(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />

        <div>
          <input placeholder="Precio de venta sugerido" type="number" value={precioVenta} onChange={e => setPrecioVenta(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          {sinHistorial && precioVenta && (
            <p className="mt-1 text-[11px] text-amber-600">Sugerido con el margen por defecto del establecimiento — puedes ajustarlo.</p>
          )}
        </div>

        {tieneStockPrevio && precioVenta && parseFloat(precioVenta) !== precioViejoLote && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 space-y-2">
            <p className="text-xs font-medium text-indigo-800">
              ⚠️ Ya tienes {producto.stock_actual} uds en stock al precio ${precioViejoLote.toFixed(2)}. ¿Cómo manejar el precio?
            </p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setDecisionPrecio('respetar_viejo')}
                className={`rounded-lg px-3 py-2 text-left text-xs transition-colors ${decisionPrecio === 'respetar_viejo' ? 'bg-indigo-600 text-white' : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100'}`}>
                <p className="font-medium">Respetar precio viejo ${precioViejoLote.toFixed(2)} hasta agotar</p>
                <p className={`${decisionPrecio === 'respetar_viejo' ? 'text-indigo-200' : 'text-indigo-400'}`}>El stock actual sigue al precio anterior (PEPS)</p>
              </button>
              <button
                type="button"
                onClick={() => setDecisionPrecio('actualizar_nuevo')}
                className={`rounded-lg px-3 py-2 text-left text-xs transition-colors ${decisionPrecio === 'actualizar_nuevo' ? 'bg-indigo-600 text-white' : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100'}`}>
                <p className="font-medium">Actualizar todo al precio nuevo ${parseFloat(precioVenta).toFixed(2)}</p>
                <p className={`${decisionPrecio === 'actualizar_nuevo' ? 'text-indigo-200' : 'text-indigo-400'}`}>Todo el inventario, incluyendo el stock anterior</p>
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onCerrar} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-500 hover:bg-gray-50">Cancelar</button>
          <button
            onClick={guardar}
            disabled={guardando || (tieneStockPrevio && parseFloat(precioVenta || '0') !== precioViejoLote && !decisionPrecio)}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {guardando ? 'Guardando…' : 'Registrar lote'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── VENDEDORES ────────────────────────────────────────────
function SeccionVendedores({ establecimientoId }: { establecimientoId: number }) {
  const [vendedores, setVendedores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [nombre, setNombre] = useState('')
  const [editando, setEditando] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('vendedores').select('*').eq('establecimiento_id', establecimientoId).order('nombre')
    setVendedores(data ?? [])
    setLoading(false)
  }, [establecimientoId])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async () => {
    if (!nombre.trim()) return
    setGuardando(true)
    if (editando) {
      await supabase.from('vendedores').update({ nombre }).eq('id', editando)
    } else {
      await supabase.from('vendedores').insert({ nombre, establecimiento_id: establecimientoId })
    }
    setGuardando(false)
    setEditando(null)
    setNombre('')
    cargar()
  }

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar este vendedor?')) return
    await supabase.from('vendedores').delete().eq('id', id)
    cargar()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">{editando ? '✏️ Editar vendedor' : '➕ Nuevo vendedor'}</h2>
        <div className="flex gap-3">
          <input placeholder="Nombre completo *" value={nombre} onChange={e => setNombre(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <button onClick={guardar} disabled={guardando}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {guardando ? 'Guardando…' : editando ? 'Actualizar' : 'Agregar'}
          </button>
          {editando && <button onClick={() => { setEditando(null); setNombre('') }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500">Cancelar</button>}
        </div>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Vendedores ({vendedores.length})</h2>
        </div>
        {loading ? <div className="p-5 text-sm text-gray-400">Cargando…</div> : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-xs text-gray-400">
              <tr>
                <th className="px-5 py-3 text-left">Nombre</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map(v => (
                <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{v.nombre}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => { setEditando(v.id); setNombre(v.nombre) }} className="mr-2 text-blue-500 hover:text-blue-700 text-xs">Editar</button>
                    <button onClick={() => eliminar(v.id)} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── CATEGORÍAS ────────────────────────────────────────────
function SeccionCategorias({ establecimientoId }: { establecimientoId: number }) {
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nombre: '', icono: '' })
  const [editando, setEditando] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('categorias').select('*').eq('establecimiento_id', establecimientoId).order('nombre')
    setCategorias(data ?? [])
    setLoading(false)
  }, [establecimientoId])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async () => {
    if (!form.nombre.trim()) return
    setGuardando(true)
    if (editando) {
      await supabase.from('categorias').update(form).eq('id', editando)
    } else {
      await supabase.from('categorias').insert({ ...form, establecimiento_id: establecimientoId })
    }
    setGuardando(false)
    setEditando(null)
    setForm({ nombre: '', icono: '' })
    cargar()
  }

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar esta categoría?')) return
    await supabase.from('categorias').delete().eq('id', id)
    cargar()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">{editando ? '✏️ Editar categoría' : '➕ Nueva categoría'}</h2>
        <div className="flex flex-wrap gap-3">
          <input placeholder="Emoji (ej: 🛒)" value={form.icono} onChange={e => setForm(f => ({ ...f, icono: e.target.value }))}
            className="w-16 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <input placeholder="Nombre de la categoría *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            className="flex-1 min-w-[140px] rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <button onClick={guardar} disabled={guardando}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {guardando ? 'Guardando…' : editando ? 'Actualizar' : 'Agregar'}
          </button>
          {editando && <button onClick={() => { setEditando(null); setForm({ nombre: '', icono: '' }) }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500">Cancelar</button>}
        </div>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Categorías ({categorias.length})</h2>
        </div>
        {loading ? <div className="p-5 text-sm text-gray-400">Cargando…</div> : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-xs text-gray-400">
              <tr>
                <th className="px-5 py-3 text-left">Icono</th>
                <th className="px-5 py-3 text-left">Nombre</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 text-xl">{c.icono ?? '—'}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{c.nombre}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => { setEditando(c.id); setForm({ nombre: c.nombre, icono: c.icono ?? '' }) }} className="mr-2 text-blue-500 hover:text-blue-700 text-xs">Editar</button>
                    <button onClick={() => eliminar(c.id)} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── MI EQUIPO ────────────────────────────────────────────
function SeccionEquipo({ establecimientoId }: { establecimientoId: number }) {
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'cajero' })
  const [creando, setCreando] = useState(false)
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('usuarios').select('*').eq('establecimiento_id', establecimientoId).order('nombre')
    setUsuarios(data ?? [])
    setLoading(false)
  }, [establecimientoId])

  useEffect(() => { cargar() }, [cargar])

  const crearUsuario = async () => {
    if (!form.nombre || !form.email || !form.password) return
    setCreando(true)
    setMensaje(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ ...form, establecimiento_id: establecimientoId }),
      })
      const data = await res.json()
      if (data.ok) {
        setMensaje({ texto: '✅ Usuario creado correctamente', tipo: 'ok' })
        setForm({ nombre: '', email: '', password: '', rol: 'cajero' })
        cargar()
      } else {
        setMensaje({ texto: `❌ Error: ${data.error}`, tipo: 'error' })
      }
    } catch {
      setMensaje({ texto: '❌ Error de conexión', tipo: 'error' })
    }
    setCreando(false)
  }

  const eliminar = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar a "${nombre}"?`)) return
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/usuarios', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ id }),
    })
    cargar()
  }

  const rolLabel: Record<string, string> = { admin: '👔 Admin', cajero: '🧾 Cajero' }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">➕ Agregar miembro del equipo</h2>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Nombre completo *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <input placeholder="Correo electrónico *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <input placeholder="Contraseña *" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400">
            <option value="cajero">🧾 Cajero</option>
            <option value="admin">👔 Admin</option>
          </select>
        </div>
        {mensaje && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${mensaje.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {mensaje.texto}
          </div>
        )}
        <button onClick={crearUsuario} disabled={creando}
          className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {creando ? 'Creando…' : '✅ Agregar usuario'}
        </button>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">👥 Mi equipo ({usuarios.length})</h2>
        </div>
        {loading ? <div className="p-5 text-sm text-gray-400">Cargando…</div> : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-xs text-gray-400">
              <tr>
                <th className="px-5 py-3 text-left">Nombre</th>
                <th className="px-5 py-3 text-left">Rol</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{u.nombre}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${u.rol === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {rolLabel[u.rol] ?? u.rol}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {!u.es_superadmin && (
                      <button onClick={() => eliminar(u.id, u.nombre)} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── REPORTES ────────────────────────────────────────────
function SeccionReportes({ establecimientoId }: { establecimientoId: number }) {
  const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes'>('hoy')
  const [loading, setLoading] = useState(true)
  const [totalVentas, setTotalVentas] = useState(0)
  const [numVentas, setNumVentas] = useState(0)
  const [ventasPorVendedor, setVentasPorVendedor] = useState<any[]>([])
  const [topProductos, setTopProductos] = useState<any[]>([])
  const [ventasPorDia, setVentasPorDia] = useState<any[]>([])
  const [ventasLista, setVentasLista] = useState<any[]>([])
  const [ventaParaFactura, setVentaParaFactura] = useState<any | null>(null)

  const getFechaInicio = useCallback(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    if (periodo === 'hoy') return hoy.toISOString()
    if (periodo === 'semana') { hoy.setDate(hoy.getDate() - 7); return hoy.toISOString() }
    hoy.setDate(hoy.getDate() - 30); return hoy.toISOString()
  }, [periodo])

  const cargar = useCallback(async () => {
    setLoading(true)
    const fechaInicio = getFechaInicio()
    const [ventas, detalle] = await Promise.all([
      supabase.from('ventas').select('*, sri_comprobante_id').eq('establecimiento_id', establecimientoId).gte('fecha_venta', fechaInicio).order('fecha_venta'),
      supabase.from('detalle_ventas')
        .select('*, producto:productos(nombre), vendedor:vendedores(nombre), venta:ventas!inner(fecha_venta, establecimiento_id)')
        .eq('venta.establecimiento_id', establecimientoId)
        .gte('venta.fecha_venta', fechaInicio),
    ])
    const v = ventas.data ?? []
    const d = detalle.data ?? []
    setTotalVentas(v.reduce((s, x) => s + x.total, 0))
    setNumVentas(v.length)
    setVentasLista([...v].sort((a, b) => new Date(b.fecha_venta).getTime() - new Date(a.fecha_venta).getTime()))
    const porVendedor: Record<string, { nombre: string; total: number; cantidad: number }> = {}
    d.forEach(item => {
      const nombre = item.vendedor?.nombre ?? 'Sin vendedor'
      if (!porVendedor[nombre]) porVendedor[nombre] = { nombre, total: 0, cantidad: 0 }
      porVendedor[nombre].total += item.precio_unitario * item.cantidad
      porVendedor[nombre].cantidad += item.cantidad
    })
    setVentasPorVendedor(Object.values(porVendedor).sort((a, b) => b.total - a.total))
    const porProducto: Record<string, { nombre: string; cantidad: number; total: number }> = {}
    d.forEach(item => {
      const nombre = item.producto?.nombre ?? 'Desconocido'
      if (!porProducto[nombre]) porProducto[nombre] = { nombre, cantidad: 0, total: 0 }
      porProducto[nombre].cantidad += item.cantidad
      porProducto[nombre].total += item.precio_unitario * item.cantidad
    })
    setTopProductos(Object.values(porProducto).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5))
    const porDia: Record<string, number> = {}
    v.forEach(venta => {
      const dia = new Date(venta.fecha_venta).toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric' })
      porDia[dia] = (porDia[dia] ?? 0) + venta.total
    })
    setVentasPorDia(Object.entries(porDia).map(([dia, total]) => ({ dia, total })))
    setLoading(false)
  }, [establecimientoId, getFechaInicio])

  useEffect(() => { cargar() }, [cargar])

  const fmt = (n: number) => `$${n.toFixed(2)}`
  const maxVendedor = ventasPorVendedor[0]?.total || 1
  const maxProducto = topProductos[0]?.cantidad || 1

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {[{ id: 'hoy', label: 'Hoy' }, { id: 'semana', label: 'Esta semana' }, { id: 'mes', label: 'Este mes' }].map(({ id, label }) => (
          <button key={id} onClick={() => setPeriodo(id as any)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors
              ${periodo === id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-xl mb-2">💰</div>
              <div className={`font-bold text-gray-900 ${fmt(totalVentas).length > 7 ? 'text-base' : 'text-2xl'} break-all`}>{fmt(totalVentas)}</div>
              <div className="text-xs text-gray-400 mt-1">Total vendido</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-xl mb-2">🧾</div>
              <div className={`font-bold text-gray-900 ${String(numVentas).length > 4 ? 'text-base' : 'text-2xl'} break-all`}>{numVentas}</div>
              <div className="text-xs text-gray-400 mt-1">Transacciones</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-xl mb-2">📊</div>
              <div className={`font-bold text-gray-900 ${fmt(totalVentas/Math.max(numVentas,1)).length > 7 ? 'text-base' : 'text-2xl'} break-all`}>{fmt(numVentas ? totalVentas/numVentas : 0)}</div>
              <div className="text-xs text-gray-400 mt-1">Ticket promedio</div>
            </div>
          </div>
          {ventasPorDia.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">📈 Ventas totales</h2>
              <div className="flex items-end gap-2 h-32">
                {ventasPorDia.map(({ dia, total }) => (
                  <div key={dia} className="flex flex-col items-center flex-1 gap-1">
                    <div className="text-[10px] text-gray-500 font-medium">{fmt(total)}</div>
                    <div className="w-full bg-blue-500 rounded-t-md"
                      style={{ height: `${(total / Math.max(...ventasPorDia.map(v => v.total))) * 96}px` }} />
                    <div className="text-[10px] text-gray-400 text-center">{dia}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">👤 Liquidación por vendedor</h2>
              {ventasPorVendedor.length === 0 ? <p className="text-sm text-gray-400">Sin ventas en este período</p> : (
                <div className="space-y-4">
                  {ventasPorVendedor.map((v, i) => (
                    <div key={v.nombre}>
                      <div className="flex justify-between items-center mb-1">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{v.nombre}</span>
                          <span className="ml-2 text-xs text-gray-400">{v.cantidad} uds</span>
                        </div>
                        <span className="text-sm font-bold text-blue-600">{fmt(v.total)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div className={`h-2 rounded-full ${i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-green-500' : i === 2 ? 'bg-amber-500' : 'bg-purple-500'}`}
                          style={{ width: `${(v.total / maxVendedor) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-gray-100 pt-3">
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-gray-700">Total general</span>
                      <span className="text-gray-900">{fmt(totalVentas)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">🏆 Top 5 productos más vendidos</h2>
              {topProductos.length === 0 ? <p className="text-sm text-gray-400">Sin ventas en este período</p> : (
                <div className="space-y-3">
                  {topProductos.map((p, i) => (
                    <div key={p.nombre}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white
                            ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-600' : 'bg-gray-300'}`}>
                            {i + 1}
                          </span>
                          <span className="text-sm text-gray-700 truncate max-w-[140px]">{p.nombre}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-gray-900">{p.cantidad} uds</div>
                          <div className="text-[10px] text-gray-400">{fmt(p.total)}</div>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100">
                        <div className={`h-1.5 rounded-full ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : 'bg-blue-400'}`}
                          style={{ width: `${(p.cantidad / maxProducto) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-900">📋 Ventas del período ({ventasLista.length})</h2>
            </div>
            {ventasLista.length === 0 ? <div className="p-5 text-sm text-gray-400">Sin ventas en este período</div> : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 text-xs text-gray-400">
                  <tr>
                    <th className="px-3 py-3 text-left hidden sm:table-cell">Comprobante</th>
                    <th className="px-3 py-3 text-left hidden sm:table-cell">Fecha</th>
                    <th className="px-3 py-3 text-left hidden sm:table-cell">Pago</th>
                    <th className="px-3 py-3 text-right">Total</th>
                    <th className="px-3 py-3 text-right">SRI</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasLista.map(venta => {
                    const tieneDescuento = (venta.descuento_total ?? 0) > 0
                    return (
                      <tr key={venta.id} className={`border-b border-gray-50 hover:bg-gray-50 ${tieneDescuento ? 'bg-orange-50' : ''}`}>
                        <td className={`px-3 py-3 font-mono text-xs hidden sm:table-cell ${tieneDescuento ? 'font-bold text-orange-600' : 'text-gray-600'}`}>
                          {venta.numero_comprobante}
                        </td>
                        <td className={`px-3 py-3 text-xs hidden sm:table-cell ${tieneDescuento ? 'font-bold text-orange-600' : 'text-gray-500'}`}>
                          {new Date(venta.fecha_venta).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className={`px-3 py-3 text-xs capitalize hidden sm:table-cell ${tieneDescuento ? 'font-bold text-orange-600' : 'text-gray-500'}`}>
                          {venta.metodo_pago}
                        </td>
                        <td className={`px-5 py-3 text-right ${tieneDescuento ? 'font-bold text-orange-600' : 'font-medium text-gray-900'}`}>
                          {fmt(venta.total)}
                          {tieneDescuento && <span className="ml-1.5 text-[10px]">(− {fmt(venta.descuento_total)})</span>}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {venta.sri_comprobante_id ? (
                            <span className="text-xs font-medium text-emerald-600">✅ Facturada</span>
                          ) : (
                            <button onClick={() => setVentaParaFactura(venta)}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                              Emitir Factura
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {ventaParaFactura && (
        <ModalEmitirFactura
          ventaId={ventaParaFactura.id}
          numeroComprobanteVenta={ventaParaFactura.numero_comprobante}
          establecimientoId={establecimientoId}
          total={ventaParaFactura.total}
          onCerrar={() => setVentaParaFactura(null)}
          onEmitido={() => { setVentaParaFactura(null); cargar() }}
        />
      )}
    </div>
  )
}// ─── EXPORTAR PDF EJECUTIVO ────────────────────────────────
function exportarCierrePDF(datos: any, establecimientoId: number) {
  const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const fmt = (n: number) => `$${Number(n).toFixed(2)}`
  const hoy = new Date().toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const filasMetodos = Object.entries(datos.porMetodo ?? {}).map(([metodo, monto]: any) => `
    <tr>
      <td>${metodo.charAt(0).toUpperCase() + metodo.slice(1)}</td>
      <td class="derecha">${fmt(monto)}</td>
      <td class="derecha">${((monto / (datos.totalVentas || 1)) * 100).toFixed(1)}%</td>
    </tr>
  `).join('')

  const filasBancos = Object.entries(datos.porBanco ?? {}).map(([banco, monto]: any) => `
    <tr style="background:#f8f9ff">
      <td style="padding-left:24px">🏦 ${banco}</td>
      <td class="derecha">${fmt(monto)}</td>
      <td class="derecha">—</td>
    </tr>
  `).join('')

  const filasTop = (datos.topProductos ?? []).map((p: any, i: number) => `
    <tr>
      <td>${i + 1}. ${p.nombre}</td>
      <td class="derecha">${p.cantidad} uds</td>
      <td class="derecha">${fmt(p.total)}</td>
    </tr>
  `).join('')

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8"/>
      <title>Cierre del día — ${hoy}</title>
      <style>
        @page { size: A4; margin: 15mm 18mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #1a1a1a; }
        .header { border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header-titulo { font-size: 22px; font-weight: 800; color: #4f46e5; }
        .header-fecha { font-size: 11px; color: #888; text-align: right; }
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .kpi { background: #f8f9ff; border: 1px solid #e0e0f0; border-radius: 10px; padding: 14px; text-align: center; }
        .kpi-valor { font-size: 20px; font-weight: 800; color: #4f46e5; }
        .kpi-label { font-size: 9px; color: #888; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
        .seccion { margin-bottom: 18px; }
        .seccion-titulo { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #4f46e5; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e0e0f0; }
        table { width: 100%; border-collapse: collapse; }
        thead tr { background: #4f46e5; color: white; }
        thead th { padding: 7px 10px; text-align: left; font-size: 9px; font-weight: 600; letter-spacing: 0.3px; }
        th.derecha, td.derecha { text-align: right; }
        tbody tr { border-bottom: 1px solid #f0f0f0; }
        tbody tr:nth-child(even) { background: #fafafa; }
        tbody td { padding: 6px 10px; font-size: 10px; }
        .footer { margin-top: 24px; border-top: 1px solid #e0e0f0; padding-top: 12px; display: flex; justify-content: space-between; font-size: 9px; color: #aaa; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="header-titulo">CIERRE DEL DÍA</div>
          <div style="font-size:12px;color:#555;margin-top:4px;">Reporte ejecutivo de operaciones</div>
        </div>
        <div class="header-fecha">
          <div>${hoy}</div>
          <div style="margin-top:2px;">Generado: ${new Date().toLocaleTimeString('es-EC')}</div>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi"><div class="kpi-valor">${fmt(datos.totalVentas)}</div><div class="kpi-label">Ventas del día</div></div>
        <div class="kpi"><div class="kpi-valor">${datos.numTransacciones}</div><div class="kpi-label">Transacciones</div></div>
        <div class="kpi"><div class="kpi-valor">${fmt(datos.ticketPromedio)}</div><div class="kpi-label">Ticket promedio</div></div>
        <div class="kpi"><div class="kpi-valor">${datos.comprobantesHoy}</div><div class="kpi-label">Comprobantes SRI</div></div>
      </div>

      <div class="seccion">
        <div class="seccion-titulo">Métodos de pago</div>
        <table>
          <thead><tr><th>Método</th><th class="derecha">Monto</th><th class="derecha">% del total</th></tr></thead>
          <tbody>${filasMetodos}${filasBancos}</tbody>
        </table>
      </div>

      <div class="seccion">
        <div class="seccion-titulo">Top 5 productos del día</div>
        <table>
          <thead><tr><th>Producto</th><th class="derecha">Cantidad</th><th class="derecha">Total</th></tr></thead>
          <tbody>${filasTop}</tbody>
        </table>
      </div>

      <div class="footer">
        <span>POS de GRPM — Reporte de cierre diario</span>
        <span>Establecimiento ID: ${establecimientoId}</span>
      </div>
    </body>
    </html>
  `

  if (esIOS) {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:none;'
    document.body.appendChild(iframe)
    const win = iframe.contentWindow
    if (!win) return
    win.document.write(html)
    win.document.close()
    setTimeout(() => {
      win.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }, 500)
  } else {
    const ventana = window.open('', '_blank', 'width=900,height=700')
    if (!ventana) return
    ventana.document.write(html)
    ventana.document.close()
    ventana.focus()
    setTimeout(() => ventana.print(), 500)
  }
}

// ─── SECCIÓN CIERRES Y REPORTES ────────────────────────────
function SeccionCierres({ establecimientoId }: { establecimientoId: number }) {
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [datos, setDatos] = useState<any | null>(null)
  const [cargando, setCargando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    const fechaInicio = `${fecha}T00:00:00`
    const fechaFin = `${fecha}T23:59:59`

    const [{ data: ventas }, { data: detalle }, { data: pagos }, { data: egresos }, { data: reservas }] = await Promise.all([
      supabase.from('ventas').select('id, total, metodo_pago, numero_comprobante, fecha_venta, descuento_total').eq('establecimiento_id', establecimientoId).gte('fecha_venta', fechaInicio).lte('fecha_venta', fechaFin),
      supabase.from('detalle_ventas').select('cantidad, precio_unitario, producto:productos(nombre), venta:ventas!inner(establecimiento_id, fecha_venta)').eq('venta.establecimiento_id', establecimientoId).gte('venta.fecha_venta', fechaInicio).lte('venta.fecha_venta', fechaFin),
      supabase.from('pagos_venta').select('metodo_pago, monto, bancos(nombre), venta:ventas!inner(establecimiento_id, fecha_venta)').eq('venta.establecimiento_id', establecimientoId).gte('venta.fecha_venta', fechaInicio).lte('venta.fecha_venta', fechaFin),
      supabase.from('movimientos_caja').select('monto, motivo, creado_en').gte('creado_en', fechaInicio).lte('creado_en', fechaFin),
      supabase.from('cotizaciones').select('id, numero, cliente_nombre, monto_abonado, total').eq('establecimiento_id', establecimientoId).eq('tipo', 'reserva').not('monto_abonado', 'is', null).gte('created_at', fechaInicio).lte('created_at', fechaFin),
    ])

    const totalVentas = (ventas ?? []).reduce((s, v) => s + Number(v.total), 0)
    const numTransacciones = (ventas ?? []).length
    const porMetodo: Record<string, number> = {}
    const porBanco: Record<string, number> = {}
    for (const p of pagos ?? []) {
      porMetodo[p.metodo_pago] = (porMetodo[p.metodo_pago] ?? 0) + Number(p.monto)
      if (p.metodo_pago === 'transferencia') {
        const banco = (p as any).bancos?.nombre ?? 'Sin banco'
        porBanco[banco] = (porBanco[banco] ?? 0) + Number(p.monto)
      }
    }
    const porProducto: Record<string, { nombre: string; cantidad: number; total: number }> = {}
    for (const d of detalle ?? []) {
      const nombre = (d.producto as any)?.nombre ?? 'Desconocido'
      if (!porProducto[nombre]) porProducto[nombre] = { nombre, cantidad: 0, total: 0 }
      porProducto[nombre].cantidad += d.cantidad
      porProducto[nombre].total += d.precio_unitario * d.cantidad
    }

    const totalAnticipos = (reservas ?? []).reduce((s, r) => s + Number(r.monto_abonado ?? 0), 0)

    setDatos({
      totalVentas,
      numTransacciones,
      ticketPromedio: numTransacciones ? totalVentas / numTransacciones : 0,
      comprobantesHoy: 0,
      porMetodo,
      porBanco,
      topProductos: Object.values(porProducto).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5),
      ultimaActualizacion: new Date(),
      ventas: ventas ?? [],
      egresos: egresos ?? [],
      reservas: reservas ?? [],
      totalAnticipos,
    })
    setCargando(false)
  }, [fecha, establecimientoId])

  useEffect(() => { cargar() }, [cargar])

  const exportarExcel = async () => {
    if (!datos) return
    const XLSX = await import('xlsx')
    const fmt2 = (n: number) => Number(Number(n).toFixed(2))

    // Hoja 1: Ventas
    const ventas = (datos.ventas ?? []).map((v: any) => ({
      'Comprobante': v.numero_comprobante,
      'Fecha': new Date(v.fecha_venta).toLocaleString('es-EC'),
      'Método': v.metodo_pago,
      'Total': fmt2(v.total),
      'Descuento': fmt2(v.descuento_total ?? 0),
    }))

    // Hoja 2: Métodos de pago
    const metodos = Object.entries(datos.porMetodo ?? {}).map(([metodo, monto]: any) => ({
      'Método de pago': metodo,
      'Monto': fmt2(monto),
      'Porcentaje': Number(((monto / (datos.totalVentas || 1)) * 100).toFixed(1)),
    }))
    const bancos = Object.entries(datos.porBanco ?? {}).map(([banco, monto]: any) => ({
      'Método de pago': `Transferencia — ${banco}`,
      'Monto': fmt2(monto),
      'Porcentaje': Number(((monto / (datos.totalVentas || 1)) * 100).toFixed(1)),
    }))

    // Hoja 3: Egresos
    const anticipos = (datos.reservas ?? []).map((r: any) => ({
      'Número': r.numero,
      'Cliente': r.cliente_nombre,
      'Anticipo recibido': fmt2(r.monto_abonado),
      'Total proforma': fmt2(r.total),
      'Saldo pendiente': fmt2(Number(r.total) - Number(r.monto_abonado)),
    }))
    const egresos = (datos.egresos ?? []).map((e: any) => ({
      'Fecha': new Date(e.creado_en).toLocaleString('es-EC'),
      'Motivo': e.motivo,
      'Monto': fmt2(e.monto),
    }))

    const wb = XLSX.utils.book_new()
    const ws1 = XLSX.utils.json_to_sheet(ventas)
    const ws2 = XLSX.utils.json_to_sheet([...metodos, ...bancos])
    const ws3 = XLSX.utils.json_to_sheet(egresos.length ? egresos : [{ 'Fecha': '—', 'Motivo': 'Sin egresos', 'Monto': 0 }])
    ws1['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 10 }]
    ws2['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 12 }]
    ws3['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 10 }]
    const ws4 = XLSX.utils.json_to_sheet(anticipos.length ? anticipos : [{ 'Número': '—', 'Cliente': 'Sin anticipos hoy', 'Anticipo recibido': 0, 'Total proforma': 0, 'Saldo pendiente': 0 }])
    ws4['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'Ventas')
    XLSX.utils.book_append_sheet(wb, ws2, 'Métodos de Pago')
    XLSX.utils.book_append_sheet(wb, ws3, 'Egresos de Caja')
    XLSX.utils.book_append_sheet(wb, ws4, 'Anticipos Reservas')
    XLSX.writeFile(wb, `cierre_${fecha}.xlsx`)
  }

  const fmt = (n: number) => `$${Number(n).toFixed(2)}`

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Seleccionar fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={() => datos && exportarCierrePDF(datos, establecimientoId)}
            disabled={!datos || cargando}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-4 py-2 text-sm font-medium text-white transition-colors">
            🖨️ PDF Ejecutivo
          </button>
          <button onClick={exportarExcel} disabled={!datos || cargando}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-4 py-2 text-sm font-medium text-white transition-colors">
            📊 Excel Contable
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      ) : datos ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Ventas del día', valor: fmt(datos.totalVentas), color: 'text-emerald-400' },
              { label: 'Transacciones', valor: String(datos.numTransacciones), color: 'text-blue-400' },
              { label: 'Ticket promedio', valor: fmt(datos.ticketPromedio), color: 'text-violet-400' },
            ].map(kpi => (
              <div key={kpi.label} className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5">
                <p className={`font-bold ${kpi.color} ${kpi.valor.length > 8 ? 'text-base' : kpi.valor.length > 6 ? 'text-lg' : 'text-2xl'} break-all`}>{kpi.valor}</p>
                <p className="text-xs text-zinc-500 mt-1">{kpi.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">💳 Desglose por método</h3>
            {Object.entries(datos.porMetodo ?? {}).map(([metodo, monto]: any) => (
              <div key={metodo} className="flex justify-between text-sm">
                <span className="text-zinc-400 capitalize">{metodo}</span>
                <span className="text-white font-medium">{fmt(monto)}</span>
              </div>
            ))}
            {Object.entries(datos.porBanco ?? {}).map(([banco, monto]: any) => (
              <div key={banco} className="flex justify-between text-xs pl-4">
                <span className="text-zinc-500">🏦 {banco}</span>
                <span className="text-violet-400">{fmt(monto)}</span>
              </div>
            ))}
          </div>

          {datos.totalAnticipos > 0 && (
            <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-5 space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-indigo-400">📋 Ingresos por Anticipos de Reservas</h3>
                <span className="text-indigo-300 font-bold text-base">{fmt(datos.totalAnticipos)}</span>
              </div>
              <p className="text-xs text-indigo-400/70">Dinero recibido hoy como anticipo — pendiente de facturación final</p>
              {datos.reservas.map((r: any) => (
                <div key={r.id} className="flex justify-between text-xs">
                  <span className="text-indigo-300 font-mono">{r.numero} — {r.cliente_nombre}</span>
                  <span className="text-indigo-400 font-medium">{fmt(Number(r.monto_abonado))} / {fmt(Number(r.total))}</span>
                </div>
              ))}
            </div>
          )}

          {datos.ventas?.some((v: any) => (v.descuento_total ?? 0) > 0) && (
            <div className="rounded-2xl bg-orange-500/10 border border-orange-500/20 p-5 space-y-2">
              <h3 className="text-sm font-semibold text-orange-400">🏷️ Ventas con descuento</h3>
              {datos.ventas.filter((v: any) => (v.descuento_total ?? 0) > 0).map((v: any) => (
                <div key={v.id} className="flex justify-between text-xs">
                  <span className="text-orange-300 font-mono">{v.numero_comprobante}</span>
                  <span className="text-orange-400">-{fmt(v.descuento_total)} descuento · Total: {fmt(v.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}