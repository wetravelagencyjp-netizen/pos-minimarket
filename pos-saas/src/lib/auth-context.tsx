'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { type EstadoSuscripcion } from '@/types'

interface UsuarioSimple {
  id: string
  email: string
  establecimiento_id: number
  nombre: string | null
  rol: string
  es_superadmin?: boolean
  establecimiento?: {
    nombre: string
    estado_suscripcion: boolean
    fecha_vencimiento: string
    url_pago: string | null
    logo_url: string | null
    modo_multivendedor?: boolean
  }
}

interface AuthContextValue {
  usuario: UsuarioSimple | null
  estadoSuscripcion: EstadoSuscripcion | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSimple | null>(null)
  const [estadoSuscripcion, setEstadoSuscripcion] = useState<EstadoSuscripcion | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const cargarPerfil = useCallback(async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*, es_superadmin, establecimiento:establecimientos(nombre, estado_suscripcion, fecha_vencimiento, url_pago, logo_url, modo_multivendedor)')
        .eq('id', userId)
        .single()

      if (error || !data) {
        console.error('Error cargando perfil:', error)
        setUsuario(null)
        setEstadoSuscripcion(null)
        return
      }

      const row = data as any
      const estab = row.establecimiento as {
        nombre: string
        estado_suscripcion: boolean
        fecha_vencimiento: string
        url_pago: string | null
        logo_url: string | null
        modo_multivendedor?: boolean
      } | null

      const usuarioFinal: UsuarioSimple = {
        id: userId,
        email,
        establecimiento_id: row.establecimiento_id,
        nombre: row.nombre,
        rol: row.rol,
        es_superadmin: row.es_superadmin ?? false,
        establecimiento: estab ?? undefined,
      }

      setUsuario(usuarioFinal)

      if (!estab) {
        setEstadoSuscripcion('activa')
        return
      }

      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const venc = new Date(estab.fecha_vencimiento + 'T00:00:00')

      let estado: EstadoSuscripcion = 'activa'
      if (!estab.estado_suscripcion) estado = 'suspendida'
      else if (hoy > venc) estado = 'vencida'

      setEstadoSuscripcion(estado)

      if (estado !== 'activa') {
        const urlPago = estab.url_pago ?? ''
        router.push(`/suscripcion-vencida?url=${encodeURIComponent(urlPago)}&nombre=${encodeURIComponent(estab.nombre)}`)
      }
    } catch (e) {
      console.error('Error en cargarPerfil:', e)
      setUsuario(null)
      setEstadoSuscripcion(null)
    }
  }, [router])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        cargarPerfil(session.user.id, session.user.email ?? '').finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        cargarPerfil(session.user.id, session.user.email ?? '')
      } else {
        setUsuario(null)
        setEstadoSuscripcion(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [cargarPerfil])

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return {}
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }, [router])

  return (
    <AuthContext.Provider value={{ usuario, estadoSuscripcion, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}