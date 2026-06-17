'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const fmt = (n: number) => `$${n.toFixed(2)}`

export default function SuperAdminPage() {
  const { usuario, logout, loading: authLoading } = useAuth()
  const router = useRouter()
  const [seccion, setSeccion] = useState<'tiendas' | 'usuarios' | 'nueva_tienda'>('tiendas')
  const [establecimientos, setEstablecimientos] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [metricas, setMetricas] = useState({ totalTiendas: 0, tiendaActivas: 0, totalVentas: 0 })
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState<number | null>(null)
  const [formUsuario, setFormUsuario] = useState({ email: '', password: '', nombre: '', rol: 'cajero', establecimiento_id: '1' })
  const [formTienda, setFormTienda] = useState({ nombre: '', url_pago: '', plan_actual: 'basico', fecha_vencimiento: '2027-12-31' })
  const [creando, setCreando] = useState(false)
  const [creandoTienda, setCreandoTienda] = useState(false)
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null)
  const [mensajeTienda, setMensajeTienda] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null)

  const esSuperadmin = !!(usuario as any)?.es_superadmin

  useEffect(() => {
    if (authLoading) return
    if (!usuario) { router.push('/login'); return }
    if (!esSuperadmin) router.push('/pos')
  }, [usuario, authLoading, esSuperadmin, router])

  const cargar = useCallback(async () => {
    setLoading(true)
    const [estabs, ventas, users] = await Promise.all([
      supabase.from('establecimientos').select('*').order('id'),
      supabase.from('ventas').select('establecimiento_id, total'),
      supabase.from('usuarios').select('*, establecimiento:establecimientos(nombre)').order('id'),
    ])

    const e = estabs.data ?? []
    const v = ventas.data ?? []
    const conVentas = e.map(est => ({
      ...est,
      totalVentas: v.filter(x => x.establecimiento_id === est.id).reduce((s, x) => s + x.total, 0),
      numVentas: v.filter(x => x.establecimiento_id === est.id).length,
    }))

    setEstablecimientos(conVentas)
    setUsuarios(users.data ?? [])
    setMetricas({
      totalTiendas: e.length,
      tiendaActivas: e.filter(x => x.estado_cuenta === 'activo').length,
      totalVentas: v.reduce((s, x) => s + x.total, 0),
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    if (esSuperadmin) cargar()
  }, [cargar, esSuperadmin])

  const cambiarEstado = async (id: number, estado: string) => {
    setGuardando(id)
    await supabase.from('establecimientos').update({ estado_cuenta: estado }).eq('id', id)
    setGuardando(null)
    cargar()
  }

  const cambiarPlan = async (id: number, plan: string) => {
    setGuardando(id)
    const limite = plan === 'pro' ? 500 : 50
    await supabase.from('establecimientos').update({ plan_actual: plan, limite_productos: limite }).eq('id', id)
    setGuardando(null)
    cargar()
  }

  const cambiarFecha = async (id: number, fecha: string) => {
    await supabase.from('establecimientos').update({ fecha_vencimiento: fecha }).eq('id', id)
    cargar()
  }

  const crearTienda = async () => {
    if (!formTienda.nombre) return
    setCreandoTienda(true)
    setMensajeTienda(null)
    const limite = formTienda.plan_actual === 'pro' ? 500 : 50
    const { error } = await supabase.from('establecimientos').insert({
      nombre: formTienda.nombre,
      url_pago: formTienda.url_pago || null,
      plan_actual: formTienda.plan_actual,
      limite_productos: limite,
      estado_cuenta: 'activo',
      estado_suscripcion: true,
      fecha_vencimiento: formTienda.fecha_vencimiento,
    })
    if (error) {
      setMensajeTienda({ texto: `❌ Error: ${error.message}`, tipo: 'error' })
    } else {
      setMensajeTienda({ texto: '✅ Tienda creada — ahora crea sus usuarios en la sección Usuarios', tipo: 'ok' })
      setFormTienda({ nombre: '', url_pago: '', plan_actual: 'basico', fecha_vencimiento: '2027-12-31' })
      cargar()
    }
    setCreandoTienda(false)
  }

  const crearUsuario = async () => {
    if (!formUsuario.email || !formUsuario.password || !formUsuario.nombre) return
    setCreando(true)
    setMensaje(null)
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formUsuario.email,
          password: formUsuario.password,
          nombre: formUsuario.nombre,
          rol: formUsuario.rol,
          establecimiento_id: parseInt(formUsuario.establecimiento_id),
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setMensaje({ texto: '✅ Usuario creado correctamente', tipo: 'ok' })
        setFormUsuario({ email: '', password: '', nombre: '', rol: 'cajero', establecimiento_id: '1' })
        cargar()
      } else {
        setMensaje({ texto: `❌ Error: ${data.error}`, tipo: 'error' })
      }
    } catch {
      setMensaje({ texto: '❌ Error de conexión', tipo: 'error' })
    }
    setCreando(false)
  }

  const eliminarUsuario = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el usuario "${nombre}"?`)) return
    const res = await fetch('/api/usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    if (data.ok) cargar()
  }

  const rolLabel: Record<string, string> = { admin: '👔 Admin', cajero: '🧾 Cajero' }

  if (authLoading || !usuario || !esSuperadmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-gray-900">
      <header className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-white">⚡ Super Admin</h1>
          <span className="rounded-full bg-yellow-500 px-2 py-0.5 text-[10px] font-bold text-gray-900">DUEÑO</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/pos')} className="rounded-lg border border-gray-600 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-gray-700">← POS</button>
          <span className="text-xs text-gray-400">{usuario?.nombre}</span>
          <button onClick={logout} className="rounded-lg border border-gray-600 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-gray-700">Salir</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-48 border-r border-gray-700 bg-gray-800 p-4 space-y-1">
          {[
            { id: 'tiendas', label: '🏪 Tiendas' },
            { id: 'nueva_tienda', label: '➕ Nueva tienda' },
            { id: 'usuarios', label: '👤 Usuarios' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setSeccion(id as any)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors
                ${seccion === id ? 'bg-yellow-500 text-gray-900 font-medium' : 'text-gray-300 hover:bg-gray-700'}`}>
              {label}
            </button>
          ))}
        </aside>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total de tiendas', valor: String(metricas.totalTiendas), icono: '🏪' },
                  { label: 'Tiendas activas', valor: String(metricas.tiendaActivas), icono: '✅' },
                  { label: 'Ventas totales procesadas', valor: fmt(metricas.totalVentas), icono: '💰' },
                ].map(({ label, valor, icono }) => (
                  <div key={label} className="rounded-2xl border border-gray-700 bg-gray-800 p-5">
                    <div className="text-2xl mb-2">{icono}</div>
                    <div className="text-2xl font-semibold text-white">{valor}</div>
                    <div className="text-xs text-gray-400 mt-1">{label}</div>
                  </div>
                ))}
              </div>

              {seccion === 'tiendas' && (
                <div className="rounded-2xl border border-gray-700 bg-gray-800">
                  <div className="border-b border-gray-700 px-5 py-3">
                    <h2 className="text-sm font-semibold text-white">🏪 Tiendas registradas</h2>
                  </div>
                  <div className="divide-y divide-gray-700">
                    {establecimientos.map(est => (
                      <div key={est.id} className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">{est.nombre}</p>
                            <p className="text-xs text-gray-400">ID: {est.id} · {est.numVentas} ventas · {fmt(est.totalVentas)} total</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${est.estado_cuenta === 'activo' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                              {est.estado_cuenta === 'activo' ? '✅ Activo' : '🔴 Suspendido'}
                            </span>
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${est.plan_actual === 'pro' ? 'bg-yellow-900 text-yellow-400' : 'bg-gray-700 text-gray-400'}`}>
                              {est.plan_actual === 'pro' ? '⭐ Pro' : '📦 Básico'}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-[10px] text-gray-500 mb-1">Estado cuenta</p>
                            <select value={est.estado_cuenta} onChange={e => cambiarEstado(est.id, e.target.value)} disabled={guardando === est.id}
                              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-2 py-1.5 text-xs text-white outline-none">
                              <option value="activo">✅ Activo</option>
                              <option value="suspendido">🔴 Suspendido</option>
                            </select>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 mb-1">Plan</p>
                            <select value={est.plan_actual} onChange={e => cambiarPlan(est.id, e.target.value)} disabled={guardando === est.id}
                              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-2 py-1.5 text-xs text-white outline-none">
                              <option value="basico">📦 Básico (50 productos)</option>
                              <option value="pro">⭐ Pro (500 productos)</option>
                            </select>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 mb-1">Vence el</p>
                            <input type="date" defaultValue={est.fecha_vencimiento} onBlur={e => cambiarFecha(est.id, e.target.value)}
                              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-2 py-1.5 text-xs text-white outline-none" />
                          </div>
                        </div>
                        {guardando === est.id && <p className="text-xs text-yellow-400">Guardando cambios…</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {seccion === 'nueva_tienda' && (
                <div className="rounded-2xl border border-gray-700 bg-gray-800 p-5">
                  <h2 className="mb-4 text-sm font-semibold text-white">➕ Crear nueva tienda</h2>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] text-gray-500 mb-1">Nombre de la tienda *</p>
                      <input placeholder="Ej: Minimarket Don Juan" value={formTienda.nombre} onChange={e => setFormTienda(f => ({ ...f, nombre: e.target.value }))}
                        className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white outline-none placeholder-gray-400 focus:border-yellow-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 mb-1">Link de pago (para renovar suscripción)</p>
                      <input placeholder="https://mpago.la/tu-link" value={formTienda.url_pago} onChange={e => setFormTienda(f => ({ ...f, url_pago: e.target.value }))}
                        className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white outline-none placeholder-gray-400 focus:border-yellow-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-gray-500 mb-1">Plan</p>
                        <select value={formTienda.plan_actual} onChange={e => setFormTienda(f => ({ ...f, plan_actual: e.target.value }))}
                          className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500">
                          <option value="basico">📦 Básico (50 productos)</option>
                          <option value="pro">⭐ Pro (500 productos)</option>
                        </select>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 mb-1">Fecha de vencimiento</p>
                        <input type="date" value={formTienda.fecha_vencimiento} onChange={e => setFormTienda(f => ({ ...f, fecha_vencimiento: e.target.value }))}
                          className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500" />
                      </div>
                    </div>
                    {mensajeTienda && (
                      <div className={`rounded-lg px-3 py-2 text-sm ${mensajeTienda.tipo === 'ok' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                        {mensajeTienda.texto}
                      </div>
                    )}
                    <button onClick={crearTienda} disabled={creandoTienda || !formTienda.nombre}
                      className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-yellow-400 disabled:opacity-50">
                      {creandoTienda ? 'Creando…' : '✅ Crear tienda'}
                    </button>
                  </div>
                </div>
              )}

              {seccion === 'usuarios' && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-gray-700 bg-gray-800 p-5">
                    <h2 className="mb-4 text-sm font-semibold text-white">➕ Crear nuevo usuario</h2>
                    <div className="grid grid-cols-2 gap-3">
                      <input placeholder="Nombre completo *" value={formUsuario.nombre} onChange={e => setFormUsuario(f => ({ ...f, nombre: e.target.value }))}
                        className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white outline-none placeholder-gray-400 focus:border-yellow-500" />
                      <input placeholder="Correo electrónico *" type="email" value={formUsuario.email} onChange={e => setFormUsuario(f => ({ ...f, email: e.target.value }))}
                        className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white outline-none placeholder-gray-400 focus:border-yellow-500" />
                      <input placeholder="Contraseña *" type="password" value={formUsuario.password} onChange={e => setFormUsuario(f => ({ ...f, password: e.target.value }))}
                        className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white outline-none placeholder-gray-400 focus:border-yellow-500" />
                      <select value={formUsuario.rol} onChange={e => setFormUsuario(f => ({ ...f, rol: e.target.value }))}
                        className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500">
                        <option value="cajero">🧾 Cajero</option>
                        <option value="admin">👔 Admin</option>
                      </select>
                      <select value={formUsuario.establecimiento_id} onChange={e => setFormUsuario(f => ({ ...f, establecimiento_id: e.target.value }))}
                        className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500 col-span-2">
                        {establecimientos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                      </select>
                    </div>
                    {mensaje && (
                      <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${mensaje.tipo === 'ok' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                        {mensaje.texto}
                      </div>
                    )}
                    <button onClick={crearUsuario} disabled={creando}
                      className="mt-3 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-yellow-400 disabled:opacity-50">
                      {creando ? 'Creando…' : '✅ Crear usuario'}
                    </button>
                  </div>

                  <div className="rounded-2xl border border-gray-700 bg-gray-800">
                    <div className="border-b border-gray-700 px-5 py-3">
                      <h2 className="text-sm font-semibold text-white">👤 Usuarios registrados ({usuarios.length})</h2>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="border-b border-gray-700 text-xs text-gray-400">
                        <tr>
                          <th className="px-5 py-3 text-left">Nombre</th>
                          <th className="px-5 py-3 text-left">Correo</th>
                          <th className="px-5 py-3 text-left">Tienda</th>
                          <th className="px-5 py-3 text-left">Rol</th>
                          <th className="px-5 py-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuarios.map(u => (
                          <tr key={u.id} className="border-b border-gray-700 hover:bg-gray-750">
                            <td className="px-5 py-3 text-white font-medium">{u.nombre}</td>
                            <td className="px-5 py-3 text-gray-400">{u.email ?? '—'}</td>
                            <td className="px-5 py-3 text-gray-400">{u.establecimiento?.nombre ?? '—'}</td>
                            <td className="px-5 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${u.es_superadmin ? 'bg-yellow-900 text-yellow-400' : u.rol === 'admin' ? 'bg-blue-900 text-blue-400' : 'bg-gray-700 text-gray-300'}`}>
                                {u.es_superadmin ? '⚡ Superadmin' : rolLabel[u.rol] ?? u.rol}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              {!u.es_superadmin && (
                                <button onClick={() => eliminarUsuario(u.id, u.nombre)} className="text-red-400 hover:text-red-300 text-xs">
                                  Eliminar
                                </button>
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
    </div>
  )
}