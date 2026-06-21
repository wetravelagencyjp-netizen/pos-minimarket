'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

type Rol = 'admin' | 'cajero'

interface UsuarioFila {
  id: string
  nombre: string | null
  email: string | null
  rol: Rol
  sucursal_id: number | null
  es_superadmin: boolean
  sucursal?: { nombre: string } | null
}

interface Sucursal {
  id: number
  nombre: string
}

const ROL_LABEL: Record<Rol, string> = { admin: '👔 Admin', cajero: '🧾 Cajero' }
const ROL_COLOR: Record<Rol, string> = {
  admin:  'bg-indigo-50 text-indigo-700',
  cajero: 'bg-slate-100 text-slate-600',
}

export default function UsuariosPage() {
  const { usuario } = useAuth()
  const router      = useRouter()
  const estabId     = Number(usuario?.establecimiento_id ?? 1)

  const [usuarios,   setUsuarios]   = useState<UsuarioFila[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [loading,    setLoading]    = useState(true)
  const [form, setForm]             = useState({ nombre: '', email: '', password: '', rol: 'cajero' as Rol, sucursal_id: '' })
  const [creando,    setCreando]    = useState(false)
  const [mensaje,    setMensaje]    = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [u, s] = await Promise.all([
      supabase
        .from('usuarios')
        .select('*, sucursal:sucursales(nombre)')
        .eq('establecimiento_id', estabId)
        .order('nombre'),
      supabase
        .from('sucursales')
        .select('id, nombre')
        .eq('establecimiento_id', estabId)
        .order('nombre'),
    ])
    setUsuarios((u.data ?? []) as UsuarioFila[])
    setSucursales(s.data ?? [])
    setLoading(false)
  }, [estabId])

  useEffect(() => { cargar() }, [cargar])

  const crearUsuario = async () => {
    if (!form.nombre || !form.email || !form.password) {
      setMensaje({ texto: 'Nombre, email y contraseña son obligatorios', tipo: 'error' })
      return
    }
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
        body: JSON.stringify({
          nombre:            form.nombre,
          email:             form.email,
          password:          form.password,
          rol:               form.rol,
          sucursal_id:       form.sucursal_id ? parseInt(form.sucursal_id) : null,
          establecimiento_id: estabId,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setMensaje({ texto: '✅ Usuario creado correctamente', tipo: 'ok' })
        setForm({ nombre: '', email: '', password: '', rol: 'cajero', sucursal_id: '' })
        cargar()
      } else {
        setMensaje({ texto: `❌ ${data.error}`, tipo: 'error' })
      }
    } catch {
      setMensaje({ texto: '❌ Error de conexión', tipo: 'error' })
    }
    setCreando(false)
  }

  const actualizarRol = async (id: string, rol: Rol) => {
    await supabase.from('usuarios').update({ rol }).eq('id', id)
    setUsuarios(prev => prev.map(u => u.id === id ? { ...u, rol } : u))
  }

  const actualizarSucursal = async (id: string, sucursal_id: number | null) => {
    await supabase.from('usuarios').update({ sucursal_id }).eq('id', id)
    const sucursal = sucursales.find(s => s.id === sucursal_id) ?? null
    setUsuarios(prev => prev.map(u => u.id === id ? { ...u, sucursal_id, sucursal: sucursal ? { nombre: sucursal.nombre } : null } : u))
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin')}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
            ← Volver al Admin
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <h1 className="text-sm font-semibold text-slate-900">👥 Gestión de Usuarios</h1>
        </div>
        <span className="text-xs text-slate-500">{usuario?.nombre ?? 'Admin'}</span>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 p-6">

        {/* Formulario nuevo usuario */}
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50">
          <h2 className="mb-5 text-sm font-semibold tracking-tight text-slate-900">➕ Agregar usuario</h2>
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Nombre completo *"
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
            />
            <input
              placeholder="Correo electrónico *"
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
            />
            <input
              placeholder="Contraseña *"
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
            />
            <select
              value={form.rol}
              onChange={e => setForm(f => ({ ...f, rol: e.target.value as Rol }))}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
            >
              <option value="cajero">🧾 Cajero</option>
              <option value="admin">👔 Admin</option>
            </select>
            <select
              value={form.sucursal_id}
              onChange={e => setForm(f => ({ ...f, sucursal_id: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
            >
              <option value="">— Sin sucursal asignada —</option>
              {sucursales.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>

          {mensaje && (
            <div className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${mensaje.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
              {mensaje.texto}
            </div>
          )}

          <button
            onClick={crearUsuario}
            disabled={creando}
            className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition-colors hover:bg-indigo-700 disabled:opacity-50">
            {creando ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>

        {/* Tabla de usuarios */}
        <div className="rounded-3xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/50">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-sm font-semibold tracking-tight text-slate-900">
              Equipo ({usuarios.length})
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-10">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : usuarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-10 text-slate-400">
              <span className="text-3xl">👤</span>
              <p className="text-sm">No hay usuarios registrados</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-6 py-3 text-left">Nombre</th>
                  <th className="px-6 py-3 text-left">Email</th>
                  <th className="px-6 py-3 text-left">Rol</th>
                  <th className="px-6 py-3 text-left">Sucursal</th>
                  <th className="px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/80">
                    <td className="px-6 py-3 font-medium text-slate-900">
                      {u.nombre ?? '—'}
                      {u.es_superadmin && (
                        <span className="ml-2 rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700">Super</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-500">{u.email ?? '—'}</td>
                    <td className="px-6 py-3">
                      {u.es_superadmin ? (
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${ROL_COLOR[u.rol]}`}>
                          {ROL_LABEL[u.rol]}
                        </span>
                      ) : (
                        <select
                          value={u.rol}
                          onChange={e => actualizarRol(u.id, e.target.value as Rol)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-indigo-400"
                        >
                          <option value="cajero">🧾 Cajero</option>
                          <option value="admin">👔 Admin</option>
                        </select>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      {u.es_superadmin ? (
                        <span className="text-xs text-slate-400">Global</span>
                      ) : (
                        <select
                          value={u.sucursal_id ?? ''}
                          onChange={e => actualizarSucursal(u.id, e.target.value ? parseInt(e.target.value) : null)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-indigo-400"
                        >
                          <option value="">— Sin sucursal —</option>
                          {sucursales.map(s => (
                            <option key={s.id} value={s.id}>{s.nombre}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {!u.es_superadmin && (
                        <button
                          onClick={() => eliminar(u.id, u.nombre ?? 'este usuario')}
                          className="text-xs font-medium text-rose-500 hover:text-rose-600 transition-colors">
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}