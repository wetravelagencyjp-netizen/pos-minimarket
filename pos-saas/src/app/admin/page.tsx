'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Seccion = 'productos' | 'vendedores' | 'categorias' | 'equipo' | 'reportes'

export default function AdminPage() {
  const { usuario, logout } = useAuth()
  const router = useRouter()
  const [seccion, setSeccion] = useState<Seccion>('productos')

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/pos')} className="text-xs text-gray-400 hover:text-gray-600">← Volver al POS</button>
          <h1 className="text-sm font-semibold text-gray-900">Panel de Administración</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/facturacion')} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-600 hover:bg-blue-100">🧾 Facturación SRI</button>
          <span className="text-xs text-gray-500">{usuario?.nombre ?? 'Admin'}</span>
          <button onClick={logout} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700">Salir</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-48 border-r border-gray-100 bg-white p-4 space-y-1">
          {[
            { id: 'productos', label: '📦 Productos' },
            { id: 'vendedores', label: '👤 Vendedores' },
            { id: 'categorias', label: '🏷️ Categorías' },
            { id: 'equipo', label: '👥 Mi equipo' },
            { id: 'reportes', label: '📊 Reportes' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setSeccion(id as Seccion)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors
                ${seccion === id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          {seccion === 'productos' && <SeccionProductos establecimientoId={usuario?.establecimiento_id ?? 1} />}
          {seccion === 'vendedores' && <SeccionVendedores establecimientoId={usuario?.establecimiento_id ?? 1} />}
          {seccion === 'categorias' && <SeccionCategorias establecimientoId={usuario?.establecimiento_id ?? 1} />}
          {seccion === 'equipo' && <SeccionEquipo establecimientoId={usuario?.establecimiento_id ?? 1} />}
          {seccion === 'reportes' && <SeccionReportes establecimientoId={usuario?.establecimiento_id ?? 1} />}
        </main>
      </div>
    </div>
  )
}

// ─── PRODUCTOS ────────────────────────────────────────────
function SeccionProductos({ establecimientoId }: { establecimientoId: number }) {
  const [productos, setProductos] = useState<any[]>([])
  const [vendedores, setVendedores] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nombre: '', precio_venta: '', stock_actual: '', vendedor_id: '', categoria_id: '', codigo_barras: '' })
  const [editando, setEditando] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)

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

  useEffect(() => { cargar() }, [cargar])

  const limpiarForm = () => setForm({ nombre: '', precio_venta: '', stock_actual: '', vendedor_id: '', categoria_id: '', codigo_barras: '' })

  const guardar = async () => {
    if (!form.nombre || !form.precio_venta) return
    setGuardando(true)
    const datos = {
      establecimiento_id: establecimientoId,
      nombre: form.nombre,
      precio_venta: parseFloat(form.precio_venta),
      stock_actual: parseInt(form.stock_actual) || 0,
      vendedor_id: form.vendedor_id ? parseInt(form.vendedor_id) : null,
      categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
      codigo_barras: form.codigo_barras || null,
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
    setForm({ nombre: p.nombre, precio_venta: String(p.precio_venta), stock_actual: String(p.stock_actual), vendedor_id: String(p.vendedor_id ?? ''), categoria_id: String(p.categoria_id ?? ''), codigo_barras: p.codigo_barras ?? '' })
  }

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar este producto?')) return
    await supabase.from('productos').delete().eq('id', id)
    cargar()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">{editando ? '✏️ Editar producto' : '➕ Nuevo producto'}</h2>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Nombre del producto *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <input placeholder="Código de barras" value={form.codigo_barras} onChange={e => setForm(f => ({ ...f, codigo_barras: e.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <input placeholder="Precio de venta *" type="number" value={form.precio_venta} onChange={e => setForm(f => ({ ...f, precio_venta: e.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <input placeholder="Stock actual" type="number" value={form.stock_actual} onChange={e => setForm(f => ({ ...f, stock_actual: e.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <select value={form.vendedor_id} onChange={e => setForm(f => ({ ...f, vendedor_id: e.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400">
            <option value="">— Seleccionar vendedor —</option>
            {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
          <select value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400">
            <option value="">— Seleccionar categoría —</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={guardar} disabled={guardando}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {guardando ? 'Guardando…' : editando ? 'Actualizar' : 'Agregar producto'}
          </button>
          {editando && <button onClick={() => { setEditando(null); limpiarForm() }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">Cancelar</button>}
        </div>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Productos ({productos.length})</h2>
        </div>
        {loading ? <div className="p-5 text-sm text-gray-400">Cargando…</div> : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-xs text-gray-400">
              <tr>
                <th className="px-5 py-3 text-left">Nombre</th>
                <th className="px-5 py-3 text-left">Vendedor</th>
                <th className="px-5 py-3 text-left">Categoría</th>
                <th className="px-5 py-3 text-right">Precio</th>
                <th className="px-5 py-3 text-right">Stock</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{p.nombre}</td>
                  <td className="px-5 py-3 text-gray-500">{p.vendedor?.nombre ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500">{p.categoria?.nombre ?? '—'}</td>
                  <td className="px-5 py-3 text-right">${p.precio_venta.toFixed(2)}</td>
                  <td className="px-5 py-3 text-right">{p.stock_actual}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => editar(p)} className="mr-2 text-blue-500 hover:text-blue-700 text-xs">Editar</button>
                    <button onClick={() => eliminar(p.id)} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
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
        <div className="flex gap-3">
          <input placeholder="Emoji (ej: 🛒)" value={form.icono} onChange={e => setForm(f => ({ ...f, icono: e.target.value }))}
            className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <input placeholder="Nombre de la categoría *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
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
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    await fetch('/api/usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
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
      supabase.from('ventas').select('*').eq('establecimiento_id', establecimientoId).gte('fecha_venta', fechaInicio).order('fecha_venta'),
      supabase.from('detalle_ventas')
        .select('*, producto:productos(nombre), vendedor:vendedores(nombre), venta:ventas!inner(fecha_venta, establecimiento_id)')
        .eq('venta.establecimiento_id', establecimientoId)
        .gte('venta.fecha_venta', fechaInicio),
    ])
    const v = ventas.data ?? []
    const d = detalle.data ?? []
    setTotalVentas(v.reduce((s, x) => s + x.total, 0))
    setNumVentas(v.length)
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
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-2xl mb-2">💰</div>
              <div className="text-3xl font-bold text-gray-900">{fmt(totalVentas)}</div>
              <div className="text-xs text-gray-400 mt-1">Total vendido</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-2xl mb-2">🧾</div>
              <div className="text-3xl font-bold text-gray-900">{numVentas}</div>
              <div className="text-xs text-gray-400 mt-1">Transacciones</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-2xl mb-2">📊</div>
              <div className="text-3xl font-bold text-gray-900">{fmt(numVentas ? totalVentas / numVentas : 0)}</div>
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
          <div className="grid grid-cols-2 gap-4">
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
        </>
      )}
    </div>
  )
}
