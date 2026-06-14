'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const fmt = (n: number) => `$${n.toFixed(2)}`

export default function SuperAdminPage() {
  const { usuario, logout } = useAuth()
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

  useEffect(() => {
    if (usuario && !(usuario as any).es_superadmin) router.push('/pos')
  }, [usuario, router])

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

  useEffect(() => { cargar() }, [cargar])

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

  return (
    <div className="flex h-screen flex-col bg-gray-900">
      <header className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-white">⚡ Super Admin</h1>
          <span className="rounded-full bg-yellow-500 px-2 py-0.5 text-[10px] font-bold text-gray-900">DUEÑO</span>
