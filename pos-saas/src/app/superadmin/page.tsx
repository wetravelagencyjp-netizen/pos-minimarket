'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const fmt = (n: number) => `$${Number(n).toFixed(2)}`

const GIROS = ['todos', 'minimarket', 'licorera', 'bar', 'restaurante', 'retail'] as const
const PLANES = ['basico', 'premium', 'enterprise'] as const
const ESTADOS = ['activo', 'trial', 'suspendido', 'cancelado'] as const

const FEATURES_DISPONIBLES = [
  { id: 'contabilidad', label: '📒 Contabilidad' },
  { id: 'facturacion_sri', label: '🧾 Facturación SRI' },
  { id: 'cotizaciones', label: '📋 Cotizaciones' },
  { id: 'multi_firmas_sri', label: '🔐 Multi-firmas SRI' },
  { id: 'comandas_cocina', label: '👨‍🍳 Comandas cocina' },
  { id: 'delivery', label: '🛵 Delivery' },
  { id: 'inventario_xml', label: '📥 Inventario XML' },
  { id: 'reportes_avanzados', label: '📊 Reportes avanzados' },
  { id: 'alertas_caducidad', label: '⚠️ Alertas caducidad' },
  { id: 'multi_sucursal', label: '🏪 Multi-sucursal' },
]

const GIRO_COLOR: Record<string, string> = {
  minimarket: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  licorera: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  bar: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
  restaurante: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  retail: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
}

const PLAN_COLOR: Record<string, string> = {
  basico: 'bg-zinc-700 text-zinc-400',
  premium: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  enterprise: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
}

const ESTADO_COLOR: Record<string, string> = {
  activo: 'bg-emerald-500/10 text-emerald-400',
  trial: 'bg-blue-500/10 text-blue-400',
  suspendido: 'bg-rose-500/10 text-rose-400',
  cancelado: 'bg-zinc-700 text-zinc-500',
}

type Seccion = 'tenants' | 'nueva_tienda' | 'usuarios'

export default function SuperAdminPage() {
  const { usuario, logout, loading: authLoading } = useAuth()
  const router = useRouter()
  const [seccion, setSeccion] = useState<Seccion>('tenants')
  const [establecimientos, setEstablecimientos] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [giroFiltro, setGiroFiltro] = useState('todos')
  const [tenantSeleccionado, setTenantSeleccionado] = useState<any | null>(null)
  const [formEditar, setFormEditar] = useState<any>({})
  const [guardando, setGuardando] = useState(false)
  const [mensajePanel, setMensajePanel] = useState<string | null>(null)

  // Forms
  const [formTienda, setFormTienda] = useState({ nombre: '', giro_negocio: 'minimarket', plan_activo: 'basico', fecha_vencimiento: '2027-12-31' })
  const [creandoTienda, setCreandoTienda] = useState(false)
  const [mensajeTienda, setMensajeTienda] = useState<string | null>(null)
  const [formUsuario, setFormUsuario] = useState({ email: '', password: '', nombre: '', rol: 'cajero', establecimiento_id: '1' })
  const [creando, setCreando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const esSuperadmin = !!(usuario as any)?.es_superadmin

  useEffect(() => {
    if (authLoading) return
    if (!usuario) { router.push('/login'); return }
    if (!esSuperadmin) router.push('/pos')
  }, [usuario, authLoading, esSuperadmin, router])

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: estabs }, { data: ventas }, { data: users }] = await Promise.all([
      supabase.from('establecimientos').select('*').order('id'),
      supabase.from('ventas').select('establecimiento_id, total'),
      supabase.from('usuarios').select('*, establecimiento:establecimientos(nombre)').order('id'),
    ])

    const e = estabs ?? []
    const v = ventas ?? []
    const conVentas = await Promise.all(e.map(async (est) => {
      const [{ count: numU }, { count: numP }] = await Promise.all([
        supabase.from('usuarios').select('id', { count: 'exact', head: true }).eq('establecimiento_id', est.id),
        supabase.from('productos').select('id', { count: 'exact', head: true }).eq('establecimiento_id', est.id),
      ])
      return {
        ...est,
        totalVentas: v.filter(x => x.establecimiento_id === est.id).reduce((s: number, x: any) => s + x.total, 0),
        numVentas: v.filter(x => x.establecimiento_id === est.id).length,
        _num_usuarios: numU ?? 0,
        _num_productos: numP ?? 0,
      }
    }))

    setEstablecimientos(conVentas)
    setUsuarios(users ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { if (esSuperadmin) cargar() }, [cargar, esSuperadmin])

  const tenantsFiltrados = giroFiltro === 'todos'
    ? establecimientos
    : establecimientos.filter(t => t.giro_negocio === giroFiltro)

  const abrirPanel = (tenant: any) => {
    setTenantSeleccionado(tenant)
    setFormEditar({
      nombre: tenant.nombre,
      giro_negocio: tenant.giro_negocio ?? 'minimarket',
      plan_activo: tenant.plan_activo ?? 'basico',
      estado_cuenta: tenant.estado_cuenta ?? 'activo',
      features_permitidas: tenant.features_permitidas ?? [],
      fecha_vencimiento: tenant.fecha_vencimiento ?? '',
      max_productos: tenant.max_productos ?? 100,
      max_usuarios: tenant.max_usuarios ?? 3,
      notas_admin: tenant.notas_admin ?? '',
      modulo_contabilidad: tenant.modulo_contabilidad ?? false,
      permite_venta_sin_stock: tenant.permite_venta_sin_stock ?? false,
    })
    setMensajePanel(null)
  }

  const toggleFeature = (feature: string) => {
    const current = formEditar.features_permitidas ?? []
    setFormEditar((f: any) => ({
      ...f,
      features_permitidas: current.includes(feature)
        ? current.filter((x: string) => x !== feature)
        : [...current, feature]
    }))
  }

  const guardarPanel = async () => {
    if (!tenantSeleccionado) return
    setGuardando(true)
    const { error } = await supabase.from('establecimientos').update({
      nombre: formEditar.nombre,
      giro_negocio: formEditar.giro_negocio,
      plan_activo: formEditar.plan_activo,
      estado_cuenta: formEditar.estado_cuenta,
      features_permitidas: formEditar.features_permitidas,
      fecha_vencimiento: formEditar.fecha_vencimiento || null,
      max_productos: formEditar.max_productos,
      max_usuarios: formEditar.max_usuarios,
      notas_admin: formEditar.notas_admin,
      modulo_contabilidad: formEditar.modulo_contabilidad,
      permite_venta_sin_stock: formEditar.permite_venta_sin_stock,
    }).eq('id', tenantSeleccionado.id)
    setGuardando(false)
    setMensajePanel(error ? `❌ ${error.message}` : '✅ Cambios guardados')
    if (!error) cargar()
  }

  const crearTienda = async () => {
    if (!formTienda.nombre) return
    setCreandoTienda(true)
    const { error } = await supabase.from('establecimientos').insert({
      nombre: formTienda.nombre,
      giro_negocio: formTienda.giro_negocio,
      plan_activo: formTienda.plan_activo,
      estado_cuenta: 'activo',
      fecha_vencimiento: formTienda.fecha_vencimiento,
      max_productos: formTienda.plan_activo === 'enterprise' ? 9999 : formTienda.plan_activo === 'premium' ? 500 : 100,
      max_usuarios: formTienda.plan_activo === 'enterprise' ? 50 : formTienda.plan_activo === 'premium' ? 10 : 3,
      features_permitidas: [],
    })
    setCreandoTienda(false)
    setMensajeTienda(error ? `❌ ${error.message}` : '✅ Tienda creada')
    if (!error) { setFormTienda({ nombre: '', giro_negocio: 'minimarket', plan_activo: 'basico', fecha_vencimiento: '2027-12-31' }); cargar() }
  }

  const crearUsuario = async () => {
    if (!formUsuario.email || !formUsuario.password || !formUsuario.nombre) return
    setCreando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ ...formUsuario, establecimiento_id: parseInt(formUsuario.establecimiento_id) }),
      })
      const data = await res.json()
      setMensaje(data.ok ? '✅ Usuario creado' : `❌ ${data.error}`)
      if (data.ok) { setFormUsuario({ email: '', password: '', nombre: '', rol: 'cajero', establecimiento_id: '1' }); cargar() }
    } catch { setMensaje('❌ Error de conexión') }
    setCreando(false)
  }

  const eliminarUsuario = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ id }),
    })
    cargar()
  }

  const inp = 'rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500 w-full'

  if (authLoading || !usuario || !esSuperadmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  const totalActivos = establecimientos.filter(t => t.estado_cuenta === 'activo').length
  const totalVentas = establecimientos.reduce((s, t) => s + (t.totalVentas ?? 0), 0)

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white">⚡ Superadmin</h1>
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-zinc-900">DUEÑO</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/pos')} className="rounded-xl border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800">← POS</button>
          <span className="text-xs text-zinc-500 hidden sm:block">{usuario?.nombre}</span>
          <button onClick={logout} className="rounded-xl border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800">Salir</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-44 border-r border-zinc-800 bg-zinc-900 p-3 space-y-1 hidden sm:block">
          {[
            { id: 'tenants', label: '🏪 Tenants' },
            { id: 'nueva_tienda', label: '➕ Nueva tienda' },
            { id: 'usuarios', label: '👤 Usuarios' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => { setSeccion(id as Seccion); setTenantSeleccionado(null) }}
              className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                seccion === id ? 'bg-amber-500/10 text-amber-400 font-medium' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}>
              {label}
            </button>
          ))}
        </aside>

        {/* Tabs móvil */}
        <div className="sm:hidden border-b border-zinc-800 bg-zinc-900 flex w-full absolute z-10">
          {[{ id: 'tenants', label: 'Tenants' }, { id: 'nueva_tienda', label: 'Nueva' }, { id: 'usuarios', label: 'Usuarios' }].map(({ id, label }) => (
            <button key={id} onClick={() => { setSeccion(id as Seccion); setTenantSeleccionado(null) }}
              className={`flex-1 py-3 text-xs font-medium transition-colors ${seccion === id ? 'text-amber-400 border-b-2 border-amber-500' : 'text-zinc-500'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Contenido principal */}
        <div className={`flex flex-col flex-1 overflow-hidden ${tenantSeleccionado ? 'hidden sm:flex' : 'flex'}`}>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 pt-14 sm:pt-4">

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              </div>
            ) : (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total tenants', valor: String(establecimientos.length), color: 'text-white' },
                    { label: 'Activos', valor: String(totalActivos), color: 'text-emerald-400' },
                    { label: 'Premium+', valor: String(establecimientos.filter(t => t.plan_activo === 'premium' || t.plan_activo === 'enterprise').length), color: 'text-indigo-400' },
                    { label: 'Ventas totales', valor: fmt(totalVentas), color: 'text-amber-400' },
                  ].map(kpi => (
                    <div key={kpi.label} className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
                      <p className={`text-xl font-bold ${kpi.color} break-all`}>{kpi.valor}</p>
                      <p className="text-xs text-zinc-500 mt-1">{kpi.label}</p>
                    </div>
                  ))}
                </div>

                {/* ── TENANTS ── */}
                {seccion === 'tenants' && (
                  <div className="space-y-4">
                    {/* Tabs giro */}
                    <div className="overflow-x-auto">
                      <div className="flex gap-1 bg-zinc-800/50 rounded-2xl p-1 w-fit">
                        {GIROS.map(giro => (
                          <button key={giro} onClick={() => setGiroFiltro(giro)}
                            className={`px-3 py-2 text-xs font-medium rounded-xl transition-colors capitalize whitespace-nowrap ${
                              giroFiltro === giro ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
                            }`}>
                            {giro === 'todos' ? '🌐 Todos' : giro === 'minimarket' ? '🛒 Mini' : giro === 'licorera' ? '🍺 Lic.' : giro === 'bar' ? '🍸 Bar' : giro === 'restaurante' ? '🍽️ Rest.' : '🏪 Retail'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="border-b border-zinc-800 text-xs text-zinc-600 uppercase tracking-wide">
                          <tr>
                            <th className="px-4 py-3 text-left">Establecimiento</th>
                            <th className="px-4 py-3 text-left hidden sm:table-cell">Giro</th>
                            <th className="px-4 py-3 text-left hidden sm:table-cell">Plan</th>
                            <th className="px-4 py-3 text-left">Estado</th>
                            <th className="px-4 py-3 text-right hidden sm:table-cell">Ventas</th>
                            <th className="px-4 py-3 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tenantsFiltrados.map(t => (
                            <tr key={t.id} onClick={() => abrirPanel(t)}
                              className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-colors ${tenantSeleccionado?.id === t.id ? 'bg-zinc-800/50' : ''}`}>
                              <td className="px-4 py-4">
                                <p className="text-zinc-200 font-medium text-sm">{t.nombre}</p>
                                <p className="text-zinc-600 text-xs">{t._num_usuarios} usuarios · {t._num_productos} productos</p>
                              </td>
                              <td className="px-4 py-4 hidden sm:table-cell">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${GIRO_COLOR[t.giro_negocio] ?? 'bg-zinc-700 text-zinc-400'}`}>
                                  {t.giro_negocio ?? '—'}
                                </span>
                              </td>
                              <td className="px-4 py-4 hidden sm:table-cell">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${PLAN_COLOR[t.plan_activo] ?? 'bg-zinc-700 text-zinc-400'}`}>
                                  {t.plan_activo ?? 'basico'}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR[t.estado_cuenta] ?? 'bg-zinc-700 text-zinc-400'}`}>
                                  {t.estado_cuenta ?? 'activo'}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-right text-zinc-400 text-xs hidden sm:table-cell">{fmt(t.totalVentas)}</td>
                              <td className="px-4 py-4 text-right">
                                <button className="text-xs text-amber-400 hover:text-amber-300">Editar →</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── NUEVA TIENDA ── */}
                {seccion === 'nueva_tienda' && (
                  <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4 max-w-lg">
                    <h2 className="text-sm font-semibold text-white">➕ Crear nueva tienda</h2>
                    <input placeholder="Nombre *" value={formTienda.nombre} onChange={e => setFormTienda(f => ({ ...f, nombre: e.target.value }))} className={inp} />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-zinc-500 block mb-1">Giro</label>
                        <select value={formTienda.giro_negocio} onChange={e => setFormTienda(f => ({ ...f, giro_negocio: e.target.value }))} className={inp}>
                          <option value="minimarket">🛒 Minimarket</option>
                          <option value="licorera">🍺 Licorera</option>
                          <option value="bar">🍸 Bar</option>
                          <option value="restaurante">🍽️ Restaurante</option>
                          <option value="retail">🏪 Retail</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500 block mb-1">Plan</label>
                        <select value={formTienda.plan_activo} onChange={e => setFormTienda(f => ({ ...f, plan_activo: e.target.value }))} className={inp}>
                          <option value="basico">Básico</option>
                          <option value="premium">Premium</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 block mb-1">Fecha vencimiento</label>
                      <input type="date" value={formTienda.fecha_vencimiento} onChange={e => setFormTienda(f => ({ ...f, fecha_vencimiento: e.target.value }))} className={inp} />
                    </div>
                    {mensajeTienda && <p className={`text-xs ${mensajeTienda.startsWith('✅') ? 'text-emerald-400' : 'text-rose-400'}`}>{mensajeTienda}</p>}
                    <button onClick={crearTienda} disabled={creandoTienda || !formTienda.nombre}
                      className="rounded-xl bg-white text-zinc-950 px-5 py-2.5 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors">
                      {creandoTienda ? 'Creando…' : '✅ Crear tienda'}
                    </button>
                  </div>
                )}

                {/* ── USUARIOS ── */}
                {seccion === 'usuarios' && (
                  <div className="space-y-5">
                    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4 max-w-lg">
                      <h2 className="text-sm font-semibold text-white">➕ Crear usuario</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input placeholder="Nombre *" value={formUsuario.nombre} onChange={e => setFormUsuario(f => ({ ...f, nombre: e.target.value }))} className={inp} />
                        <input placeholder="Email *" type="email" value={formUsuario.email} onChange={e => setFormUsuario(f => ({ ...f, email: e.target.value }))} className={inp} />
                        <input placeholder="Contraseña *" type="password" value={formUsuario.password} onChange={e => setFormUsuario(f => ({ ...f, password: e.target.value }))} className={inp} />
                        <select value={formUsuario.rol} onChange={e => setFormUsuario(f => ({ ...f, rol: e.target.value }))} className={inp}>
                          <option value="cajero">🧾 Cajero</option>
                          <option value="admin">👔 Admin</option>
                        </select>
                        <div className="sm:col-span-2">
                          <select value={formUsuario.establecimiento_id} onChange={e => setFormUsuario(f => ({ ...f, establecimiento_id: e.target.value }))} className={inp}>
                            {establecimientos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                          </select>
                        </div>
                      </div>
                      {mensaje && <p className={`text-xs ${mensaje.startsWith('✅') ? 'text-emerald-400' : 'text-rose-400'}`}>{mensaje}</p>}
                      <button onClick={crearUsuario} disabled={creando}
                        className="rounded-xl bg-white text-zinc-950 px-5 py-2.5 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors">
                        {creando ? 'Creando…' : '✅ Crear usuario'}
                      </button>
                    </div>

                    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
                      <div className="px-5 py-4 border-b border-zinc-800">
                        <h2 className="text-sm font-semibold text-white">Usuarios ({usuarios.length})</h2>
                      </div>
                      <table className="w-full text-sm">
                        <thead className="border-b border-zinc-800 text-xs text-zinc-600 uppercase">
                          <tr>
                            <th className="px-4 py-3 text-left">Nombre</th>
                            <th className="px-4 py-3 text-left hidden sm:table-cell">Tienda</th>
                            <th className="px-4 py-3 text-left">Rol</th>
                            <th className="px-4 py-3 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usuarios.map(u => (
                            <tr key={u.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                              <td className="px-4 py-3 text-zinc-200 font-medium">{u.nombre}</td>
                              <td className="px-4 py-3 text-zinc-500 text-xs hidden sm:table-cell">{u.establecimiento?.nombre ?? '—'}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${u.es_superadmin ? 'bg-amber-500/10 text-amber-400' : u.rol === 'admin' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-zinc-700 text-zinc-400'}`}>
                                  {u.es_superadmin ? '⚡ Super' : u.rol === 'admin' ? '👔 Admin' : '🧾 Cajero'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {!u.es_superadmin && (
                                  <button onClick={() => eliminarUsuario(u.id, u.nombre)} className="text-xs text-rose-400 hover:text-rose-300">Eliminar</button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Panel lateral — Sheet */}
        {tenantSeleccionado && (
          <div className="w-full sm:w-96 border-l border-zinc-800 bg-zinc-900 flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white truncate max-w-[200px]">{tenantSeleccionado.nombre}</h2>
                <p className="text-xs text-zinc-500">ID: {tenantSeleccionado.id}</p>
              </div>
              <button onClick={() => setTenantSeleccionado(null)} className="text-zinc-600 hover:text-zinc-300 text-sm">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {mensajePanel && (
                <div className={`rounded-xl px-3 py-2.5 text-xs font-medium ${mensajePanel.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {mensajePanel}
                </div>
              )}

              {/* Contrato */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Contrato</h3>
                <input value={formEditar.nombre ?? ''} onChange={e => setFormEditar((f: any) => ({ ...f, nombre: e.target.value }))} className={inp} placeholder="Nombre" />
                <div className="grid grid-cols-2 gap-2">
                  <select value={formEditar.giro_negocio ?? 'minimarket'} onChange={e => setFormEditar((f: any) => ({ ...f, giro_negocio: e.target.value }))} className={inp}>
                    <option value="minimarket">Minimarket</option>
                    <option value="licorera">Licorera</option>
                    <option value="bar">Bar</option>
                    <option value="restaurante">Restaurante</option>
                    <option value="retail">Retail</option>
                  </select>
                  <select value={formEditar.plan_activo ?? 'basico'} onChange={e => setFormEditar((f: any) => ({ ...f, plan_activo: e.target.value }))} className={inp}>
                    {PLANES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={formEditar.estado_cuenta ?? 'activo'} onChange={e => setFormEditar((f: any) => ({ ...f, estado_cuenta: e.target.value }))} className={inp}>
                    {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <input type="date" value={formEditar.fecha_vencimiento ?? ''} onChange={e => setFormEditar((f: any) => ({ ...f, fecha_vencimiento: e.target.value }))} className={inp} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-zinc-600 block mb-1">Máx. productos</label>
                    <input type="number" value={formEditar.max_productos ?? 100} onChange={e => setFormEditar((f: any) => ({ ...f, max_productos: parseInt(e.target.value) || 100 }))} className={inp} />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-600 block mb-1">Máx. usuarios</label>
                    <input type="number" value={formEditar.max_usuarios ?? 3} onChange={e => setFormEditar((f: any) => ({ ...f, max_usuarios: parseInt(e.target.value) || 3 }))} className={inp} />
                  </div>
                </div>
                <textarea value={formEditar.notas_admin ?? ''} onChange={e => setFormEditar((f: any) => ({ ...f, notas_admin: e.target.value }))}
                  rows={2} placeholder="Notas internas…"
                  className="rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500 w-full resize-none" />
              </div>

              {/* Módulos globales */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Módulos globales</h3>
                {[
                  { campo: 'modulo_contabilidad', label: '📒 Contabilidad' },
                  { campo: 'permite_venta_sin_stock', label: '📦 Vender sin stock' },
                ].map(({ campo, label }) => (
                  <div key={campo} className="flex items-center justify-between rounded-xl bg-zinc-800/50 border border-zinc-700/50 px-4 py-3">
                    <span className="text-sm text-zinc-300">{label}</span>
                    <button type="button" onClick={() => setFormEditar((f: any) => ({ ...f, [campo]: !f[campo] }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formEditar[campo] ? 'bg-indigo-600' : 'bg-zinc-600'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formEditar[campo] ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Feature flags */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Feature flags</h3>
                <div className="space-y-1.5">
                  {FEATURES_DISPONIBLES.map(feature => {
                    const activo = (formEditar.features_permitidas ?? []).includes(feature.id)
                    return (
                      <div key={feature.id} onClick={() => toggleFeature(feature.id)}
                        className={`flex items-center justify-between rounded-xl px-4 py-3 cursor-pointer transition-colors border ${
                          activo ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-zinc-800/30 border-zinc-700/50 hover:bg-zinc-800/60'
                        }`}>
                        <span className={`text-sm ${activo ? 'text-indigo-300' : 'text-zinc-400'}`}>{feature.label}</span>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${activo ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-600'}`}>
                          {activo && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Uso recursos */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Uso de recursos</h3>
                <div className="rounded-xl bg-zinc-800/30 border border-zinc-700/50 p-4 space-y-3">
                  {[
                    { label: 'Usuarios', usado: tenantSeleccionado._num_usuarios ?? 0, maximo: formEditar.max_usuarios ?? 3 },
                    { label: 'Productos', usado: tenantSeleccionado._num_productos ?? 0, maximo: formEditar.max_productos ?? 100 },
                    { label: 'Ventas', usado: tenantSeleccionado.numVentas ?? 0, maximo: 9999 },
                  ].map(({ label, usado, maximo }) => {
                    const pct = Math.min(100, Math.round((usado / maximo) * 100))
                    return (
                      <div key={label} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-400">{label}</span>
                          <span className={pct >= 90 ? 'text-rose-400' : pct >= 70 ? 'text-amber-400' : 'text-zinc-400'}>
                            {usado}{maximo < 9999 ? ` / ${maximo}` : ''}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-700">
                          <div className={`h-1.5 rounded-full ${pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-zinc-800">
              <button onClick={guardarPanel} disabled={guardando}
                className="w-full rounded-xl bg-white text-zinc-950 py-2.5 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors">
                {guardando ? 'Guardando…' : '✅ Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}